// El puente con Rust. Fuera de Tauri (npm run dev en un navegador) usa un
// helper simulado en memoria, para poder diseñar la interfaz sin compilar la app.

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen } from '@tauri-apps/api/event';
import type { AppRef, Config, SessionRecord, Snapshot } from './types';
import { CANCEL_PHRASE, COOLDOWN_SECS } from './types';

type Commands = {
  snapshot: { args: void; out: Snapshot };
  get_config: { args: void; out: Config };
  set_config: { args: { config: Config }; out: void };
  start: { args: void; out: Snapshot };
  begin_cooldown: { args: void; out: Snapshot };
  cancel: { args: { phrase: string | null }; out: Snapshot };
  ack_summary: { args: void; out: Snapshot };
  history: { args: void; out: SessionRecord[] };
  installed_apps: { args: void; out: AppRef[] };
  install_helper: { args: void; out: Snapshot };
  resize_panel: { args: { height: number }; out: void };
  hide_panel: { args: void; out: void };
  preview_block: { args: void; out: void };
  hide_block: { args: void; out: void };
  quit: { args: void; out: void };
};

type Events = { status: Snapshot; view: 'main' | 'tuning'; block: boolean; config: Config };

export const inTauri = '__TAURI_INTERNALS__' in window;

export function call<K extends keyof Commands>(
  cmd: K,
  ...args: Commands[K]['args'] extends void ? [] : [Commands[K]['args']]
): Promise<Commands[K]['out']> {
  if (inTauri) return tauriInvoke(cmd, args[0] as Record<string, unknown> | undefined);
  return mock(cmd, args[0]) as Promise<Commands[K]['out']>;
}

export function on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void {
  if (inTauri) {
    const off = tauriListen<Events[K]>(event, (e) => handler(e.payload));
    return () => void off.then((f) => f());
  }
  const listener = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(`foco:${event}`, listener);
  return () => window.removeEventListener(`foco:${event}`, listener);
}

// ── Simulación ───────────────────────────────────────────────────────────────
// ?mock=session | summary | missing en la URL elige el estado inicial.

const now = () => Math.floor(Date.now() / 1000);
const scene = new URLSearchParams(location.search).get('mock');
const day = 86400;

const fake: { snap: Snapshot; config: Config; history: SessionRecord[] } = {
  snap: { helper: scene === 'missing' ? 'missing' : 'ok', session: null, last_finished: null, sniffer_ok: true },
  config: {
    minutes: 50,
    mode: 'list',
    sites: ['x.com', 'instagram.com', 'youtube.com', 'linkedin.com'].map((domain) => ({ domain, on: true })),
    apps: [
      { id: 'com.apple.MobileSMS', name: 'Mensajes', on: true },
      { id: 'com.tinyspeck.slackmacgap', name: 'Slack', on: true },
      { id: 'net.whatsapp.WhatsApp', name: 'WhatsApp', on: false },
    ],
    one_app: null,
    accent: '#E4FC24',
    tuning: null,
  },
  history: [
    [6, 50, 2], [6, 25, 0], [5, 90, 1], [4, 50, 4], [4, 50, 0], [3, 25, 1], [2, 90, 0], [2, 50, 3], [1, 50, 0], [0, 25, 1], [0, 50, 0],
  ].map(([ago, min, attempts], i) => {
    const started = now() - ago * day - 3600 * (2 + (i % 3));
    return { id: started, started_at: started, ended_at: started + min * 60, planned_secs: min * 60, mode: 'list', attempts, cancelled: false };
  }),
};

function begin() {
  const c = fake.config;
  const t = now();
  fake.snap.session = {
    id: t,
    started_at: t,
    ends_at: t + c.minutes * 60,
    mode: c.mode,
    sites: c.sites.filter((s) => s.on).map((s) => s.domain),
    apps: c.mode === 'list' ? c.apps.filter((a) => a.on).map((a) => a.id) : [],
    one_app: c.mode === 'one' ? (c.one_app?.id ?? null) : null,
    one_app_name: c.mode === 'one' ? (c.one_app?.name ?? null) : null,
    attempts: 0,
    last_attempt: null,
    cooldown_started: null,
  };
  fake.snap.last_finished = null;
}

function finish(cancelled: boolean) {
  const s = fake.snap.session;
  if (!s) return;
  const record = { id: s.id, started_at: s.started_at, ended_at: Math.min(now(), s.ends_at), planned_secs: s.ends_at - s.started_at, mode: s.mode, attempts: s.attempts, cancelled };
  fake.history.push(record);
  fake.snap = { ...fake.snap, session: null, last_finished: record };
}

if (!inTauri) {
  if (scene === 'session') {
    begin();
    const s = fake.snap.session!;
    s.started_at -= 26 * 60;
    s.ends_at -= 26 * 60;
    s.attempts = 3;
    s.last_attempt = { seq: 3, target: 'youtube.com', kind: 'site', at: now() };
  }
  if (scene === 'summary') {
    const t = now();
    fake.snap.last_finished = { id: t, started_at: t - 3000, ended_at: t, planned_secs: 3000, mode: 'list', attempts: 3, cancelled: false };
  }
  setInterval(() => {
    if (fake.snap.session && now() >= fake.snap.session.ends_at) {
      finish(false);
      emit('status', fake.snap);
    }
  }, 500);
}

function emit<K extends keyof Events>(event: K, payload: Events[K]) {
  window.dispatchEvent(new CustomEvent(`foco:${event}`, { detail: structuredClone(payload) }));
}

async function mock(cmd: keyof Commands, args: unknown): Promise<unknown> {
  const a = (args ?? {}) as { config?: Config; phrase?: string | null };
  const s = fake.snap.session;
  switch (cmd) {
    case 'get_config':
      return structuredClone(fake.config);
    case 'set_config':
      fake.config = structuredClone(a.config!);
      emit('config', fake.config);
      return;
    case 'start':
      begin();
      break;
    case 'begin_cooldown':
      if (s && !s.cooldown_started) s.cooldown_started = now();
      break;
    case 'cancel':
      if (!s) throw 'no hay sesión';
      if (a.phrase != null && a.phrase.trim() !== CANCEL_PHRASE) throw 'la frase no coincide';
      if (a.phrase == null && !(s.cooldown_started && now() >= s.cooldown_started + COOLDOWN_SECS)) throw 'el enfriamiento todavía no terminó';
      finish(true);
      break;
    case 'ack_summary':
      fake.snap = { ...fake.snap, last_finished: null };
      break;
    case 'install_helper':
      fake.snap = { ...fake.snap, helper: 'ok' };
      break;
    case 'history':
      return structuredClone(fake.history);
    case 'installed_apps':
      return ['After Effects', 'Cinema 4D', 'Figma', 'Illustrator', 'Photoshop', 'Premiere Pro', 'Safari', 'Slack', 'Spotify'].map((name) => ({
        id: `mock.${name.toLowerCase().replace(/ /g, '')}`,
        name,
        on: false,
      }));
    case 'preview_block':
      window.open('?view=block&mock=session', 'foco-block');
      return;
    case 'snapshot':
      break;
    default:
      return;
  }
  emit('status', fake.snap);
  return structuredClone(fake.snap);
}
