//! Lo que el panel recuerda entre sesiones. Vive en un JSON local, en la
//! carpeta de configuración de la app. La app lo lee para arrancar con el atajo.

use foco_core::{Mode, StartArgs};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Site {
    pub domain: String,
    pub on: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppRef {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub on: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub minutes: u32,
    pub mode: Mode,
    pub sites: Vec<Site>,
    pub apps: Vec<AppRef>,
    pub one_app: Option<AppRef>,
    pub accent: String,
    /// Los springs y easings del panel oculto. Solo los interpreta el frontend.
    pub tuning: serde_json::Value,
}

impl Default for Config {
    fn default() -> Self {
        let site = |d: &str| Site { domain: d.into(), on: true };
        let app = |id: &str, name: &str, on| AppRef { id: id.into(), name: name.into(), on };
        Config {
            minutes: 50,
            mode: Mode::List,
            sites: vec![site("x.com"), site("instagram.com"), site("youtube.com"), site("linkedin.com")],
            apps: vec![
                app("com.apple.MobileSMS", "Mensajes", true),
                app("com.tinyspeck.slackmacgap", "Slack", true),
                app("net.whatsapp.WhatsApp", "WhatsApp", false),
                app("com.hnc.Discord", "Discord", false),
            ],
            one_app: None,
            accent: "#E4FC24".into(),
            tuning: serde_json::Value::Null,
        }
    }
}

impl Config {
    pub fn start_args(&self) -> StartArgs {
        StartArgs {
            minutes: self.minutes,
            mode: Some(self.mode),
            sites: self.sites.iter().filter(|s| s.on).map(|s| s.domain.clone()).collect(),
            apps: self.apps.iter().filter(|a| a.on).map(|a| a.id.clone()).collect(),
            one_app: self.one_app.as_ref().map(|a| a.id.clone()),
            one_app_name: self.one_app.as_ref().map(|a| a.name.clone()),
        }
    }
}

fn path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("config.json"))
}

pub fn load(app: &AppHandle) -> Config {
    path(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(app: &AppHandle, config: &Config) -> Result<(), String> {
    let path = path(app).ok_or("no encuentro la carpeta de configuración")?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}
