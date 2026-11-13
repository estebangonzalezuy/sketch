//! Foco: la app de la barra de menú. No bloquea sitios ella misma: le pide la
//! sesión al helper privilegiado y refleja su estado. Lo suyo es el ícono, el
//! popover, el atajo, la pantalla de bloqueado y ocultar o cerrar apps.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod mac;
mod tray;

use config::{AppRef, Config};
use foco_core::{client, Record, Request, Session};
use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Rect, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const PANEL_WIDTH: f64 = 340.0;
/// Niveles de ventana de AppKit: la pantalla de bloqueado va al nivel del
/// salvapantallas; el panel, uno más arriba, para poder afinarla en vivo.
const LEVEL_BLOCK: isize = 1000;
const LEVEL_PANEL: isize = 1001;

/// Lo que el frontend sabe del mundo. Se emite cada vez que cambia.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
struct Snapshot {
    /// "ok", "missing" (no instalado o no responde) u "outdated".
    helper: &'static str,
    session: Option<SessionView>,
    last_finished: Option<Record>,
    sniffer_ok: bool,
}

/// La sesión tal cual la manda el helper. Se compara por su JSON para saber
/// si hay algo nuevo que contarle al frontend.
#[derive(Debug, Clone, Serialize)]
struct SessionView {
    #[serde(flatten)]
    session: Session,
}

impl PartialEq for SessionView {
    fn eq(&self, other: &Self) -> bool {
        serde_json::to_string(&self.session).ok() == serde_json::to_string(&other.session).ok()
    }
}

#[derive(Default)]
struct Shared {
    config: Mutex<Config>,
    snapshot: Mutex<Snapshot>,
    enforcer: Mutex<mac::Enforcer>,
    /// (sesión, número) del último intento ya mostrado. None hasta la primera vuelta.
    seen: Mutex<Option<(u64, u32)>>,
    /// Cuándo se ocultó el panel por perder el foco, para que el mismo clic
    /// en el ícono que lo cerró no lo vuelva a abrir.
    blurred: Mutex<Option<Instant>>,
    previewing: Mutex<bool>,
}

fn ask(req: &Request) -> Result<foco_core::Response, String> {
    let res = client::request(foco_core::SOCKET_PATH, req)?;
    match res.error.clone() {
        Some(e) if !res.ok => Err(e),
        _ => Ok(res),
    }
}

fn snapshot_of(res: Result<foco_core::Response, String>) -> Snapshot {
    match res {
        Ok(r) => Snapshot {
            helper: if r.status.version == env!("CARGO_PKG_VERSION") { "ok" } else { "outdated" },
            session: r.status.session.map(|session| SessionView { session }),
            last_finished: r.status.last_finished,
            sniffer_ok: r.status.sniffer_ok,
        },
        Err(_) => Snapshot { helper: "missing", ..Default::default() },
    }
}

fn now() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// Una vuelta: preguntarle al helper y poner la app al día.
fn refresh(app: &AppHandle) -> Snapshot {
    let shared = app.state::<Shared>();
    let snap = snapshot_of(client::request(foco_core::SOCKET_PATH, &Request::Status));
    let prev = std::mem::replace(&mut *shared.snapshot.lock().unwrap(), snap.clone());
    if prev != snap {
        let _ = app.emit("status", &snap);
    }

    let session = snap.session.as_ref().map(|v| &v.session);
    if let Some(tray) = app.tray_by_id("main") {
        let t = now();
        let _ = tray.set_title(session.map(|s| tray::title(s, t)));
        let was = prev.session.as_ref().map(|v| tray::remaining(&v.session, t.saturating_sub(1)));
        let is = session.map(|s| tray::remaining(s, t));
        if was != is || prev.session.is_some() != session.is_some() {
            let _ = tray.set_icon(Some(tray::icon(is)));
            let _ = tray.set_icon_as_template(true);
        }
    }

    // Intentos nuevos de abrir un sitio: los detectó el helper.
    let latest = session.and_then(|s| s.last_attempt.as_ref().map(|a| (s.id, a.seq)));
    let mut seen = shared.seen.lock().unwrap();
    let primed = seen.is_some() || prev.helper == "ok";
    if latest.is_some() && *seen != latest && primed {
        show_block(app, false);
    }
    *seen = Some(latest.unwrap_or((0, 0)));
    drop(seen);

    // La sesión terminó: sonido y resumen.
    if prev.session.is_some() && session.is_none() {
        hide_block_window(app);
        if snap.last_finished.as_ref().is_some_and(|r| !r.cancelled) {
            mac::chime();
        }
        show_panel(app, "main");
    }

    // Apps: ocultar o cerrar lo que no corresponde. AppKit va en el hilo principal.
    if let Some(s) = session.cloned() {
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            let shared = handle.state::<Shared>();
            let attempts = shared.enforcer.lock().unwrap().pass(&s);
            if !attempts.is_empty() {
                for target in attempts {
                    let _ = client::request(foco_core::SOCKET_PATH, &Request::Attempt { target });
                }
                // El helper suma el intento; la próxima vuelta lo muestra.
            }
        });
    }
    snap
}

