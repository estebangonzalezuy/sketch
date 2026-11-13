import { ButtonGroup, Folder, TextControl } from 'dialkit';
import { useState } from 'react';
import { call } from '../ipc';
import { clock, plural, useNow } from '../time';
import type { Session, Snapshot } from '../types';
import { CANCEL_PHRASE, COOLDOWN_SECS } from '../types';
import { Note } from './parts';

type Props = { session: Session; snifferOk: boolean; onChange: (s: Snapshot) => void };

/** Durante la sesión: el tiempo que queda y, bien guardada, la salida. */
export function Running({ session, snifferOk, onChange }: Props) {
  const now = useNow();
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  const left = session.ends_at - now;
  const progress = Math.min(1, Math.max(0, (now - session.started_at) / (session.ends_at - session.started_at)));
  const cooling = session.cooldown_started != null ? session.cooldown_started + COOLDOWN_SECS - now : null;

  const what =
    session.mode === 'one'
      ? `Solo ${session.one_app_name ?? 'una app'}`
      : [session.sites.length && plural(session.sites.length, 'sitio', 'sitios'), session.apps.length && plural(session.apps.length, 'app', 'apps')]
          .filter(Boolean)
          .join(' y ') + ' en pausa';

  const run = (p: Promise<Snapshot>) => p.then(onChange).catch((e) => setError(String(e)));
  const typed = phrase.trim().replace(/\s+/g, ' ') === CANCEL_PHRASE;

  return (
    <>
      <div className="hero">
        <p className="eyebrow">
          <i className="pulse" />
          En foco
        </p>
        <p className="time">{clock(left)}</p>
        <div className="bar">
          <i style={{ transform: `scaleX(${1 - progress})` }} />
        </div>
        <p className="meta">
          {what}
          <span>{session.attempts === 0 ? 'Sin intentos' : plural(session.attempts, 'intento', 'intentos')}</span>
        </p>
      </div>

      {!snifferOk && session.sites.length > 0 && (
        <Note>Los puertos 80 y 443 locales están ocupados: los sitios se bloquean igual, pero no voy a ver los intentos.</Note>
      )}

      <Folder title="Cortar la sesión" defaultOpen={false}>
        <p className="phrase">{CANCEL_PHRASE}</p>
        {/* La frase se escribe: pegarla o arrastrarla no vale. */}
        <div onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
          <TextControl label="Frase" value={phrase} placeholder="Escribila entera" onChange={setPhrase} />
        </div>
        <ButtonGroup
          buttons={[
            typed
              ? { label: 'Cortar', onClick: () => void run(call('cancel', { phrase })) }
              : { label: `Faltan ${Math.max(0, CANCEL_PHRASE.length - phrase.trim().length)} letras`, onClick: () => setError('La frase todavía no coincide.') },
          ]}
        />
        <ButtonGroup
          buttons={[
            cooling == null
              ? { label: 'O esperar 2 minutos', onClick: () => void run(call('begin_cooldown')) }
              : cooling > 0
                ? { label: `Podés cortar en ${clock(cooling)}`, onClick: () => {} }
                : { label: 'Cortar ahora', onClick: () => void run(call('cancel', { phrase: null })) },
          ]}
        />
        {error && <Note tone="error">{error}</Note>}
      </Folder>
    </>
  );
}
