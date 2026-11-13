//! foco-helper: el daemon privilegiado. Corre como root bajo launchd y es el
//! dueño de la sesión: guarda cuándo termina, escribe y vigila /etc/hosts,
//! detecta los intentos de abrir un sitio bloqueado y decide si se puede cortar.
//! La app de la barra de menú es solo un cliente; cerrarla no cambia nada.

use foco_core::{hosts, sniff, Attempt, Mode, Record, Request, Response, Session, StartArgs, Status};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::UnixListener;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::{env, fs, thread};

const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Rutas y puertos. Los valores por defecto son los de producción; las
/// variables de entorno existen para poder probar el daemon sin ser root.
struct Cfg {
    hosts: PathBuf,
    dir: PathBuf,
    sock: String,
    ports: Vec<u16>,
    /// Si un sitio tuvo conexiones hace menos que esto, una nueva no cuenta
    /// como intento: es una pestaña de fondo que sigue insistiendo.
    quiet: Duration,
    /// Segundos por "minuto" de sesión. 60, salvo en las pruebas.
    unit: u64,
}

impl Cfg {
    fn from_env() -> Self {
        let var = |k: &str, d: &str| env::var(k).unwrap_or_else(|_| d.to_string());
        Cfg {
            hosts: var("FOCO_HOSTS", "/etc/hosts").into(),
            dir: var("FOCO_DIR", "/Library/Application Support/Foco").into(),
            sock: var("FOCO_SOCK", foco_core::SOCKET_PATH),
            ports: var("FOCO_PORTS", "443,80").split(',').filter_map(|p| p.trim().parse().ok()).collect(),
            quiet: Duration::from_secs(var("FOCO_QUIET_SECS", "45").parse().unwrap_or(45)),
            unit: var("FOCO_UNIT_SECS", "60").parse().unwrap_or(60),
        }
    }
}

#[derive(Default, serde::Serialize, serde::Deserialize)]
struct Saved {
    session: Option<Session>,
    last_finished: Option<Record>,
}


struct Daemon {
    cfg: Cfg,
    saved: Saved,
    last_seen: HashMap<String, Instant>,
    sniffer_ok: bool,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn log(msg: &str) {
    eprintln!("[foco-helper {}] {msg}", now());
}

impl Daemon {
    fn load(cfg: Cfg) -> Self {
        let _ = fs::create_dir_all(&cfg.dir);
        let _ = fs::set_permissions(&cfg.dir, fs::Permissions::from_mode(0o755));
        let saved = fs::read_to_string(cfg.dir.join("state.json"))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Daemon { cfg, saved, last_seen: HashMap::new(), sniffer_ok: false }
    }

    fn persist(&self) {
        let path = self.cfg.dir.join("state.json");
        match serde_json::to_string_pretty(&self.saved) {
            Ok(json) => {
                if let Err(e) = write_atomic(&path, &json, 0o644) {
                    log(&format!("no pude guardar el estado: {e}"));
                }
            }
            Err(e) => log(&format!("no pude serializar el estado: {e}")),
        }
    }

    fn status(&self) -> Status {
        Status {
            version: VERSION.to_string(),
            now: now(),
            session: self.saved.session.clone(),
            last_finished: self.saved.last_finished.clone(),
            sniffer_ok: self.sniffer_ok,
        }
    }

    fn sites(&self) -> Vec<String> {
        self.saved.session.as_ref().map(|s| s.sites.clone()).unwrap_or_default()
    }

    /// Deja /etc/hosts como corresponde al estado actual. Devuelve true si lo cambió.
    fn sync_hosts(&self) -> bool {
        let current = match fs::read_to_string(&self.cfg.hosts) {
            Ok(c) => c,
            Err(e) => {
                log(&format!("no pude leer {}: {e}", self.cfg.hosts.display()));
                return false;
            }
        };
        let wanted = hosts::apply(&current, &self.sites());
        if wanted == current {
            return false;
        }
        match write_atomic(&self.cfg.hosts, &wanted, 0o644) {
            Ok(()) => {
                flush_dns();
                true
            }
            Err(e) => {
                log(&format!("no pude escribir {}: {e}", self.cfg.hosts.display()));
                false
            }
        }
    }

