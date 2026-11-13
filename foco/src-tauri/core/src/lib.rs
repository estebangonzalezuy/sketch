//! Lo que comparten la app y el helper privilegiado: el protocolo del socket,
//! la edición de /etc/hosts y la lectura del nombre de host de una conexión.

pub mod client;
pub mod hosts;
pub mod proto;
pub mod sniff;

pub use proto::*;

/// Socket del helper. Lo crea root con permisos 0666.
pub const SOCKET_PATH: &str = "/var/run/foco.sock";
/// Identificador de la app, que el helper usa para volver a abrirla.
pub const APP_BUNDLE_ID: &str = "co.estebangonzalez.foco";
pub const HELPER_LABEL: &str = "co.estebangonzalez.foco.helper";

/// Tiempo de enfriamiento antes de poder cortar una sesión sin escribir la frase.
pub const COOLDOWN_SECS: u64 = 120;
/// Pasado el enfriamiento, cuánto queda abierta la ventana para confirmar.
pub const COOLDOWN_WINDOW_SECS: u64 = 300;
pub const MIN_MINUTES: u32 = 1;
pub const MAX_MINUTES: u32 = 480;

/// La frase que hay que escribir, entera, para cortar una sesión.
pub const CANCEL_PHRASE: &str =
    "I would rather get distracted now and finish this later, rushed and in a bad mood.";

pub fn phrase_matches(input: &str) -> bool {
    let norm = |s: &str| s.split_whitespace().collect::<Vec<_>>().join(" ");
    norm(input) == norm(CANCEL_PHRASE)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phrase_needs_every_word() {
        assert!(phrase_matches(CANCEL_PHRASE));
        assert!(phrase_matches(&format!("  {}  ", CANCEL_PHRASE.replace(' ', "  "))));
        assert!(!phrase_matches("I would rather get distracted now"));
        assert!(!phrase_matches(&CANCEL_PHRASE.to_lowercase()));
        assert!(!phrase_matches(""));
    }
}
