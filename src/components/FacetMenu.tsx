import { useEffect, useId, useRef, useState } from 'react';
import type { FacetCount } from '../types';

type Props = {
  label: string;
  options: FacetCount[];
  selected: string[];
  onChange: (next: string[]) => void;
  format?: (v: string) => string;
  emptyText?: string;
};

export function FacetMenu({
  label,
  options,
  selected,
  onChange,
  format = (v) => v,
  emptyText,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onFocus = (e: FocusEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open]);

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div
      className="facet"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className={`facet-btn${selected.length ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        {selected.length > 0 && <sup className="facet-sel">{selected.length}</sup>}
        <span aria-hidden="true" className="chev" />
      </button>
      <div id={id} className="facet-panel" hidden={!open}>
        {open && (
          <>
            <fieldset>
              <legend className="sr-only">{label}</legend>
              {options.length === 0 && (
                <p className="muted facet-empty">{emptyText ?? 'No options'}</p>
              )}
              <ul>
                {options.map((o) => {
                  const checked = selected.includes(o.value);
                  return (
                    <li key={o.value}>
                      <label className={o.count === 0 && !checked ? 'is-empty' : undefined}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} />
                        <span className="facet-name">{format(o.value)}</span>
                        <span className="facet-n">{o.count}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            {selected.length > 0 && (
              <button type="button" className="text-btn small" onClick={() => onChange([])}>
                Clear {label.toLowerCase()}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
