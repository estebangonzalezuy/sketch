export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
}

/**
 * Sección del panel. `folder` (default): carpeta plegable como las de DialKit en Motion Builder, con
 * su estado guardado por navegador. `panel`: título en versalitas, fijo (columna de capas).
 */
export function section(parent: HTMLElement, title: string, hint = '', variant: 'folder' | 'panel' = 'folder'): HTMLElement {
  const body = el('div', { class: 'section-body' });
  if (variant === 'panel') {
    parent.append(el('section', { class: 'section panel-section' }, el('header', { class: 'panel-title' }, el('h2', {}, title), el('span', { class: 'hint' }, hint)), body));
    return body;
  }
  const key = `aerosol:folder:${title}`;
  let open = true;
  try {
    open = localStorage.getItem(key) !== '0';
  } catch {
    // sin almacenamiento: abierta
  }
  const head = el('button', { class: 'folder-head', type: 'button', 'aria-expanded': String(open) }, el('span', { class: 'folder-title' }, title), el('span', { class: 'hint' }, hint), el('span', { class: 'chev', 'aria-hidden': 'true' }));
  const root = el('section', { class: 'section folder' }, head, body);
  root.dataset.open = String(open);
  head.addEventListener('click', () => {
    open = !open;
    root.dataset.open = String(open);
    head.setAttribute('aria-expanded', String(open));
    try {
      localStorage.setItem(key, open ? '1' : '0');
    } catch {
      // sin persistencia
    }
  });
  parent.append(root);
  return body;
}

export interface SliderOpts {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  digits?: number;
  suffix?: string;
}

export interface Control<T> {
  set(v: T): void;
  root: HTMLElement;
}

/** Slider estilo DialKit: barra con relleno, label adentro a la izquierda y valor en mono a la derecha. */
export function slider(parent: HTMLElement, o: SliderOpts, onInput: (v: number) => void): Control<number> {
  const input = el('input', { type: 'range', class: 'dial-input', min: String(o.min), max: String(o.max), step: String(o.step), 'aria-label': o.label });
  const out = el('span', { class: 'dial-value' });
  const fill = el('span', { class: 'dial-fill' });
  const fmt = (v: number) => (o.digits === undefined ? String(v) : v.toFixed(o.digits)) + (o.suffix ?? '');
  const paint = (v: number) => {
    out.textContent = fmt(v);
    fill.style.width = `${Math.min(100, Math.max(0, ((v - o.min) / (o.max - o.min)) * 100))}%`;
  };
  input.value = String(o.value);
  paint(o.value);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    paint(v);
    onInput(v);
  });
  // Doble clic: vuelve al valor por defecto.
  input.addEventListener('dblclick', () => {
    input.value = String(o.value);
    paint(o.value);
    onInput(o.value);
  });
  const root = el('label', { class: 'dial-slider', title: 'Drag to change · double-click to reset' }, fill, el('span', { class: 'dial-label' }, o.label), out, input);
  parent.append(root);
  return {
    root,
    set(v) {
      input.value = String(v);
      paint(v);
    },
  };
}

/** Fila con label y un Off/On, como el toggle de DialKit. */
export function toggleRow(parent: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void, extra?: Node): Control<boolean> {
  const row = el('div', { class: 'dial-row-inline' }, el('span', { class: 'dial-label' }, label, ...(extra ? [extra] : [])));
  parent.append(row);
  const seg = segmented(row, [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' },
  ], value ? 'on' : 'off', (v) => onChange(v === 'on'), 'onoff');
  return { root: row, set: (v) => seg.set(v ? 'on' : 'off') };
}

/** Fila con label a la izquierda y el valor editable a la derecha. */
export function textRow(parent: HTMLElement, label: string, value: string, onInput: (v: string) => void, multiline = false, id?: string): Control<string> {
  const input = multiline
    ? el('textarea', { rows: '3', spellcheck: 'false', class: 'dial-text-input', ...(id ? { id } : {}) })
    : el('input', { type: 'text', spellcheck: 'false', class: 'dial-text-input', ...(id ? { id } : {}) });
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  const root = el('label', { class: `dial-text${multiline ? ' multi' : ''}` }, el('span', { class: 'dial-label' }, label), input);
  parent.append(root);
  return { root, set: (v) => (input.value = v) };
}

export function segmented<T extends string>(
  parent: HTMLElement,
  options: readonly T[] | { value: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
  cls = '',
): Control<T> {
  const root = el('div', { class: `seg ${cls}`, role: 'radiogroup' });
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const buttons = opts.map((o) => {
    const b = el('button', { type: 'button', role: 'radio' }, o.label);
    b.addEventListener('click', () => {
      set(o.value);
      onChange(o.value);
    });
    root.append(b);
    return b;
  });
  const set = (v: T) => {
    opts.forEach((o, i) => {
      buttons[i].classList.toggle('on', o.value === v);
      buttons[i].setAttribute('aria-checked', String(o.value === v));
    });
  };
  set(value);
  parent.append(root);
  return { root, set };
}
