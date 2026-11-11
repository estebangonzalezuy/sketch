export type FormatId = "4x5" | "9x16" | "16x9";

export const FORMATS: Record<FormatId, { label: string; width: number; height: number }> = {
  "4x5": { label: "4:5", width: 1080, height: 1350 },
  "9x16": { label: "9:16", width: 1080, height: 1920 },
  "16x9": { label: "16:9", width: 1920, height: 1080 },
};

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

export function isFormat(v: unknown): v is FormatId {
  return typeof v === "string" && v in FORMATS;
}
