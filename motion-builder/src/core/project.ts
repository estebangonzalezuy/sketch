import { z } from 'zod';
import type { ParamValue } from './tool';
import type { Ease } from './easing';

export type Keyframe = {
  frame: number; // relativo al inicio del clip
  value: ParamValue;
  ease: Ease; // curva del tramo que sale de este key
};
export type ParamTrack = { value: ParamValue } | { keys: Keyframe[] };

const paramValue = z.union([z.number(), z.string(), z.boolean(), z.tuple([z.number(), z.number()])]);
const keyframe = z.object({
  frame: z.number().int().nonnegative(),
  value: paramValue,
  ease: z.union([z.tuple([z.number(), z.number(), z.number(), z.number()]), z.literal('hold')]),
});
const paramTrack = z.union([z.object({ value: paramValue }), z.object({ keys: z.array(keyframe).min(1) })]);
const input = z.union([z.object({ layerId: z.string() }), z.object({ assetId: z.string() })]).nullable();

const layer = z.object({
  id: z.string().min(1),
  name: z.string(),
  toolId: z.string().min(1),
  toolVersion: z.number().int(),
  start: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  offset: z.number().int().nonnegative().default(0), // frame de sus pistas en el que arranca el clip: cortar o recortar no reinicia el tiempo
  visible: z.boolean(), // false: alimenta otra capa pero no se compone
  blend: z.enum(['normal', 'add', 'multiply', 'screen']),
  opacity: paramTrack,
  zoom: paramTrack.default({ value: 1 }),
  center: paramTrack.default({ value: [0.5, 0.5] }), // punto de la capa que queda en el centro del cuadro
  seed: z.number().int(),
  loopFrames: z.number().int().positive().nullable(),
  inputs: z.record(z.string(), input),
  params: z.record(z.string(), paramTrack),
});

const projectV1 = z.object({
  version: z.literal(1),
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  durationFrames: z.number().int().positive(),
  brandTemplateId: z.string().nullable(),
  environmentId: z.string().optional(), // entorno: qué tools ofrece el editor (src/environments); sin valor, Inception
  assets: z.array(z.object({ id: z.string(), kind: z.literal('image'), path: z.string() })),
  layers: z.array(layer), // índice 0 = capa superior
});

export type Project = z.infer<typeof projectV1>;
export type Layer = Project['layers'][number];

/** Una entrada por versión vieja: migrations[n] lleva un proyecto de la versión n a la n + 1. */
const migrations: Record<number, (project: Record<string, unknown>) => Record<string, unknown>> = {};

export function parseProject(raw: unknown): Project {
  let project = raw as Record<string, unknown>;
  while (typeof project?.version === 'number' && migrations[project.version]) {
    project = migrations[project.version](project);
  }
  return projectV1.parse(project);
}
