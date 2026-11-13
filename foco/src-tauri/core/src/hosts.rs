//! /etc/hosts: normalizar dominios, expandirlos y mantener un bloque propio
//! entre dos marcas, sin tocar nada de lo que haya afuera.

pub const BEGIN: &str = "# >>> foco: bloqueo activo, no editar";
pub const END: &str = "# <<< foco";

/// Hosts que acompañan a un sitio conocido. /etc/hosts no acepta comodines,
/// así que los subdominios que importan hay que nombrarlos.
const ALIASES: &[(&str, &[&str])] = &[
    ("x.com", &["twitter.com", "www.twitter.com", "mobile.twitter.com", "mobile.x.com", "api.x.com"]),
    ("twitter.com", &["x.com", "www.x.com", "mobile.twitter.com"]),
    ("instagram.com", &["i.instagram.com", "graph.instagram.com"]),
    ("youtube.com", &["m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be", "youtubei.googleapis.com"]),
    ("linkedin.com", &["m.linkedin.com"]),
    ("facebook.com", &["m.facebook.com", "web.facebook.com", "fb.com", "www.fb.com"]),
    ("reddit.com", &["old.reddit.com", "new.reddit.com", "i.reddit.com"]),
    ("tiktok.com", &["m.tiktok.com", "vm.tiktok.com"]),
    ("twitch.tv", &["m.twitch.tv", "gql.twitch.tv"]),
    ("whatsapp.com", &["web.whatsapp.com"]),
    ("netflix.com", &[]),
];

/// De lo que escriba una persona ("https://www.X.com/home") al dominio pelado
/// ("x.com"). Devuelve None si no es un nombre de host válido: es lo único
/// que impide que un pedido cuele líneas propias en /etc/hosts.
pub fn normalize(input: &str) -> Option<String> {
    let mut s = input.trim().to_lowercase();
    if let Some(i) = s.find("://") {
        s = s[i + 3..].to_string();
    }
    if let Some(i) = s.find(['/', '?', '#']) {
        s.truncate(i);
    }
    if let Some(i) = s.rfind('@') {
        s = s[i + 1..].to_string();
    }
    if let Some(i) = s.find(':') {
        s.truncate(i);
    }
    let s = s.trim_end_matches('.').trim_start_matches("www.").to_string();
    is_hostname(&s).then_some(s)
}

pub fn is_hostname(s: &str) -> bool {
    if s.is_empty() || s.len() > 253 || !s.contains('.') {
        return false;
    }
    let labels: Vec<&str> = s.split('.').collect();
    let tld_ok = labels.last().is_some_and(|t| t.chars().any(|c| c.is_ascii_alphabetic()));
    tld_ok
        && labels.iter().all(|l| {
            !l.is_empty()
                && l.len() <= 63
                && !l.starts_with('-')
                && !l.ends_with('-')
                && l.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        })
        && !matches!(s, "localhost.localdomain" | "broadcasthost.local")
}

/// Todos los hosts que hay que bloquear para un sitio.
pub fn expand(site: &str) -> Vec<String> {
    let mut out = vec![site.to_string(), format!("www.{site}")];
    if let Some((_, extra)) = ALIASES.iter().find(|(k, _)| *k == site) {
        out.extend(extra.iter().map(|s| s.to_string()));
    }
    out.sort();
    out.dedup();
    out
}

/// El sitio de la lista al que pertenece un host visto en la red.
pub fn site_for<'a>(host: &str, sites: &'a [String]) -> Option<&'a str> {
    let host = host.trim_end_matches('.').to_lowercase();
    sites
        .iter()
        .find(|s| expand(s).iter().any(|h| *h == host) || host.ends_with(&format!(".{s}")))
        .map(|s| s.as_str())
}

/// El bloque que se agrega a /etc/hosts. Vacío si no hay sitios.
pub fn block(sites: &[String]) -> String {
    if sites.is_empty() {
        return String::new();
    }
    let mut out = format!("{BEGIN}\n");
    for site in sites {
        for host in expand(site) {
            out.push_str(&format!("127.0.0.1 {host}\n::1 {host}\n"));
        }
    }
    out.push_str(END);
    out.push('\n');
    out
}

/// Saca el bloque de Foco y deja el resto como estaba.
pub fn strip(content: &str) -> String {
    let mut out = String::with_capacity(content.len());
    let mut inside = false;
    for line in content.split_inclusive('\n') {
        let t = line.trim();
        if t.starts_with("# >>> foco") {
            inside = true;
        } else if t.starts_with("# <<< foco") {
            inside = false;
        } else if !inside {
            out.push_str(line);
        }
    }
    out
}

/// El contenido de /etc/hosts con el bloque para estos sitios (o sin bloque).
pub fn apply(content: &str, sites: &[String]) -> String {
    let mut base = strip(content);
    let block = block(sites);
    if block.is_empty() {
        return base;
    }
    while base.ends_with("\n\n") {
        base.pop();
    }
    if !base.is_empty() && !base.ends_with('\n') {
        base.push('\n');
    }
    if !base.is_empty() {
        base.push('\n');
    }
    base + &block
}

#[cfg(test)]
mod tests {
    use super::*;

    const ORIGINAL: &str = "##\n# Host Database\n##\n127.0.0.1\tlocalhost\n255.255.255.255\tbroadcasthost\n::1             localhost\n";

    fn sites(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn normalize_takes_what_people_type() {
        assert_eq!(normalize("https://www.X.com/home?x=1").as_deref(), Some("x.com"));
        assert_eq!(normalize(" instagram.com. ").as_deref(), Some("instagram.com"));
        assert_eq!(normalize("user@news.ycombinator.com:443/item").as_deref(), Some("news.ycombinator.com"));
    }

    #[test]
    fn normalize_rejects_anything_that_could_inject_a_line() {
        for bad in ["", "localhost", "x", "a b.com", "evil.com\n0.0.0.0 apple.com", "-a.com", "a..com", "127.0.0.1", "ñ.com", "a_b.com"] {
            assert_eq!(normalize(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn apply_then_strip_gives_back_the_original() {
        let with = apply(ORIGINAL, &sites(&["x.com", "youtube.com"]));
        assert!(with.starts_with(ORIGINAL));
        assert!(with.contains("127.0.0.1 x.com\n"));
        assert!(with.contains("::1 www.youtube.com\n"));
        assert!(with.contains("127.0.0.1 twitter.com\n"));
        assert_eq!(strip(&with), format!("{ORIGINAL}\n"));
        assert_eq!(apply(&with, &[]), format!("{ORIGINAL}\n"));
    }

    #[test]
    fn apply_is_idempotent_and_replaces_the_old_block() {
        let a = apply(ORIGINAL, &sites(&["x.com"]));
        assert_eq!(apply(&a, &sites(&["x.com"])), a);
        let b = apply(&a, &sites(&["linkedin.com"]));
        assert!(!b.contains("x.com"));
        assert_eq!(b.matches(BEGIN).count(), 1);
    }

    #[test]
    fn site_for_maps_hosts_back_to_the_list() {
        let list = sites(&["x.com", "youtube.com"]);
        assert_eq!(site_for("www.twitter.com", &list), Some("x.com"));
        assert_eq!(site_for("Studio.YouTube.com", &list), Some("youtube.com"));
        assert_eq!(site_for("notx.com", &list), None);
        assert_eq!(site_for("example.com", &list), None);
    }
}
