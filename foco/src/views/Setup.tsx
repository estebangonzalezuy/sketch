import { ButtonGroup, ColorControl, Folder, SelectControl, Slider, TextControl, Toggle } from 'dialkit';
import { useEffect, useState } from 'react';
import { call } from '../ipc';
import type { AppRef, Config, Mode, Snapshot } from '../types';
import { Header, Note, Primary } from './parts';

type Props = { config: Config; update: (patch: Partial<Config>) => void; onStart: (s: Snapshot) => void; onHistory: () => void };

/** De lo que se escriba ("https://www.Reddit.com/r/x") al dominio pelado. */
function domainOf(input: string): string | null {
  const host = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#:].*$/, '').replace(/^www\./, '').replace(/\.$/, '');
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(host) ? host : null;
}

/** El panel en reposo: qué bloquear, por cuánto, y Empezar. */
export function Setup({ config, update, onStart, onHistory }: Props) {
  const [installed, setInstalled] = useState<AppRef[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => void call('installed_apps').then(setInstalled), []);

  const addSite = () => {
    const domain = domainOf(draft);
    if (!domain) return setError(draft.trim() ? `"${draft.trim()}" no parece un sitio.` : null);
    if (!config.sites.some((s) => s.domain === domain)) update({ sites: [...config.sites, { domain, on: true }] });
    setDraft('');
    setError(null);
  };

  const one = config.mode === 'one';
  const candidates = installed.filter((a) => !config.apps.some((b) => b.id === a.id));
  const sitesOn = config.sites.filter((s) => s.on).length;
  const appsOn = config.apps.filter((a) => a.on).length;
  const nothing = one ? !config.one_app : sitesOn + appsOn === 0;

  const start = () =>
    call('set_config', { config })
      .then(() => call('start'))
      .then(onStart)
      .catch((e) => setError(String(e)));

  return (
    <>
      <Header title="Foco" action="Historial" onAction={onHistory} />

      <div className="row">
        <ButtonGroup buttons={[25, 50, 90].map((m) => ({ label: `${m} min`, onClick: () => update({ minutes: m }) }))} />
      </div>
      <Slider label="Minutos" value={config.minutes} min={5} max={180} step={5} onChange={(minutes) => update({ minutes })} />
      <SelectControl
        label="Modo"
        value={config.mode}
        options={[
          { value: 'list', label: 'Lista' },
          { value: 'one', label: 'Una cosa' },
        ]}
        onChange={(mode) => update({ mode: mode as Mode })}
      />

      {one && (
        <SelectControl
          label="App"
          value={config.one_app?.id ?? ''}
          options={[...(config.one_app ? [] : [{ value: '', label: 'Elegir…' }]), ...installed.map((a) => ({ value: a.id, label: a.name }))]}
          onChange={(id) => update({ one_app: installed.find((a) => a.id === id) ?? null })}
        />
      )}

      <Folder title={`Sitios · ${sitesOn}`} defaultOpen={!one}>
        {config.sites.map((site) => (
          <Toggle
            key={site.domain}
            label={site.domain}
            checked={site.on}
            onChange={(on) => update({ sites: config.sites.map((s) => (s.domain === site.domain ? { ...s, on } : s)) })}
          />
        ))}
        <div onKeyDown={(e) => e.key === 'Enter' && addSite()}>
          <TextControl label="Sumar" value={draft} placeholder="reddit.com" onChange={setDraft} />
        </div>
        <div className="row">
          <ButtonGroup
            buttons={[
              { label: 'Sumar sitio', onClick: addSite },
              { label: 'Quitar apagados', onClick: () => update({ sites: config.sites.filter((s) => s.on) }) },
            ]}
          />
        </div>
      </Folder>

      {!one && (
        <Folder title={`Apps · ${appsOn}`} defaultOpen={false}>
          {config.apps.map((app) => (
            <Toggle
              key={app.id}
              label={app.name}
              checked={app.on}
              onChange={(on) => update({ apps: config.apps.map((a) => (a.id === app.id ? { ...a, on } : a)) })}
            />
          ))}
          {candidates.length > 0 && (
            <SelectControl
              label="Sumar"
              value=""
              options={[{ value: '', label: 'Elegir app…' }, ...candidates.map((a) => ({ value: a.id, label: a.name }))]}
              onChange={(id) => {
                const app = candidates.find((a) => a.id === id);
                if (app) update({ apps: [...config.apps, { ...app, on: true }] });
              }}
            />
          )}
          <ButtonGroup buttons={[{ label: 'Quitar apagadas', onClick: () => update({ apps: config.apps.filter((a) => a.on) }) }]} />
        </Folder>
      )}

      <ColorControl label="Acento" value={config.accent} onChange={(accent) => update({ accent })} />

      {error && <Note tone="error">{error}</Note>}
      {one && <Note>Las demás apps se ocultan y vuelven a ocultarse si las abrís. Los sitios prendidos también se bloquean.</Note>}
      <Primary tone="accent" hint="⌥⌘F" disabled={nothing} onClick={start}>
        Empezar
      </Primary>
    </>
  );
}
