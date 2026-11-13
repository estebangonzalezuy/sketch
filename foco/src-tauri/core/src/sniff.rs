//! Saber a qué host iba una conexión que cayó en 127.0.0.1: el SNI de un
//! ClientHello de TLS (sin certificado ni descifrar nada) o el Host de HTTP.

pub fn host_of(buf: &[u8]) -> Option<String> {
    tls_sni(buf).or_else(|| http_host(buf))
}

struct Reader<'a>(&'a [u8]);

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Option<&'a [u8]> {
        if self.0.len() < n {
            return None;
        }
        let (head, tail) = self.0.split_at(n);
        self.0 = tail;
        Some(head)
    }
    fn u8(&mut self) -> Option<usize> {
        self.take(1).map(|b| b[0] as usize)
    }
    fn u16(&mut self) -> Option<usize> {
        self.take(2).map(|b| ((b[0] as usize) << 8) | b[1] as usize)
    }
    /// Lo que quede, hasta `n` bytes: el ClientHello puede llegar cortado y
    /// el SNI casi siempre está en el primer tramo.
    fn up_to(&mut self, n: usize) -> Reader<'a> {
        let n = n.min(self.0.len());
        let (head, tail) = self.0.split_at(n);
        self.0 = tail;
        Reader(head)
    }
}

pub fn tls_sni(buf: &[u8]) -> Option<String> {
    let mut r = Reader(buf);
    if r.u8()? != 0x16 {
        return None; // no es un registro de handshake
    }
    r.take(2)?; // versión del registro
    let len = r.u16()?;
    let mut r = r.up_to(len);
    if r.u8()? != 0x01 {
        return None; // no es un ClientHello
    }
    r.take(3)?; // largo del handshake
    r.take(2 + 32)?; // versión y random
    let n = r.u8()?;
    r.take(n)?; // session id
    let n = r.u16()?;
    r.take(n)?; // cipher suites
    let n = r.u8()?;
    r.take(n)?; // compresión
    let n = r.u16()?;
    let mut exts = r.up_to(n);
    loop {
        let kind = exts.u16()?;
        let len = exts.u16()?;
        let mut body = Reader(exts.take(len)?);
        if kind != 0 {
            continue;
        }
        body.u16()?; // largo de la lista
        if body.u8()? != 0 {
            return None; // tipo de nombre desconocido
        }
        let n = body.u16()?;
        let name = std::str::from_utf8(body.take(n)?).ok()?.to_lowercase();
        return crate::hosts::is_hostname(&name).then_some(name);
    }
}

pub fn http_host(buf: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(buf);
    let mut lines = text.split("\r\n");
    let first = lines.next()?;
    if !first.contains(" HTTP/1.") {
        return None;
    }
    for line in lines {
        if line.is_empty() {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            if k.eq_ignore_ascii_case("host") {
                let host = v.trim().split(':').next()?.to_lowercase();
                return crate::hosts::is_hostname(&host).then_some(host);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Un ClientHello mínimo con una extensión de relleno antes del SNI.
    fn client_hello(name: &str) -> Vec<u8> {
        let n = name.as_bytes();
        let mut sni = vec![0, 0];
        sni.extend(((n.len() + 5) as u16).to_be_bytes());
        sni.extend(((n.len() + 3) as u16).to_be_bytes());
        sni.push(0);
        sni.extend((n.len() as u16).to_be_bytes());
        sni.extend(n);
        let mut exts = vec![0x00, 0x0b, 0, 2, 1, 0]; // ec_point_formats
        exts.extend(sni);

        let mut body = vec![3, 3];
        body.extend([7u8; 32]);
        body.push(4);
        body.extend([1, 2, 3, 4]);
        body.extend([0, 4, 0x13, 0x01, 0x13, 0x02]);
        body.extend([1, 0]);
        body.extend((exts.len() as u16).to_be_bytes());
        body.extend(exts);

        let mut hs = vec![1, 0];
        hs.extend((body.len() as u16).to_be_bytes());
        hs.extend(body);
        let mut rec = vec![0x16, 3, 1];
        rec.extend((hs.len() as u16).to_be_bytes());
        rec.extend(hs);
        rec
    }

    #[test]
    fn reads_the_sni() {
        assert_eq!(tls_sni(&client_hello("www.Instagram.com")).as_deref(), Some("www.instagram.com"));
    }

    #[test]
    fn survives_garbage_and_truncation() {
        let hello = client_hello("x.com");
        for cut in 0..hello.len() - 1 {
            let _ = tls_sni(&hello[..cut]);
        }
        assert_eq!(tls_sni(&hello[..hello.len() - 1]), None);
        assert_eq!(tls_sni(b"GET / HTTP/1.1\r\n\r\n"), None);
        assert_eq!(tls_sni(&[0x16, 3, 1, 0xff, 0xff, 1, 0, 0]), None);
        assert_eq!(host_of(&[]), None);
    }

    #[test]
    fn reads_the_http_host() {
        let req = b"GET /watch HTTP/1.1\r\nUser-Agent: x\r\nhOsT: YouTube.com:80\r\n\r\nHost: evil.com";
        assert_eq!(host_of(req).as_deref(), Some("youtube.com"));
        assert_eq!(http_host(b"GET / HTTP/1.1\r\n\r\nHost: evil.com\r\n"), None);
    }
}
