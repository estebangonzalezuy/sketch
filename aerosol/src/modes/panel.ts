import { el, segmented, slider } from '../ui';
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
        const wrap = el('div', { class: 'dial-row' }, el('span', { class: 'slider-label' }, d.label));
        parent.append(wrap);
        const c = segmented(wrap, d.options, String(io.get(d)), (v) => io.set(d, v));
        return { dial: d, set: (v) => c.set(String(v)) };
      }
      case 'toggle': {
        const input = el('input', { type: 'checkbox', id: `dial-${d.id}` });
        input.checked = Boolean(io.get(d));
        input.addEventListener('change', () => io.set(d, input.checked));
        parent.append(el('label', { class: 'toggle', for: `dial-${d.id}` }, input, el('span', {}, d.label)));
        return { dial: d, set: (v) => (input.checked = Boolean(v)) };
      }
      case 'text': {
        const input = d.multiline
          ? el('textarea', { rows: '3', spellcheck: 'false', id: `dial-${d.id}` })
          : el('input', { type: 'text', spellcheck: 'false', class: 'text-input', id: `dial-${d.id}` });
        input.value = String(io.get(d));
        input.addEventListener('input', () => io.set(d, input.value));
        parent.append(el('label', { class: 'text-dial', for: `dial-${d.id}` }, el('span', { class: 'slider-label' }, d.label), input));
        return { dial: d, set: (v) => (input.value = String(v)) };
      }
    }
  });
}