    fn start(&mut self, args: StartArgs) -> Result<(), String> {
        if self.saved.session.is_some() {
            return Err("a session is already running".into());
        }
        if !(foco_core::MIN_MINUTES..=foco_core::MAX_MINUTES).contains(&args.minutes) {
            return Err(format!("duration must be between {} and {} minutes", foco_core::MIN_MINUTES, foco_core::MAX_MINUTES));
        }
        let mut sites = Vec::new();
        for raw in &args.sites {
            let site = hosts::normalize(raw).ok_or_else(|| format!("invalid site: {raw:?}"))?;
            if !sites.contains(&site) {
                sites.push(site);
            }
        }
        if sites.len() > 200 {
            return Err("too many sites".into());
        }
        let bundle_ok = |id: &str| {
            !id.is_empty() && id.len() <= 200 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b"-._".contains(&b))
        };
        if let Some(bad) = args.apps.iter().chain(args.one_app.iter()).find(|id| !bundle_ok(id)) {
            return Err(format!("invalid app: {bad:?}"));
        }
        let mode = args.mode.unwrap_or(Mode::List);
        if mode == Mode::One && args.one_app.is_none() {
            return Err("one thing mode needs an app".into());
        }
        let started = now();
        self.saved.session = Some(Session {
            id: started,
            started_at: started,
            ends_at: started + args.minutes as u64 * self.cfg.unit,
            mode,
            sites,
            apps: if mode == Mode::List { args.apps } else { Vec::new() },
            one_app: if mode == Mode::One { args.one_app } else { None },
            one_app_name: if mode == Mode::One { args.one_app_name.map(|n| n.chars().take(80).collect()) } else { None },
            attempts: 0,
            last_attempt: None,
            cooldown_started: None,
        });
        self.saved.last_finished = None;
        self.last_seen.clear();
        self.persist();
        self.sync_hosts();
        log("sesión iniciada");
        Ok(())
    }

    fn finish(&mut self, cancelled: bool) {
        let Some(s) = self.saved.session.take() else { return };
        let ended = now().min(s.ends_at).max(s.started_at);
        let record = Record {
            id: s.id,
            started_at: s.started_at,
            ended_at: ended,
            planned_secs: s.ends_at - s.started_at,
            mode: s.mode,
            attempts: s.attempts,
            cancelled,
        };
        if let Ok(line) = serde_json::to_string(&record) {
            let path = self.cfg.dir.join("history.jsonl");
            let res = fs::OpenOptions::new().create(true).append(true).open(&path).and_then(|mut f| writeln!(f, "{line}"));
            if let Err(e) = res {
                log(&format!("no pude guardar el historial: {e}"));
            }
        }
        self.saved.last_finished = Some(record);
        self.persist();
        self.sync_hosts();
        log(if cancelled { "sesión cortada" } else { "sesión terminada" });
    }

    fn cancel(&mut self, phrase: Option<String>) -> Result<(), String> {
        let Some(s) = &self.saved.session else { return Err("no session".into()) };
        let cooled = s.cooldown_started.is_some_and(|c| now() >= c + foco_core::COOLDOWN_SECS);
        match phrase {
            Some(p) if foco_core::phrase_matches(&p) => {}
            Some(_) => return Err("the phrase does not match".into()),
            None if cooled => {}
            None => return Err("the cooldown is not over yet".into()),
        }
        self.finish(true);
        Ok(())
    }

    fn attempt(&mut self, target: &str, kind: &str) {
        let Some(s) = &mut self.saved.session else { return };
        let seq = s.attempts + 1;
        s.attempts = seq;
        s.last_attempt = Some(Attempt { seq, target: target.chars().take(120).collect(), kind: kind.into(), at: now() });
        self.persist();
    }

    /// Una conexión a un host bloqueado. Cuenta como intento solo si el sitio
    /// venía callado; cada conexión, cuente o no, renueva la ventana.
    fn site_hit(&mut self, host: &str) {
        let sites = self.sites();
        let Some(site) = hosts::site_for(host, &sites).map(str::to_string) else { return };
        let quiet = self.cfg.quiet;
        let fresh = self.last_seen.get(&site).is_none_or(|t| t.elapsed() >= quiet);
        self.last_seen.insert(site.clone(), Instant::now());
        if fresh {
            self.attempt(&site, "site");
        }
    }

