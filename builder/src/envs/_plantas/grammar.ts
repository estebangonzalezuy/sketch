// Gramática compartida por Gramática de Plantas (2D) y Plantas 3D: misma palabra = misma regla.
// Axioma X; X → F + fragmentos de cada letra (tabla legible) + X; F → FF.

/** La tabla (para el video): qué hace cada letra. + gira a la izquierda, − a la derecha, [ ] abre y cierra rama. */
export const TABLA: Record<string, string> = {
  A: "[+X]", B: "[-X]", C: "F", D: "[++X]", E: "[+X]", F: "[--X]", G: "+X", H: "-X", I: "F[+F]",
  J: "[-F]", K: "[+X]F", L: "F[-X]", M: "[+X][-X]", N: "[-X]", O: "F", P: "[++X]", Q: "[--X]", R: "+F",
  S: "[+X]", T: "F[-X]", U: "-F", V: "[+F]", W: "[-X][+X]", X: "[+X]", Y: "[-X]", Z: "+X",
};

export function clean(word: string) {
  return word
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Á → A, Ñ → N
    .replace(/[^A-Z]/g, "");
}

export function hash(s: string) {
  let h = 0x811c9dc5;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export interface Grammar {
  rule: string;
  /** correcciones visibles (ramas agregadas) */
  fix: string[];
  depth: number;
  cut: boolean;
  /** ángulo de giro en grados: el del dial ± 4° según el hash de la palabra */
  angle: number;
  hash: number;
  /** string expandido */
  expanded: string;
}

/** Regla + validación visible + expansión con corte duro (si pasa de maxSymbols se recorta la profundidad). */
export function grammar(word: string, profundidad: number, ángulo: number, maxSymbols = 120000): Grammar {
  const w = clean(word);
  let rule = "F" + [...w].map((c) => TABLA[c] ?? "").join("");
  const fix: string[] = [];
  if ((rule.match(/\[[^\]]*X/g) ?? []).length < 1) {
    rule += "[+X][-X]";
    fix.push("sin ramas: se agregó [+X][−X]");
  } else {
    // ramas de un solo lado: la planta se cae; se agrega la del otro lado (y se dice)
    const left = /\[\+/.test(rule);
    const right = /\[-/.test(rule);
    if (left && !right) {
      rule += "[-X]";
      fix.push("ramas solo a la izquierda: se agregó [−X]");
    } else if (right && !left) {
      rule += "[+X]";
      fix.push("ramas solo a la derecha: se agregó [+X]");
    }
  }
  rule += "X";
  const h = hash(w);
  const angle = ángulo + (((h % 1000) / 1000) * 2 - 1) * 4;

  let depth = Math.round(profundidad);
  let cut = false;
  let s = "X";
  for (;;) {
    s = "X";
    let over = false;
    for (let i = 0; i < depth; i++) {
      let next = "";
      for (const c of s) next += c === "X" ? rule : c === "F" ? "FF" : c;
      s = next;
      if (s.length > maxSymbols) {
        over = true;
        break;
      }
    }
    if (!over || depth <= 1) break;
    depth--;
    cut = true;
  }
  return { rule, fix, depth, cut, angle, hash: h, expanded: s };
}
