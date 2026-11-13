import type { ReactNode } from 'react';

/** El encabezado de cada vista: un título y, a la derecha, un enlace discreto. */
export function Header({ title, action, onAction }: { title: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <header className="head">
      <h1>{title}</h1>
      {action && (
        <button className="link" onClick={onAction}>
          {action}
        </button>
      )}
    </header>
  );
}

/** El botón grande de cada vista. `tone="accent"` es el de empezar. */
export function Primary(props: { children: ReactNode; hint?: string; tone?: 'accent' | 'plain'; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="primary" data-tone={props.tone ?? 'plain'} disabled={props.disabled} onClick={props.onClick}>
      <span>{props.children}</span>
      {props.hint && <kbd>{props.hint}</kbd>}
    </button>
  );
}

export function Note({ children, tone }: { children: ReactNode; tone?: 'error' }) {
  return (
    <p className="note" data-tone={tone}>
      {children}
    </p>
  );
}