    fn tick(&mut self) {
        let t = now();
        if let Some(s) = &mut self.saved.session {
            if t >= s.ends_at {
                self.finish(false);
                return;
            }
            let window = foco_core::COOLDOWN_SECS + foco_core::COOLDOWN_WINDOW_SECS;
            if s.cooldown_started.is_some_and(|c| t >= c + window) {
                s.cooldown_started = None;
                self.persist();
            }
        }
        if self.sync_hosts() && self.saved.session.is_some() {
            log("alguien tocó /etc/hosts; bloque repuesto");
        }
    }

    fn handle(&mut self, req: Request) -> Response {
        let mut history = None;
        let result = match req {
            Request::Status => Ok(()),
            Request::Start(args) => self.start(args),
            Request::BeginCooldown => match &mut self.saved.session {
                Some(s) => {
                    if s.cooldown_started.is_none() {
                        s.cooldown_started = Some(now());
                        self.persist();
                    }
                    Ok(())
                }
                None => Err("no session".into()),
            },
            Request::Cancel { phrase } => self.cancel(phrase),
            Request::Attempt { target } => {
                self.attempt(&target, "app");
                Ok(())
            }
            Request::AckSummary => {
                if self.saved.last_finished.take().is_some() {
                    self.persist();
                }
                Ok(())
            }
            Request::History => {
                history = Some(read_history(&self.cfg.dir.join("history.jsonl")));
                Ok(())
            }
        };
        Response { ok: result.is_ok(), error: result.err(), status: self.status(), history }
    }
}

fn read_history(path: &std::path::Path) -> Vec<Record> {
    let text = fs::read_to_string(path).unwrap_or_default();
    let mut all: Vec<Record> = text.lines().filter_map(|l| serde_json::from_str(l).ok()).collect();
    let keep = all.len().saturating_sub(1000);
    all.drain(..keep);
    all
}

fn write_atomic(path: &std::path::Path, content: &str, mode: u32) -> std::io::Result<()> {
    // /etc/hosts puede ser un enlace; se escribe al lado del archivo real.
    let real = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let tmp = real.with_extension("foco-tmp");
    fs::write(&tmp, content)?;
    fs::set_permissions(&tmp, fs::Permissions::from_mode(mode))?;
    fs::rename(&tmp, &real)
}

fn flush_dns() {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = Command::new("/usr/bin/dscacheutil").arg("-flushcache").status();
        let _ = Command::new("/usr/bin/killall").args(["-HUP", "mDNSResponder"]).status();
    }
}