fn panel(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("panel")
}

/// Abre el popover debajo del ícono. `view` es "main" o "tuning".
fn show_panel(app: &AppHandle, view: &str) {
    let Some(win) = panel(app) else { return };
    let _ = app.emit("view", view);
    let rect = app.tray_by_id("main").and_then(|t| t.rect().ok().flatten());
    place_under(&win, rect);
    let _ = win.show();
    let _ = win.set_focus();
}

fn place_under(win: &WebviewWindow, rect: Option<Rect>) {
    let scale = win.scale_factor().unwrap_or(2.0);
    let size = win.outer_size().unwrap_or(PhysicalSize::new((PANEL_WIDTH * scale) as u32, 0));
    let Some(rect) = rect else {
        // Sin ícono a la vista: arriba a la derecha de la pantalla principal.
        if let Ok(Some(m)) = win.primary_monitor() {
            let x = m.position().x + m.size().width as i32 - size.width as i32 - (12.0 * scale) as i32;
            let _ = win.set_position(PhysicalPosition::new(x, m.position().y + (32.0 * scale) as i32));
        }
        return;
    };
    let pos: PhysicalPosition<f64> = rect.position.to_physical(scale);
    let icon: PhysicalSize<f64> = rect.size.to_physical(scale);
    let mut x = pos.x + icon.width / 2.0 - size.width as f64 / 2.0;
    let y = pos.y + icon.height + 6.0 * scale;
    if let Ok(Some(m)) = win.monitor_from_point(pos.x, pos.y) {
        let left = m.position().x as f64 + 8.0 * scale;
        let right = m.position().x as f64 + m.size().width as f64 - size.width as f64 - 8.0 * scale;
        x = x.clamp(left, right.max(left));
    }
    let _ = win.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
}

/// La pantalla de bloqueado, sobre la pantalla donde está el cursor.
fn show_block(app: &AppHandle, preview: bool) {
    let Some(win) = app.get_webview_window("block") else { return };
    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(m) = monitor {
        let _ = win.set_position(*m.position());
        let _ = win.set_size(*m.size());
    }
    *app.state::<Shared>().previewing.lock().unwrap() = preview;
    let _ = app.emit_to("block", "block", preview);
    let _ = win.show();
    if !preview {
        if let Some(p) = panel(app) {
            let _ = p.hide();
        }
        let _ = win.set_focus();
    }
}

fn hide_block_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("block") {
        let _ = win.hide();
    }
    *app.state::<Shared>().previewing.lock().unwrap() = false;
}

fn start_session(app: &AppHandle) -> Result<Snapshot, String> {
    let args = app.state::<Shared>().config.lock().unwrap().start_args();
    ask(&Request::Start(args))?;
    Ok(refresh(app))
}

// ── Comandos del frontend ──────────────────────────────────────────────────

#[tauri::command]
fn snapshot(app: AppHandle) -> Snapshot {
    refresh(&app)
}

#[tauri::command]
fn get_config(shared: State<Shared>) -> Config {
    shared.config.lock().unwrap().clone()
}

#[tauri::command]
fn set_config(app: AppHandle, shared: State<Shared>, config: Config) -> Result<(), String> {
    *shared.config.lock().unwrap() = config.clone();
    // La pantalla de bloqueado usa el acento y las curvas del panel oculto.
    let _ = app.emit_to("block", "config", &config);
    config::save(&app, &config)
}

#[tauri::command]
fn start(app: AppHandle) -> Result<Snapshot, String> {
    start_session(&app)
}

#[tauri::command]
fn begin_cooldown(app: AppHandle) -> Result<Snapshot, String> {
    ask(&Request::BeginCooldown)?;
    Ok(refresh(&app))
}

#[tauri::command]
fn cancel(app: AppHandle, phrase: Option<String>) -> Result<Snapshot, String> {
    ask(&Request::Cancel { phrase })?;
    Ok(refresh(&app))
}

#[tauri::command]
fn ack_summary(app: AppHandle) -> Result<Snapshot, String> {
    ask(&Request::AckSummary)?;
    Ok(refresh(&app))
}

#[tauri::command]
fn history() -> Result<Vec<Record>, String> {
    Ok(ask(&Request::History)?.history.unwrap_or_default())
}

#[tauri::command]
async fn installed_apps() -> Vec<AppRef> {
    mac::installed_apps()
}

