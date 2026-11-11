// Registro con lazy import. Los slugs coinciden con envs/NN-slug/ del paquete.
export const ENVS = [
  ["01", "limaduras", "limaduras"], ["02", "viento-vivo", "viento vivo"], ["03", "orbita-saturada", "órbita saturada"],
  ["04", "huella-de-voz", "huella de voz"], ["05", "superilla", "superilla"], ["06", "bifurcacion", "bifurcación"],
  ["07", "atractor", "atractor"], ["08", "polirritmo", "polirritmo"], ["09", "gramatica-de-plantas", "gramática de plantas"],
  ["10", "nervaduras", "nervaduras"], ["11", "metros-por-sueldo", "metros por sueldo"], ["12", "estratos", "estratos"],
  ["13", "feedback", "feedback"], ["14", "markov-de-notas", "markov de notas"], ["15", "anagrama", "anagrama"],
  ["16", "multi-anagrama", "multi-anagrama"], ["17", "live-tags", "live tags"],
].map(([num, id, title]) => ({ num, id, title, load: () => import(`./envs/${id}/index.ts`) }));

// Slots externos (plugins/): desactivados hasta que el proyecto exponga env.ts.
export const EXTERNAL = [
  { num: "P1", id: "physarum-metro", title: "physarum metro", path: "../physarum-metro/src/env.ts" },
  { num: "P2", id: "harmonografo", title: "harmonógrafo", path: "../harmonografo/src/env.ts" },
];