/// Si hay sesión y la app no está corriendo, la vuelve a abrir en la sesión
/// gráfica de quien esté sentado: es la app la que oculta apps y muestra la
/// pantalla de bloqueado.
#[cfg(target_os = "macos")]
fn keep_app_alive() {
    use std::os::unix::fs::MetadataExt;
    use std::process::{Command, Stdio};
    let Ok(uid) = fs::metadata("/dev/console").map(|m| m.uid()) else { return };
    if uid == 0 {
        return; // nadie con sesión iniciada
    }
    let running = Command::new("/usr/bin/pgrep")
        .args(["-u", &uid.to_string(), "-x", "foco"])
        .stdout(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(true);
    if !running {
        let _ = Command::new("/bin/launchctl")
            .args(["asuser", &uid.to_string(), "/usr/bin/open", "-g", "-b", foco_core::APP_BUNDLE_ID])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

#[cfg(not(target_os = "macos"))]
fn keep_app_alive() {}

const BLOCKED_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Foco</title>\
<body style=\"margin:0;height:100vh;display:grid;place-items:center;background:#0C0C0C;color:#fff;\
font:500 48px system-ui,sans-serif;letter-spacing:-0.03em\">Back to it.";

fn handle_conn(daemon: Arc<Mutex<Daemon>>, mut conn: TcpStream) {
    let _ = conn.set_nonblocking(false);
    let _ = conn.set_read_timeout(Some(Duration::from_millis(1500)));
    let mut buf = vec![0u8; 4096];
    let mut len = 0;
    let mut host = None;
    while len < buf.len() && host.is_none() {
        match conn.read(&mut buf[len..]) {
            Ok(0) | Err(_) => break,
            Ok(n) => len += n,
        }
        host = sniff::host_of(&buf[..len]);
    }
    let Some(host) = host else { return };
    if sniff::http_host(&buf[..len]).is_some() {
        let _ = write!(
            conn,
            "HTTP/1.1 403 Forbidden\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{BLOCKED_PAGE}",
            BLOCKED_PAGE.len()
        );
    }
    drop(conn); // en TLS no hay nada que contestar: el navegador muestra su error
    daemon.lock().unwrap().site_hit(&host);
}

/// Escucha en los puertos 80 y 443 locales, solo mientras hay una sesión, para
/// no pisar un servidor de desarrollo el resto del tiempo.
fn sniffer(daemon: Arc<Mutex<Daemon>>) {
    let ports = daemon.lock().unwrap().cfg.ports.clone();
    loop {
        if daemon.lock().unwrap().sites().is_empty() {
            thread::sleep(Duration::from_millis(300));
            continue;
        }
        let mut listeners = Vec::new();
        for port in &ports {
            for addr in [format!("127.0.0.1:{port}"), format!("[::1]:{port}")] {
                match TcpListener::bind(&addr) {
                    Ok(l) if l.set_nonblocking(true).is_ok() => listeners.push(l),
                    Ok(_) => {}
                    Err(e) => log(&format!("no pude escuchar en {addr}: {e}")),
                }
            }
        }
        daemon.lock().unwrap().sniffer_ok = !listeners.is_empty();
        while !daemon.lock().unwrap().sites().is_empty() {
            for l in &listeners {
                while let Ok((conn, _)) = l.accept() {
                    let d = daemon.clone();
                    thread::spawn(move || handle_conn(d, conn));
                }
            }
            thread::sleep(Duration::from_millis(25));
        }
        daemon.lock().unwrap().sniffer_ok = false;
    }
}

fn serve(daemon: Arc<Mutex<Daemon>>, listener: UnixListener) {
    for conn in listener.incoming().flatten() {
        let daemon = daemon.clone();
        thread::spawn(move || {
            let _ = conn.set_read_timeout(Some(Duration::from_secs(3)));
            let mut line = String::new();
            let mut reader = BufReader::new((&conn).take(256 * 1024));
            if reader.read_line(&mut line).is_err() {
                return;
            }
            let response = match serde_json::from_str::<Request>(&line) {
                Ok(req) => daemon.lock().unwrap().handle(req),
                Err(e) => {
                    let status = daemon.lock().unwrap().status();
                    Response { ok: false, error: Some(format!("invalid request: {e}")), status, history: None }
                }
            };
            if let Ok(mut out) = serde_json::to_string(&response) {
                out.push('\n');
                let _ = (&conn).write_all(out.as_bytes());
            }
        });
    }
}

fn main() {
    if env::args().any(|a| a == "--version") {
        println!("{VERSION}");
        return;
    }
    // Un navegador que corta la conexión no tiene que matar al daemon.
    unsafe { libc::signal(libc::SIGPIPE, libc::SIG_IGN) };

    let cfg = Cfg::from_env();
    let sock = cfg.sock.clone();
    let daemon = Arc::new(Mutex::new(Daemon::load(cfg)));
    // Al arrancar (también después de reiniciar la Mac): retomar o cerrar la sesión.
    daemon.lock().unwrap().tick();

    let _ = fs::remove_file(&sock);
    let listener = match UnixListener::bind(&sock) {
        Ok(l) => l,
        Err(e) => {
            log(&format!("no pude abrir {sock}: {e}"));
            std::process::exit(1);
        }
    };
    let _ = fs::set_permissions(&sock, fs::Permissions::from_mode(0o666));
    log(&format!("escuchando en {sock}"));

    let d = daemon.clone();
    thread::spawn(move || sniffer(d));
    let d = daemon.clone();
    thread::spawn(move || {
        let mut n = 0u32;
        loop {
            thread::sleep(Duration::from_secs(1));
            let active = {
                let mut d = d.lock().unwrap();
                d.tick();
                d.saved.session.is_some()
            };
            n = n.wrapping_add(1);
            if active && n % 4 == 0 {
                keep_app_alive();
            }
        }
    });
    serve(daemon, listener);
}
