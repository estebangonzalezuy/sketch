export type PaletteId = "ink_white" | "acid_ink" | "lilac_brown" | "magenta_green";

export type Palette = {
  id: PaletteId;
  name: string;
  fg: string;
  bg: string;
  /** Flat canvas-view background (the darker of the pair). */
  canvas: string;
  /** Marks / trails / tag fill on canvas view. */
  mark: string;
};

export const PALETTES: Record<PaletteId, Palette> = {
  ink_white: {
    id: "ink_white",
    name: "ink",
    fg: "#0C0C0C",
    bg: "#FFFFFF",
    canvas: "#0C0C0C",
    mark: "#FFFFFF",
  },
  acid_ink: {
    id: "acid_ink",
    name: "ácido",
    fg: "#E4FC24",
    bg: "#0C0C0C",
    canvas: "#0C0C0C",
    mark: "#E4FC24",
  },
  lilac_brown: {
    id: "lilac_brown",
    name: "lila",
    fg: "#CC84FC",
    bg: "#3C240C",
    canvas: "#3C240C",
    mark: "#CC84FC",
  },
  magenta_green: {
    id: "magenta_green",
    name: "magenta",
    fg: "#F06CCC",
    bg: "#0C540C",
    canvas: "#0C540C",
    mark: "#F06CCC",
  },
};

export const DEFAULT_PALETTE: Record<string, PaletteId> = {
  trayectorias: "magenta_green",
  medidas: "acid_ink",
  contador: "magenta_green",
  atlas: "ink_white",
};

export const FORBIDDEN = new Set(["#0000FF", "#3D3DEB", "#0000ff", "#3d3deb"]);

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
