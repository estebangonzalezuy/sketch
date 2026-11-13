//! Cliente del socket del helper: un pedido, una respuesta.

use crate::proto::{Request, Response};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::time::Duration;

pub fn request(socket: &str, req: &Request) -> Result<Response, String> {
    let io = |e: std::io::Error| e.to_string();
    let mut stream = UnixStream::connect(socket).map_err(|_| "helper no instalado".to_string())?;
    stream.set_read_timeout(Some(Duration::from_secs(3))).map_err(io)?;
    stream.set_write_timeout(Some(Duration::from_secs(3))).map_err(io)?;
    let mut line = serde_json::to_string(req).map_err(|e| e.to_string())?;
    line.push('\n');
    stream.write_all(line.as_bytes()).map_err(io)?;
    let mut answer = String::new();
    BufReader::new(stream).read_line(&mut answer).map_err(io)?;
    serde_json::from_str(&answer).map_err(|e| format!("respuesta inválida del helper: {e}"))
}
