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
      ? `Only ${session.one_app_name ?? 'one app'}`
      : [session.sites.length && plural(session.sites.length, 'site', 'sites'), session.apps.length && plural(session.apps.length, 'app', 'apps')]
          .filter(Boolean)
          .join(' and ') + ' paused';

  const run = (p: Promise<Snapshot>) => p.then(onChange).catch((e) => setError(String(e)));
  const typed = phrase.trim().replace(/\s+/g, ' ') === CANCEL_PHRASE;

  return (
    <>
      <div className="hero">
        <p className="eyebrow">
          <i className="pulse" />
          In focus
        </p>
        <p className="time">{clock(left)}</p>
        <div className="bar">
          <i style={{ transform: `scaleX(${1 - progress})` }} />
        </div>
        <p className="meta">
          {what}
          <span>{session.attempts === 0 ? 'No attempts' : plural(session.attempts, 'attempt', 'attempts')}</span>
        </p>
      </div>

      {!snifferOk && session.sites.length > 0 && (
        <Note>Local ports 80 and 443 are taken: sites are still blocked, but attempts will not be detected.</Note>
      )}

      <Folder title="End session early" defaultOpen={false}>
        <p className="phrase">{CANCEL_PHRASE}</p>
        {/* La frase se escribe: pegarla o arrastrarla no vale. */}
        <div onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
          <TextControl label="Phrase" value={phrase} placeholder="Type all of it" onChange={setPhrase} />
        </div>
        <ButtonGroup
          buttons={[
            typed
              ? { label: 'End session', onClick: () => void run(call('cancel', { phrase })) }
              : { label: `${Math.max(0, CANCEL_PHRASE.length - phrase.trim().length)} characters to go`, onClick: () => setError('The phrase does not match yet.') },
          ]}
        />
        <ButtonGroup
          buttons={[
            cooling == null
              ? { label: 'Or wait 2 minutes', onClick: () => void run(call('begin_cooldown')) }
              : cooling > 0
                ? { label: `You can end it in ${clock(cooling)}`, onClick: () => {} }
                : { label: 'End now', onClick: () => void run(call('cancel', { phrase: null })) },
          ]}
        />
        {error && <Note tone="error">{error}</Note>}
      </Folder>
    </>
  );
}
