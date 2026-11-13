//! Lo que solo existe en macOS: ocultar y cerrar apps, listar las instaladas,
//! subir la pantalla de bloqueado por encima de la barra de menú y leer si
//! Opción está apretada.

use crate::config::AppRef;
use foco_core::{Mode, Session};
use objc2_app_kit::{
    NSApplicationActivationOptions, NSApplicationActivationPolicy, NSRunningApplication, NSWindow,
    NSWindowCollectionBehavior, NSWorkspace,
};
use std::collections::HashMap;
use std::path::Path;
use std::time::{Duration, Instant};

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventSourceFlagsState(state_id: i32) -> u64;
}

/// ¿Está apretada la tecla Opción en este momento?
pub fn option_down() -> bool {
    const COMBINED_SESSION_STATE: i32 = 0;
    const FLAG_ALTERNATE: u64 = 0x0008_0000;
    unsafe { CGEventSourceFlagsState(COMBINED_SESSION_STATE) & FLAG_ALTERNATE != 0 }
}

/// Pone una ventana por encima de todo, barra de menú incluida, en todos los
/// escritorios y también sobre apps a pantalla completa.
pub fn raise(window: &tauri::WebviewWindow, level: isize) {
    let Ok(ptr) = window.ns_window() else { return };
    if ptr.is_null() {
        return;
    }
    #[allow(unused_unsafe)]
    unsafe {
        let ns: &NSWindow = &*(ptr as *const NSWindow);
        ns.setLevel(level);
        ns.setCollectionBehavior(
            NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::FullScreenAuxiliary
                | NSWindowCollectionBehavior::Stationary,
        );
    }
}

/// Recuerda qué hizo en la sesión en curso para no contar dos veces lo mismo.
#[derive(Default)]
pub struct Enforcer {
    session: u64,
    passes: u32,
    last_attempt: HashMap<String, Instant>,
}

const FINDER: &str = "com.apple.finder";

impl Enforcer {
    /// Una pasada. Tiene que correr en el hilo principal. Devuelve los nombres
    /// de las apps que se intentaron abrir desde la pasada anterior.
    #[allow(unused_unsafe)]
    pub fn pass(&mut self, s: &Session) -> Vec<String> {
        if self.session != s.id {
            *self = Enforcer { session: s.id, ..Default::default() };
        }
        self.passes += 1;
        // En la primera pasada se ordena lo que ya estaba abierto, sin contarlo.
        let settling = self.passes == 1;
        let mut attempts = Vec::new();
        let me = std::process::id() as i32;

        unsafe {
            let running = NSWorkspace::sharedWorkspace().runningApplications();
            let mut allowed: Option<objc2::rc::Retained<NSRunningApplication>> = None;
            let mut stray_in_front = false;

            for app in running.iter() {
                if app.processIdentifier() == me || app.activationPolicy() != NSApplicationActivationPolicy::Regular {
                    continue;
                }
                let Some(id) = app.bundleIdentifier().map(|s| s.to_string()) else { continue };
                let name = app.localizedName().map(|s| s.to_string()).unwrap_or_else(|| id.clone());

                match s.mode {
                    Mode::List => {
                        if s.apps.iter().any(|b| *b == id) && !app.isTerminated() {
                            app.terminate();
                            if !settling && self.fresh(&id) {
                                attempts.push(name);
                            }
                        }
                    }
                    Mode::One => {
                        if s.one_app.as_deref() == Some(id.as_str()) {
                            allowed = Some(app.clone());
                            continue;
                        }
                        if app.isActive() {
                            stray_in_front = true;
                            // Tocar el escritorio activa el Finder: se oculta, pero no es un intento.
                            if !settling && id != FINDER && self.fresh(&id) {
                                attempts.push(name);
                            }
                        }
                        if !app.isHidden() {
                            app.hide();
                        }
                    }
                }
            }

            if s.mode == Mode::One {
                match (&allowed, &s.one_app) {
                    (Some(app), _) if stray_in_front || settling => {
                        app.unhide();
                        app.activateWithOptions(NSApplicationActivationOptions::ActivateAllWindows);
                    }
                    (None, Some(id)) if settling => {
                        let _ = std::process::Command::new("/usr/bin/open").args(["-b", id]).spawn();
                    }
                    _ => {}
                }
            }
        }
        attempts
    }

    /// Cerrar una app lleva un momento: el mismo intento no se cuenta dos veces.
    fn fresh(&mut self, id: &str) -> bool {
        let fresh = self.last_attempt.get(id).is_none_or(|t| t.elapsed() > Duration::from_secs(6));
        if fresh {
            self.last_attempt.insert(id.to_string(), Instant::now());
        }
        fresh
    }
}

/// Las apps instaladas, para elegir cuáles bloquear o con cuál quedarse.
pub fn installed_apps() -> Vec<AppRef> {
    let mut roots = vec!["/Applications".to_string(), "/System/Applications".to_string()];
    if let Ok(home) = std::env::var("HOME") {
        roots.push(format!("{home}/Applications"));
    }
    let mut out: Vec<AppRef> = Vec::new();
    for root in roots {
        scan(Path::new(&root), 2, &mut out);
    }
    out.sort_by_key(|a| a.name.to_lowercase());
    out.dedup_by(|a, b| a.id == b.id);
    out
}

fn scan(dir: &Path, depth: u32, out: &mut Vec<AppRef>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "app") {
            if let Some(app) = read_bundle(&path) {
                if !out.iter().any(|a| a.id == app.id) {
                    out.push(app);
                }
            }
        } else if depth > 1 && path.is_dir() {
            // Adobe y otros dejan la app dentro de una carpeta propia.
            scan(&path, depth - 1, out);
        }
    }
}

fn read_bundle(path: &Path) -> Option<AppRef> {
    let info = plist::Value::from_file(path.join("Contents/Info.plist")).ok()?;
    let dict = info.as_dictionary()?;
    let text = |k: &str| dict.get(k).and_then(|v| v.as_string()).map(str::to_string);
    let id = text("CFBundleIdentifier")?;
    if id == foco_core::APP_BUNDLE_ID {
        return None;
    }
    // El nombre de la carpeta es el que se ve en el Finder.
    let name = path.file_stem()?.to_string_lossy().to_string();
    Some(AppRef { id, name, on: false })
}

/// Pide la contraseña de administrador una vez y corre el instalador del helper.
pub fn run_as_admin(script: &Path, arg: &Path) -> Result<(), String> {
    let lit = |p: &Path| format!("\"{}\"", p.to_string_lossy().replace('\\', "\\\\").replace('"', "\\\""));
    let source = format!(
        "do shell script \"/bin/bash \" & quoted form of {} & \" \" & quoted form of {} \
         with prompt \"Foco needs to install its helper to block sites in every browser.\" \
         with administrator privileges",
        lit(script),
        lit(arg)
    );
    let out = std::process::Command::new("/usr/bin/osascript")
        .args(["-e", &source])
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&out.stderr);
        if err.contains("-128") {
            Err("cancelled".into())
        } else {
            Err(err.trim().to_string())
        }
    }
}

pub fn chime() {
    let _ = std::process::Command::new("/usr/bin/afplay")
        .args(["-v", "0.35", "/System/Library/Sounds/Glass.aiff"])
        .spawn();
}
