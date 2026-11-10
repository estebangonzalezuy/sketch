import { el } from './ui';

// Timeline al pie, como el de Motion Builder: barra de transporte, regla en s:ff, filas con clips y
// keys (rombos) y un playhead rojo. Arrastrar sobre la regla o las pistas mueve el playhead.

export const FPS = 30;

export interface TlClip {
  label: string;
  start: number;
  end: number;
  /** Segundos finales del clip que se mezclan con el siguiente (morph). */
  fade?: number;
  kind?: 'media' | 'intro' | 'hold';
  current?: boolean;
  onClick?: () => void;
}

export interface TlRow {
  label: string;
  note?: string;
  clips?: TlClip[];
  /** Tiempos de keys (rombos). */
  keys?: number[];
  sub?: boolean;
}

export interface TimelineHandlers {
  onSeek(t: number): void;
  onScrubEnd(): void;
  onTogglePlay(): void;
  onRecord(): void;
  onResetSmear(): void;
  onClearStrokes(): void;
}

/** 1.5 s → "1:15" (segundos:frames a 30 fps). */
export function sf(t: number): string {
  const f = Math.round(t * FPS);
  return `${Math.floor(f / FPS)}:${String(f % FPS).padStart(2, '0')}`;
}

export class TimelineView {
  private playBtn: HTMLButtonElement;
  private count: HTMLElement;
  private recordBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private status: HTMLElement;
  private content: HTMLElement;
  private ruler: HTMLElement;
  private rowsBox: HTMLElement;
  private playhead: HTMLElement;
  private total = 1;
  private rowsKey = '';

  constructor(root: HTMLElement, h: TimelineHandlers) {
    this.playBtn = el('button', { type: 'button', class: 'tl-play' }, 'Play');
    this.count = el('span', { class: 'frame-count' });
    this.recordBtn = el('button', { type: 'button', title: 'Restart the loop and record your strokes for one pass' }, 'Record with touch');
    const resetBtn = el('button', { type: 'button', title: 'Clear the current smear' }, 'Reset smear');
    this.clearBtn = el('button', { type: 'button', title: 'Delete the recorded strokes' }, 'Clear strokes');
    this.status = el('span', { class: 'tl-status' });
    this.playBtn.addEventListener('click', () => h.onTogglePlay());
    this.recordBtn.addEventListener('click', () => h.onRecord());
    resetBtn.addEventListener('click', () => h.onResetSmear());
    this.clearBtn.addEventListener('click', () => h.onClearStrokes());
    const bar = el('div', { class: 'tl-bar' }, this.playBtn, this.count, this.recordBtn, resetBtn, this.clearBtn, this.status);

    this.ruler = el('div', { class: 'tl-ruler' });
    const head = el('div', { class: 'tl-row tl-head' }, el('div', { class: 'tl-label' }), this.ruler);
    this.rowsBox = el('div', { class: 'tl-rows' });
    this.playhead = el('div', { class: 'tl-playhead' });
    const overlay = el('div', { class: 'tl-overlay' }, this.playhead);
    this.content = el('div', { class: 'tl-content' }, head, this.rowsBox, overlay);
    root.append(bar, el('div', { class: 'tl-scroll' }, this.content));

    // Scrub: arrastrar sobre la regla o las pistas (no sobre las etiquetas).
    const seekAt = (e: PointerEvent) => {
      const r = this.ruler.getBoundingClientRect();
      h.onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * this.total);
    };
    this.content.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.tl-label') || t.closest('.tl-clip[data-click]')) return;
      this.content.setPointerCapture(e.pointerId);
      seekAt(e);
      const move = (ev: PointerEvent) => seekAt(ev);
      const up = () => {
        this.content.removeEventListener('pointermove', move);
        h.onScrubEnd();
      };
      this.content.addEventListener('pointermove', move);
      this.content.addEventListener('pointerup', up, { once: true });
      this.content.addEventListener('pointercancel', up, { once: true });
    });
  }

  /** Reconstruye regla y filas solo si cambiaron. */
  setRows(rows: TlRow[], total: number): void {
    const key = JSON.stringify([total, rows.map((r) => [r.label, r.note, r.keys, r.clips?.map((c) => [c.label, c.start, c.end, c.fade, c.current])])]);
    if (key === this.rowsKey) return;
    this.rowsKey = key;
    this.total = Math.max(0.001, total);
    const pct = (t: number) => `${(t / this.total) * 100}%`;

    const step = total > 12 ? 2 : total > 4 ? 1 : 0.5;
    const ticks: HTMLElement[] = [];
    for (let t = 0; t < total - 1e-6; t += step) {
      const tick = el('span', { class: 'tl-tick' }, sf(t));
      tick.style.left = pct(t);
      ticks.push(tick);
    }
    this.ruler.replaceChildren(...ticks);

    this.rowsBox.replaceChildren(
      ...rows.map((r) => {
        const lane = el('div', { class: 'tl-lane' });
        for (const c of r.clips ?? []) {
          const clip = el('div', { class: 'tl-clip', 'data-kind': c.kind ?? 'media', 'data-current': String(!!c.current), title: `${c.label} · ${sf(c.start)}–${sf(c.end)}` }, el('span', { class: 'tl-clip-name' }, c.label));
          clip.style.left = pct(c.start);
          clip.style.width = pct(c.end - c.start);
          if (c.fade) {
            const fade = el('span', { class: 'tl-fade', title: 'Fade into the next item' });
            fade.style.width = `${(c.fade / (c.end - c.start)) * 100}%`;
            clip.append(fade);
          }
          if (c.onClick) {
            clip.dataset.click = '';
            clip.addEventListener('click', c.onClick);
          }
          lane.append(clip);
        }
        for (const k of r.keys ?? []) {
          const key = el('span', { class: 'tl-key', title: `Stroke at ${sf(k)}` });
          key.style.left = pct(k);
          lane.append(key);
        }
        return el('div', { class: `tl-row${r.sub ? ' tl-sub' : ''}` }, el('div', { class: 'tl-label' }, el('span', { class: 'tl-name' }, r.label), el('small', {}, r.note ?? '')), lane);
      }),
    );
  }

  update(time: number, total: number, playing: boolean, recording: boolean, strokes: number): void {
    const frames = Math.max(1, Math.round(total * FPS));
    const frame = Math.min(frames - 1, Math.floor(time * FPS + 1e-6));
    this.count.textContent = `${sf(time)} · ${frame} / ${frames - 1}`;
    this.playBtn.textContent = playing ? 'Pause' : 'Play';
    this.playhead.style.left = `${(time / Math.max(0.001, total)) * 100}%`;
    this.recordBtn.textContent = recording ? 'Stop recording' : 'Record with touch';
    this.recordBtn.classList.toggle('recording', recording);
    this.clearBtn.disabled = recording || strokes === 0;
    this.status.textContent = recording ? 'Recording · drag on the canvas' : strokes ? `${strokes} recorded stroke${strokes === 1 ? '' : 's'} · exported` : 'Drag on the canvas to smear';
  }
}
