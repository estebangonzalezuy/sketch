use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    /// Bloquea una lista de sitios y de apps.
    List,
    /// Deja una sola app a la vista y oculta el resto.
    One,
}

/// Un pedido por línea, en JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum Request {
    Status,
    Start(StartArgs),
    /// Arranca los dos minutos de enfriamiento.
    BeginCooldown,
    /// Corta la sesión: con la frase, o sin ella si el enfriamiento ya pasó.
    Cancel { phrase: Option<String> },
    /// La app avisa que se intentó abrir una app bloqueada.
    Attempt { target: String },
    /// La app ya mostró el resumen de la última sesión.
    AckSummary,
    History,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StartArgs {
    pub minutes: u32,
    pub mode: Option<Mode>,
    #[serde(default)]
    pub sites: Vec<String>,
    /// Bundle ids de las apps bloqueadas (modo lista).
    #[serde(default)]
    pub apps: Vec<String>,
    /// Bundle id de la única app permitida (modo una cosa).
    #[serde(default)]
    pub one_app: Option<String>,
    #[serde(default)]
    pub one_app_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Attempt {
    /// Crece con cada intento; la app lo usa para saber si ya lo mostró.
    pub seq: u32,
    pub target: String,
    /// "site" o "app".
    pub kind: String,
    pub at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: u64,
    pub started_at: u64,
    pub ends_at: u64,
    pub mode: Mode,
    pub sites: Vec<String>,
    pub apps: Vec<String>,
    pub one_app: Option<String>,
    #[serde(default)]
    pub one_app_name: Option<String>,
    pub attempts: u32,
    pub last_attempt: Option<Attempt>,
    pub cooldown_started: Option<u64>,
}

/// Una sesión terminada, como queda en el historial.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Record {
    pub id: u64,
    pub started_at: u64,
    pub ended_at: u64,
    pub planned_secs: u64,
    pub mode: Mode,
    pub attempts: u32,
    pub cancelled: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Status {
    pub version: String,
    pub now: u64,
    pub session: Option<Session>,
    /// La última sesión terminada, hasta que la app confirma que mostró el resumen.
    pub last_finished: Option<Record>,
    /// Falso si no se pudieron abrir los puertos 80 y 443 locales: los sitios se
    /// bloquean igual, pero no se detectan los intentos.
    pub sniffer_ok: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Response {
    pub ok: bool,
    #[serde(default)]
    pub error: Option<String>,
    pub status: Status,
    #[serde(default)]
    pub history: Option<Vec<Record>>,
}
