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

export function section(parent: HTMLElement, title: string, hint = ''): HTMLElement {
  const body = el('div', { class: 'section-body' });
  parent.append(
    el('section', { class: 'section' }, el('header', { class: 'section-head' }, el('h2', {}, title), el('span', { class: 'hint' }, hint)), body),
  );
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

export function slider(parent: HTMLElement, o: SliderOpts, onInput: (v: number) => void): Control<number> {
  const input = el('input', { type: 'range', min: String(o.min), max: String(o.max), step: String(o.step) });
  const out = el('span', { class: 'slider-value' });
  const fmt = (v: number) => (o.digits === undefined ? String(v) : v.toFixed(o.digits)) + (o.suffix ?? '');
  const paint = (v: number) => {
    out.textContent = fmt(v);
    input.style.setProperty('--fill', `${((v - o.min) / (o.max - o.min)) * 100}%`);
  };
  input.value = String(o.value);
  paint(o.value);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    paint(v);
    onInput(v);
  });
  // Doble clic en el valor: vuelve al valor por defecto.
  out.addEventListener('dblclick', () => {
    input.value = String(o.value);
    paint(o.value);
    onInput(o.value);
  });
  out.title = 'Doble clic: valor por defecto';
  const root = el('label', { class: 'slider' }, el('span', { class: 'slider-label' }, o.label), input, out);
  parent.append(root);
  return {
    root,
    set(v) {
      input.value = String(v);
      paint(v);
    },
  };
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
