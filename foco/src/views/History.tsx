import { ButtonGroup } from 'dialkit';
import { useEffect, useMemo, useState } from 'react';
import { call } from '../ipc';
import { plural, span } from '../time';
import type { SessionRecord } from '../types';
import { Header } from './parts';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** El lunes a las 00:00 de la semana de `date`, corrido `offset` semanas. */
function monday(date: Date, offset: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}

/** Tiempo en foco por día de la semana, una semana por vez. */
export function History({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [offset, setOffset] = useState(0);
  useEffect(() => void call('history').then(setRecords).catch(() => {}), []);

  const week = useMemo(() => {
    const start = monday(new Date(), offset);
    const from = start.getTime() / 1000;
    const inWeek = records.filter((r) => r.started_at >= from && r.started_at < from + 7 * 86400);
    const days = DAYS.map((_, i) => {
      const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).getTime() / 1000;
      const dayEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i + 1).getTime() / 1000;
      return inWeek.filter((r) => r.started_at >= dayStart && r.started_at < dayEnd).reduce((sum, r) => sum + (r.ended_at - r.started_at), 0);
    });
    return { start, days, sessions: inWeek.length, attempts: inWeek.reduce((n, r) => n + r.attempts, 0) };
  }, [records, offset]);

  const total = week.days.reduce((a, b) => a + b, 0);
  const max = Math.max(...week.days, 1);
  const today = offset === 0 ? (new Date().getDay() + 6) % 7 : -1;
  const end = new Date(week.start.getFullYear(), week.start.getMonth(), week.start.getDate() + 6);
  const label =
    offset === 0
      ? 'This week'
      : offset === -1
        ? 'Last week'
        : `${week.start.toLocaleDateString('en', { month: 'short', day: 'numeric' })} to ${end.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;

  return (
    <>
      <Header title="History" action="Back" onAction={onBack} />
      <div className="hero">
        <p className="eyebrow">{label}</p>
        <p className="time" data-size="words">{span(total)}</p>
        <p className="meta">
          {week.sessions === 0 ? 'No sessions' : plural(week.sessions, 'session', 'sessions')}
          <span>{week.attempts === 0 ? 'No attempts' : plural(week.attempts, 'attempt', 'attempts')}</span>
        </p>
      </div>

      <ol className="week" aria-label="Focus time per day">
        {week.days.map((secs, i) => (
          <li key={i} data-today={i === today} title={`${DAYS[i]}: ${span(secs)}`}>
            <span className="amount">{secs > 0 ? Math.round(secs / 60) : ''}</span>
            <span className="col">
              <i style={{ height: `${(secs / max) * 100}%` }} data-empty={secs === 0} />
            </span>
            <span className="day">{DAYS[i]}</span>
          </li>
        ))}
      </ol>
      <p className="caption">Minutes in focus per day.</p>

      <div className="row">
        <ButtonGroup
          buttons={[
            { label: 'Previous', onClick: () => setOffset((o) => o - 1) },
            { label: 'Next', onClick: () => setOffset((o) => Math.min(0, o + 1)) },
          ]}
        />
      </div>
    </>
  );
}
