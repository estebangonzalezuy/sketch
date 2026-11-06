import type { ParamSpec, ParamSpecs, ParamValue, Params } from './core/tool';

/**
 * Panel de controles armado a partir de los ParamSpecs de la tool, agrupado por `group`.
 * Sin framework: cada control escribe en `params` y llama a onChange. refresh() vuelve a leer `params`.
 */

type Control = { refresh(): void };

export type PanelOptions = {
  specs: ParamSpecs;
  params: Params;
  onChange?: (id: string, value: ParamValue) => void;
  /** Etiqueta de una opción de select, por ejemplo para marcar una fuente que falta. */
  optionLabel?: (id: string, option: string) => string | null;
};

const fmt = (v: number, step = 0.01) => {
  const decimals = step >= 1 ? 0 : Math.min(3, Math.max(0, Math.ceil(-Math.log10(step))));
  return v.toFixed(decimals);
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

function row(label: string, ...controls: Node[]) {
  return el('label', { class: 'row' }, el('span', { class: 'row-label', title: label }, label), ...controls);
}

/** Slider con valor numérico editable. Con interp log, el slider se mueve en escala logarítmica. */
function slider(label: string, get: () => number, set: (v: number) => void, o: { min: number; max: number; step?: number; log?: boolean }): [Node, Control] {
  const step = o.step ?? 0.01;
  const toS = (v: number) => (o.log ? Math.log(v / o.min) / Math.log(o.max / o.min) : v);
  const fromS = (s: number) => (o.log ? o.min * (o.max / o.min) ** s : s);
  const range = el('input', { type: 'range', min: String(toS(o.min)), max: String(toS(o.max)), step: o.log ? '0.0005' : String(step) });
  const num = el('input', { type: 'number', min: String(o.min), max: String(o.max), step: String(step), class: 'num' });
  const refresh = () => {
    range.value = String(toS(get()));
    num.value = fmt(get(), step);
  };
  range.addEventListener('input', () => {
    set(fromS(Number(range.value)));
    num.value = fmt(get(), step);
  });
  num.addEventListener('change', () => {
    const v = Math.min(o.max, Math.max(o.min, Number(num.value)));
    if (!Number.isFinite(v)) return refresh();
    set(v);
    refresh();
  });
  refresh();
  return [row(label, range, num), { refresh }];
}

function control(id: string, spec: ParamSpec, opts: PanelOptions): [Node, Control] {
  const { params, onChange } = opts;
  const label = spec.label ?? id;
  const set = (v: ParamValue) => {
    params[id] = v;
    onChange?.(id, v);
  };

  switch (spec.kind) {
    case 'number':
      return slider(label, () => params[id] as number, set, { min: spec.min, max: spec.max, step: spec.step, log: spec.interp === 'log' });

    case 'vec2': {
      const v = () => params[id] as [number, number];
      const [x, cx] = slider(`${label} x`, () => v()[0], (n) => set([n, v()[1]]), { min: spec.min, max: spec.max, step: 0.001 });
      const [y, cy] = slider(`${label} y`, () => v()[1], (n) => set([v()[0], n]), { min: spec.min, max: spec.max, step: 0.001 });
      const frag = document.createDocumentFragment();
      frag.append(x, y);
      return [frag, { refresh: () => (cx.refresh(), cy.refresh()) }];
    }

    case 'boolean': {
      const input = el('input', { type: 'checkbox' });
      input.addEventListener('change', () => set(input.checked));
      const refresh = () => void (input.checked = params[id] as boolean);
      refresh();
      return [row(label, input), { refresh }];
    }

    case 'select': {
      const select = el('select');
      for (const option of spec.options) {
        const text = opts.optionLabel?.(id, option) ?? option;
        select.append(el('option', { value: option }, text));
      }
      select.addEventListener('change', () => set(select.value));
      const refresh = () => void (select.value = String(params[id]));
      refresh();
      return [row(label, select), { refresh }];
    }

    case 'color': {
      const input = el('input', { type: 'color' });
      const hex = el('span', { class: 'num hex' });
      input.addEventListener('input', () => {
        set(input.value.toUpperCase());
        hex.textContent = input.value.toUpperCase();
      });
      const refresh = () => {
        input.value = String(params[id]).toLowerCase();
        hex.textContent = String(params[id]).toUpperCase();
      };
      refresh();
      return [row(label, input, hex), { refresh }];
    }

    case 'text': {
      const input = spec.multiline ? el('textarea', { rows: '6', spellcheck: 'false' }) : el('input', { type: 'text' });
      // El texto reconstruye el atlas: se aplica al dejar de escribir.
      let timer = 0;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => set(input.value), 300);
      });
      const refresh = () => void (input.value = String(params[id]));
      refresh();
      const wrap = el('label', { class: 'row row-block' }, el('span', { class: 'row-label' }, label), input);
      return [wrap, { refresh }];
    }
  }
}

export function buildPanel(container: HTMLElement, opts: PanelOptions) {
  const groups = new Map<string, HTMLElement>();
  const controls: Control[] = [];
  for (const [id, spec] of Object.entries(opts.specs)) {
    const name = spec.group ?? 'Parámetros';
    let body = groups.get(name);
    if (!body) {
      body = el('div', { class: 'group-body' });
      const details = el('details', { class: 'group', 'data-group': name }, el('summary', {}, name), body);
      details.open = ['Vista', 'Estilo', 'Paleta', 'Movimiento'].includes(name);
      container.append(details);
      groups.set(name, body);
    }
    const [node, c] = control(id, spec, opts);
    if (node instanceof HTMLElement) node.dataset.param = id;
    body.append(node);
    controls.push(c);
  }
  return { refresh: () => controls.forEach((c) => c.refresh()) };
}
