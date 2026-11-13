//! El ícono de la barra de menú: un anillo que se va cerrando a medida que
//! pasa la sesión, dibujado a mano como imagen plantilla (macOS le pone el
//! color de la barra), y al lado el tiempo que queda.

use foco_core::Session;
use tauri::image::Image;

const SIZE: usize = 44; // 22 pt a 2x
const SS: usize = 4; // supermuestreo por eje

/// `remaining` de 0 a 1: la parte del anillo que sigue encendida. None es el
/// ícono en reposo: el anillo entero, fino, con el punto en el centro.
pub fn icon(remaining: Option<f32>) -> Image<'static> {
    let mut rgba = vec![0u8; SIZE * SIZE * 4];
    let c = SIZE as f32 / 2.0;
    let (radius, half) = match remaining {
        Some(_) => (14.5, 2.4),
        None => (14.5, 1.5),
    };
    let dot = if remaining.is_some() { 4.2 } else { 3.4 };
    for y in 0..SIZE {
        for x in 0..SIZE {
            let mut acc = 0.0f32;
            for sy in 0..SS {
                for sx in 0..SS {
                    let px = x as f32 + (sx as f32 + 0.5) / SS as f32 - c;
                    let py = y as f32 + (sy as f32 + 0.5) / SS as f32 - c;
                    let d = (px * px + py * py).sqrt();
                    let mut a = 0.0f32;
                    if d <= dot {
                        a = 1.0;
                    } else if (d - radius).abs() <= half {
                        a = match remaining {
                            None => 1.0,
                            Some(rem) => {
                                // Ángulo desde las 12, en sentido horario, de 0 a 1.
                                let t = (px.atan2(-py) / std::f32::consts::TAU).rem_euclid(1.0);
                                // Lo ya transcurrido se apaga desde las 12.
                                if t >= 1.0 - rem { 1.0 } else { 0.26 }
                            }
                        };
                    }
                    acc += a;
                }
            }
            let i = (y * SIZE + x) * 4;
            rgba[i + 3] = (acc / (SS * SS) as f32 * 255.0).round() as u8;
        }
    }
    Image::new_owned(rgba, SIZE as u32, SIZE as u32)
}

/// Fracción de la sesión que queda, redondeada a pasos que se notan en 44 px
/// para no redibujar el ícono en cada vuelta.
pub fn remaining(s: &Session, now: u64) -> f32 {
    let total = s.ends_at.saturating_sub(s.started_at).max(1) as f32;
    let left = s.ends_at.saturating_sub(now) as f32;
    ((left / total).clamp(0.0, 1.0) * 180.0).ceil() / 180.0
}

/// Minutos mientras falte más de uno; en el último minuto, segundos. Un reloj
/// que cambia cada segundo en la barra de menú sería otra distracción.
pub fn title(s: &Session, now: u64) -> String {
    let left = s.ends_at.saturating_sub(now);
    if left > 60 {
        format!("{} min", left.div_ceil(60))
    } else {
        format!("{left} s")
    }
}