#[tauri::command]
async fn install_helper(app: AppHandle) -> Result<Snapshot, String> {
    let script = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("resources/install-helper.sh");
    let helper = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("no encuentro la carpeta de la app")?
        .join("foco-helper");
    if !helper.exists() {
        return Err(format!("falta el helper en {}", helper.display()));
    }
    mac::run_as_admin(&script, &helper)?;
    // launchd tarda un instante en levantar el daemon.
    for _ in 0..20 {
        std::thread::sleep(Duration::from_millis(150));
        if client::request(foco_core::SOCKET_PATH, &Request::Status).is_ok() {
            break;
        }
    }
    Ok(refresh(&app))
}

#[tauri::command]
fn resize_panel(app: AppHandle, height: f64) {
    if let Some(win) = panel(&app) {
        let _ = win.set_size(tauri::LogicalSize::new(PANEL_WIDTH, height.clamp(120.0, 2000.0)));
    }
}

#[tauri::command]
fn hide_panel(app: AppHandle) {
    if let Some(win) = panel(&app) {
        let _ = win.hide();
    }
}

#[tauri::command]
fn preview_block(app: AppHandle) {
    show_block(&app, true);
}

#[tauri::command]
fn hide_block(app: AppHandle) {
    hide_block_window(&app);
}

/// Salir solo se puede sin sesión; con sesión, el helper volvería a abrir la app.
#[tauri::command]
fn quit(app: AppHandle, shared: State<Shared>) -> Result<(), String> {
    if shared.snapshot.lock().unwrap().session.is_some() {
        return Err("hay una sesión en curso".into());
    }
    app.exit(0);
    Ok(())
}

// ── Armado ─────────────────────────────────────────────────────────────────

fn build_windows(app: &AppHandle) -> tauri::Result<()> {
    let panel = WebviewWindowBuilder::new(app, "panel", WebviewUrl::App("index.html".into()))
        .title("Foco")
        .inner_size(PANEL_WIDTH, 520.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()?;
    mac::raise(&panel, LEVEL_PANEL);

    let handle = app.clone();
    panel.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            let shared = handle.state::<Shared>();
            // Mientras se afina la pantalla de bloqueado, el panel se queda.
            if *shared.previewing.lock().unwrap() {
                return;
            }
            *shared.blurred.lock().unwrap() = Some(Instant::now());
            if let Some(win) = handle.get_webview_window("panel") {
                let _ = win.hide();
            }
        }
    });

    let block = WebviewWindowBuilder::new(app, "block", WebviewUrl::App("index.html?view=block".into()))
        .title("Foco")
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()?;
    mac::raise(&block, LEVEL_BLOCK);
    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    TrayIconBuilder::with_id("main")
        .icon(tray::icon(None))
        .icon_as_template(true)
        .tooltip("Foco")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event else {
                return;
            };
            let app = tray.app_handle();
            let shared = app.state::<Shared>();
            let just_closed = shared.blurred.lock().unwrap().is_some_and(|t| t.elapsed() < Duration::from_millis(250));
            let visible = panel(app).and_then(|w| w.is_visible().ok()).unwrap_or(false);
            if visible {
                if let Some(win) = panel(app) {
                    let _ = win.hide();
                }
            } else if !just_closed {
                // ⌥ clic abre el panel oculto de curvas.
                show_panel(app, if mac::option_down() { "tuning" } else { "main" });
            }
        })
        .build(app)?;
    Ok(())
}

/// ⌥⌘F: sin sesión, arranca una con lo último que se eligió. Con sesión (o
/// sin helper), abre el panel.
fn on_shortcut(app: &AppHandle) {
    let snap = app.state::<Shared>().snapshot.lock().unwrap().clone();
    if snap.helper == "ok" && snap.session.is_none() && snap.last_finished.is_none() {
        if start_session(app).is_ok() {
            return;
        }
    }
    show_panel(app, "main");
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Shared::default())
        .invoke_handler(tauri::generate_handler![
            snapshot,
            get_config,
            set_config,
            start,
            begin_cooldown,
            cancel,
            ack_summary,
            history,
            installed_apps,
            install_helper,
            resize_panel,
            hide_panel,
            preview_block,
            hide_block,
            quit
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            *handle.state::<Shared>().config.lock().unwrap() = config::load(&handle);

            build_windows(&handle)?;
            build_tray(&handle)?;

            let shortcut = Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), Code::KeyF);
            if let Err(e) = app.global_shortcut().on_shortcut(shortcut, |app, _, event| {
                if event.state == ShortcutState::Pressed {
                    on_shortcut(app);
                }
            }) {
                eprintln!("no pude registrar ⌥⌘F: {e}");
            }

            // El pulso de la app: dos veces por segundo le pregunta al helper.
            std::thread::spawn(move || loop {
                refresh(&handle);
                std::thread::sleep(Duration::from_millis(500));
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("no pude arrancar Foco")
        .run(|_, event| {
            // Cerrar las ventanas no cierra la app: sigue en la barra de menú.
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
