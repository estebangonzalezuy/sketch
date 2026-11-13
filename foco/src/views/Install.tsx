import { useState } from 'react';
import { call } from '../ipc';
import type { Snapshot } from '../types';
import { Header, Note, Primary } from './parts';

/** Primera vez (o después de actualizar): hay que instalar el helper. */
export function Install({ snap, onDone }: { snap: Snapshot; onDone: (s: Snapshot) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outdated = snap.helper === 'outdated';

  const install = () => {
    setBusy(true);
    setError(null);
    call('install_helper')
      .then(onDone)
      .catch((e) => setError(String(e) === 'cancelado' ? null : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Header title="Foco" />
      <p className="lead">{outdated ? 'El helper quedó viejo.' : 'Falta un paso.'}</p>
      <Note>
        Para bloquear sitios en todos los navegadores, Foco instala un helper que corre como administrador. Es lo que hace que el bloqueo siga
        aunque cierres la app. macOS te va a pedir la contraseña una sola vez.
      </Note>
      {error && <Note tone="error">{error}</Note>}
      <Primary tone="accent" disabled={busy} onClick={install}>
        {busy ? 'Instalando…' : outdated ? 'Actualizar helper' : 'Instalar helper'}
      </Primary>
    </>
  );
}
