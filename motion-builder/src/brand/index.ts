import { parseProject, type Project } from '../core/project';
import reboot from './templates/reboot.json';
import tmsc from './templates/tmsc.json';

export type Palette = { name: string; tones: '2' | '3'; c0: string; c1: string; c2: string; invert: boolean };

export type BrandTemplate = {
  id: string;
  name: string;
  palettes: Palette[];
  fonts: string[];
  formats: [number, number][];
  rules: string[];
  pending: string[]; // lo que falta definir: se muestra en el editor
  projects: { name: string; project: Project }[];
};

const load = (raw: unknown) => {
  const t = raw as BrandTemplate;
  return { ...t, projects: t.projects.map((p) => ({ name: p.name, project: parseProject(p.project) })) };
};

export const templates: BrandTemplate[] = [load(reboot), load(tmsc)];

export const templateOf = (project: Project) => templates.find((t) => t.id === project.brandTemplateId) ?? null;
