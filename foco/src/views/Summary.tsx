import { call } from '../ipc';
import { plural, span } from '../time';
import type { SessionRecord, Snapshot } from '../types';
import { Primary } from './parts';

/** Al terminar: cuánto duró el foco y cuántas veces se intentó salir. */
export function Summary({ record, onDismiss, onDone }: { record: SessionRecord; onDismiss: () => void; onDone: (s: Snapshot) => void }) {
  // "Listo" cierra el resumen ya mismo; avisarle al helper va por detrás.
  const done = () => {
    onDismiss();
    call('ack_summary').then(onDone).catch(() => {});
  };
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
      <Primary onClick={done}>Listo</Primary>
    </>
  );
}
