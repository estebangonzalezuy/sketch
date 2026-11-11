import type { Params } from "./harmono";
const base = { tEnd: 600, cutoff: 0.04, penWidth: 1.2, drawSeconds: 10, holdSeconds: 2, timeMode: "fisico" as const, palette: 0, invert: false, caption: true, margin: 0.08 };
export const PRESETS: Params[] = [
  { ...base, name: "blackburn 2:3", pendulums: [
    { axis: "x", freq: 2.0, phase: 0, amp: 1, damp: 0.004 },
    { axis: "y", freq: 3.006, phase: 1.57, amp: 1, damp: 0.004 } ] },
  { ...base, name: "rosa rotativa", palette: 1, pendulums: [
    { axis: "x", freq: 3.001, phase: 0, amp: 0.8, damp: 0.003 },
    { axis: "y", freq: 2.0, phase: 0.5, amp: 0.8, damp: 0.0035 },
    { axis: "rot", freq: 2.997, phase: 1.2, amp: 0.55, damp: 0.0025 } ] },
  { ...base, name: "unísono casi", palette: 2, penWidth: 1, pendulums: [
    { axis: "x", freq: 2.0, phase: 0, amp: 1, damp: 0.0022 },
    { axis: "y", freq: 2.004, phase: 1.2, amp: 1, damp: 0.0022 },
    { axis: "x", freq: 6.0, phase: 0.3, amp: 0.25, damp: 0.006 } ] },
  { ...base, name: "cuatro péndulos", palette: 3, pendulums: [
    { axis: "x", freq: 2.01, phase: 0, amp: 1, damp: 0.0035 },
    { axis: "x", freq: 3.0, phase: 1.1, amp: 0.6, damp: 0.0045 },
    { axis: "y", freq: 3.0, phase: 0.4, amp: 1, damp: 0.003 },
    { axis: "y", freq: 2.0, phase: 2.3, amp: 0.6, damp: 0.0055 } ] },
  { ...base, name: "mesa contra péndulo", pendulums: [
    { axis: "x", freq: 3.0, phase: 0, amp: 0.9, damp: 0.0026 },
    { axis: "y", freq: 2.002, phase: 1.0, amp: 0.7, damp: 0.003 },
    { axis: "rot", freq: -1.001, phase: 0.2, amp: 0.55, damp: 0.0018 } ] },
  { ...base, name: "3:4 lento", palette: 1, invert: true, pendulums: [
    { axis: "x", freq: 3.0, phase: 0.6, amp: 1, damp: 0.0018 },
    { axis: "y", freq: 4.003, phase: 0, amp: 1, damp: 0.0018 } ] },
];
