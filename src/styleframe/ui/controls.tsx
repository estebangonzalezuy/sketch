import { useId, type ReactNode } from 'react';
import { PRESETS, TMSC, type PaletteState, type TmscColor } from '../tokens';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sf-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Row({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="sf-row" title={hint}>
      <span className="sf-label">{label}</span>
      <span className="sf-input">{children}</span>
    </label>
  );
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  hint?: string;
};

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  hint,
}: SliderProps) {
  const digits = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return (
    <Row label={label} hint={hint}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <output>
        {value.toFixed(digits)}
        {unit}
      </output>
    </Row>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <Row label={label} hint={hint}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <output>{value ? 'on' : 'off'}</output>
    </Row>
  );
}

export function Text({
  label,
  value,
  onChange,
  multiline,
  maxLength = 40,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <Row label={label}>
      {multiline ? (
        <textarea
          value={value}
          rows={2}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      )}
    </Row>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <div className="sf-row" role="radiogroup" aria-label={label}>
      <span className="sf-label">{label}</span>
      <span className="sf-seg">
        {options.map((o) => (
          <label key={String(o.value)} className={o.value === value ? 'on' : ''}>
            <input
              type="radio"
              name={name}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </span>
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Row label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

export function PalettePicker({
  value,
  onChange,
}: {
  value: PaletteState;
  onChange: (v: PaletteState) => void;
}) {
  const colors = Object.keys(TMSC) as TmscColor[];
  return (
    <>
      <div className="sf-presets">
        {PRESETS.map((p) => {
          const bg = p.id === 'tmsc' ? TMSC[value.bg] : p.bg;
          const fg = p.id === 'tmsc' ? TMSC[value.fg] : p.fg;
          return (
            <button
              key={p.id}
              type="button"
              className={value.preset === p.id ? 'on' : ''}
              onClick={() => onChange({ ...value, preset: p.id })}
              style={{ background: bg, color: fg }}
              title={p.label}
            >
              Aa
              <small>{p.label}</small>
            </button>
          );
        })}
      </div>
      {value.preset === 'tmsc' && (
        <div className="sf-tmsc">
          {(['bg', 'fg'] as const).map((slot) => (
            <div key={slot} className="sf-swatches" role="radiogroup" aria-label={slot}>
              <span className="sf-label">{slot === 'bg' ? 'Background' : 'Type'}</span>
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  title={`${c} ${TMSC[c]}`}
                  className={value[slot] === c ? 'on' : ''}
                  style={{ background: TMSC[c] }}
                  disabled={value[slot === 'bg' ? 'fg' : 'bg'] === c}
                  onClick={() => onChange({ ...value, [slot]: c })}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
