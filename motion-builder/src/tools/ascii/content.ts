import { mulberry32 } from '../../core/random';

/** Contenido de las líneas y scramble, sin DOM ni three. Copiado del original, con azar determinista. */

export const CHARS = {
    alpha: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    numeric: "0123456789",
    symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?/~`'\"\\",
    hex: "0123456789ABCDEFabcdef",
} as const

export const PATTERN_CHARS =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"

const WORD_FRAGMENTS = [
    "function",
    "const",
    "let",
    "var",
    "return",
    "async",
    "await",
    "import",
    "export",
    "class",
    "extends",
    "interface",
    "type",
    "enum",
    "struct",
    "void",
    "int",
    "char",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "default",
    "try",
    "catch",
    "throw",
    "finally",
    "new",
    "delete",
    "typeof",
    "instanceof",
    "public",
    "private",
    "protected",
    "static",
    "readonly",
    "abstract",
    "virtual",
    "null",
    "undefined",
    "true",
    "false",
    "NaN",
    "Infinity",
    "void",
    "never",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "Symbol",
    "Map",
    "Set",
    "Promise",
    "Observable",
    "Stream",
    "Buffer",
    "Event",
    "Error",
    "Exception",
    "document",
    "window",
    "console",
    "process",
    "module",
    "require",
    "exports",
    "TCP",
    "HTTP",
    "HTTPS",
    "SSH",
    "FTP",
    "DNS",
    "API",
    "REST",
    "JSON",
    "XML",
    "kernel",
    "socket",
    "buffer",
    "stream",
    "pipe",
    "fork",
    "exec",
    "spawn",
    "kill",
    "malloc",
    "free",
    "sizeof",
    "typedef",
    "volatile",
    "extern",
    "inline",
    "register",
    "SELECT",
    "FROM",
    "WHERE",
    "JOIN",
    "INSERT",
    "UPDATE",
    "DELETE",
    "CREATE",
    "DROP",
    "the",
    "and",
    "for",
    "are",
    "but",
    "not",
    "you",
    "all",
    "can",
    "had",
    "her",
    "was",
    "with",
    "this",
    "that",
    "have",
    "from",
    "they",
    "been",
    "would",
    "there",
    "their",
    "which",
    "when",
    "make",
    "like",
    "time",
    "just",
    "know",
    "take",
    "into",
    "year",
    "your",
    "some",
    "them",
    "than",
    "then",
    "only",
    "come",
    "over",
    "such",
    "also",
    "back",
    "after",
    "most",
    "made",
    "being",
    "where",
    "through",
    "before",
    "between",
] as const

const OPERATORS = [
    "=>",
    "->",
    "::",
    "&&",
    "||",
    "==",
    "!=",
    "<=",
    ">=",
    "++",
    "--",
    "+=",
    "-=",
    "*=",
    "/=",
    "<<",
    ">>",
    "**",
    "?.",
    "??",
    "...",
    "|>",
    "<|",
] as const

const PUNCTUATION = '.,;:!?';

export type Cell = { original: string; isSpace: boolean; sinPhase: number; cosPhase: number };
export type Line = Cell[];

/** Una línea de texto. Mismas proporciones que generateContent, con un generador por línea. */
function generateContent(random: () => number, length: number) {
  const pick = <T,>(list: ArrayLike<T>, n = list.length) => list[Math.floor(random() * n)];
  let content = '';
  if (random() < 0.12) content = ' '.repeat(2 + Math.floor(random() * 4));

  while (content.length < length - 15) {
    const r = random();
    if (r < 0.3) {
      content += pick(WORD_FRAGMENTS);
    } else if (r < 0.45) {
      const n = 2 + Math.floor(random() * 10);
      for (let i = 0; i < n; i++) content += pick(PATTERN_CHARS);
    } else if (r < 0.55) {
      content += '0x';
      const n = 2 + Math.floor(random() * 6);
      for (let i = 0; i < n; i++) content += pick(CHARS.hex);
    } else if (r < 0.65) {
      content += pick(OPERATORS);
    } else if (r < 0.75) {
      const brackets = random() < 0.33 ? ['(', ')'] : random() < 0.5 ? ['[', ']'] : ['{', '}'];
      content += brackets[0];
      const n = 1 + Math.floor(random() * 8);
      for (let i = 0; i < n; i++) content += random() < 0.3 ? pick(WORD_FRAGMENTS, 30) : pick(PATTERN_CHARS);
      content += brackets[1];
    } else if (r < 0.85) {
      content += pick(WORD_FRAGMENTS, 40);
      if (random() < 0.4) content += `_${pick(WORD_FRAGMENTS, 20)}`;
      if (random() < 0.3) content += Math.floor(random() * 1000);
    } else {
      const n = 1 + Math.floor(random() * 4);
      for (let i = 0; i < n; i++) content += pick(CHARS.symbols);
    }

    if (content.length < length - 10) {
      const s = random();
      if (s < 0.45) content += ' ';
      else if (s < 0.6) content += `${pick(PUNCTUATION)} `;
      else if (s < 0.75) content += '  ';
      else if (s < 0.85) content += ' | ';
      else content += ' - ';
    }
  }
  while (content.length < length) content += pick(PATTERN_CHARS);
  return content.substring(0, length);
}

/** Grilla de texto para un seed. En modo color los caracteres salen del set de densidad. */
export function buildLines(seed: number, rows: number, columns: number, density: string | null): Line[] {
  const lines: Line[] = [];
  for (let row = 0; row < rows; row++) {
    const random = mulberry32(Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(row + 1, 0x85ebca77));
    const content = generateContent(random, columns);
    const linePhase = random() * Math.PI * 2;
    lines.push(
      content.split('').map((ch, i) => {
        const phase = linePhase + (i / content.length) * Math.PI + random() * 0.5;
        const pickDensity = density && ch !== ' ' ? density[Math.floor(random() * density.length)] : ch;
        return { original: pickDensity, isSpace: ch === ' ', sinPhase: Math.sin(phase), cosPhase: Math.cos(phase) };
      }),
    );
  }
  return lines;
}

function mix(a: number, b: number, c: number, d: number) {
  let h = Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca77) ^ Math.imul(c, 0xc2b2ae3d) ^ Math.imul(d, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77);
  h ^= h >>> 13;
  return h >>> 0;
}

const WAVE_RATE = 0.002; // radianes por milisegundo, como el original
const MAX_CHANCE = 0.2;

/** Reloj del scramble: qué step toca, y la onda de los steps anteriores precalculada. */
export type ScrambleClock = { step: number; steps: number | null; sin: Float64Array; cos: Float64Array };

export function scrambleClock(timeMs: number, stepMs: number, loop: { phase: number; frames: number; fps: number } | null): ScrambleClock {
  const steps = loop ? Math.max(1, Math.round(((loop.frames / loop.fps) * 1000) / stepMs)) : null;
  const step = steps !== null ? Math.floor(loop!.phase * steps) : Math.floor(timeMs / stepMs);
  // Un período de onda: más atrás de eso, el carácter ya no se conserva.
  const period = Math.ceil((Math.PI * 2) / WAVE_RATE / stepMs);
  const depth = Math.min(period, steps ?? period, step + 1 + (steps ?? 0));
  const sin = new Float64Array(depth);
  const cos = new Float64Array(depth);
  // En loop, la onda da una cantidad entera de vueltas por loop para que cierre.
  const rate = steps !== null ? (Math.PI * 2 * Math.max(1, Math.round((WAVE_RATE * steps * stepMs) / (Math.PI * 2)))) / steps : WAVE_RATE * stepMs;
  for (let k = 0; k < depth; k++) {
    const s = steps !== null ? (step - k + steps) % steps : step - k;
    sin[k] = Math.sin(s * rate);
    cos[k] = Math.cos(s * rate);
  }
  return { step, steps, sin, cos };
}

/**
 * Carácter de una celda: camina hacia atrás hasta el último step que la cambió.
 * Cada step decide con un hash, sin memoria: scrub y export dan lo mismo.
 */
export function charAt(cell: Cell, seed: number, row: number, column: number, clock: ScrambleClock, chars: string) {
  if (cell.isSpace || chars.length === 0) return cell.original;
  const { step, steps, sin, cos } = clock;
  for (let k = 0; k < sin.length; k++) {
    const s = steps !== null ? (step - k + steps) % steps : step - k;
    const h = mix(seed, row, column, s);
    const wave = sin[k] * cell.cosPhase + cos[k] * cell.sinPhase; // sin(t + fase)
    if (h / 4294967296 < ((wave + 1) / 2) * MAX_CHANCE) return chars[(Math.imul(h, 0x9e3779b1) >>> 16) % chars.length];
  }
  return cell.original;
}
