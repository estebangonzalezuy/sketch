import { call } from '../ipc';
import { plural, span } from '../time';
import type { SessionRecord, Snapshot } from '../types';
import { Primary } from './parts';

/** Al terminar: cuánto duró el foco y cuántas veces se intentó salir. */
export function Summary({ record, onDone }: { record: SessionRecord; onDone: (s: Snapshot) => void }) {
  const focused = record.ended_at - record.started_at;
  return (
    <>
      <div className="hero">
        <p className="eyebrow">{record.cancelled ? 'Sesión cortada' : 'Sesión terminada'}</p>
        <p className="time" data-size="words">{span(focused)}</p>
        <p className="meta">
          {record.cancelled ? `De ${span(record.planned_secs)} previstos` : 'En foco'}
          <span>{record.attempts === 0 ? 'Ningún intento de salir' : plural(record.attempts, 'intento de salir', 'intentos de salir')}</span>
        </p>
      </div>
      <Primary onClick={() => void call('ack_summary').then(onDone)}>Listo</Primary>
    </>
  );
}
