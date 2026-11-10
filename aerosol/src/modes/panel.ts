import { el, segmented, slider, textRow, toggleRow } from '../ui';
import type { Dial, DialValue } from './types';

export interface DialIO {
  get(d: Dial): DialValue;
  set(d: Dial, v: DialValue): void;
}

/** Controles de un dial; `set` los actualiza desde afuera (p. ej. un slider de Paint enlazado). */
export interface DialControl {
  dial: Dial;
  set(v: DialValue): void;
}

/** Arma el panel de diales del modo activo con los mismos controles del resto de la UI. */
export function buildDials(parent: HTMLElement, dials: Dial[], io: DialIO): DialControl[] {
  parent.replaceChildren();
  return dials.map((d) => {
    switch (d.type) {
      case 'range': {
        const c = slider(
          parent,
          { label: d.label, min: d.min, max: d.max, step: d.step, value: d.default, digits: d.digits, suffix: d.suffix },
          (v) => io.set(d, v),
        );
        c.set(Number(io.get(d)));
        return { dial: d, set: (v) => c.set(Number(v)) };
      }
      case 'choice': {
        const wrap = el('div', { class: 'dial-row-inline' }, el('span', { class: 'dial-label' }, d.label));
        parent.append(wrap);
        const c = segmented(wrap, d.options, String(io.get(d)), (v) => io.set(d, v));
        return { dial: d, set: (v) => c.set(String(v)) };
      }
      case 'toggle': {
        const c = toggleRow(parent, d.label, Boolean(io.get(d)), (v) => io.set(d, v));
        return { dial: d, set: (v) => c.set(Boolean(v)) };
      }
      case 'text': {
        const c = textRow(parent, d.label, String(io.get(d)), (v) => io.set(d, v), d.multiline, `dial-${d.id}`);
        return { dial: d, set: (v) => c.set(String(v)) };
      }
    }
  });
}
