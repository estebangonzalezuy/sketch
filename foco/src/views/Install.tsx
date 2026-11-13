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
      .catch((e) => setError(String(e) === 'cancelled' ? null : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Header title="Foco" />
      <p className="lead">{outdated ? 'The helper is out of date.' : 'One step left.'}</p>
      <Note>
        To block sites in every browser, Foco installs a helper that runs as administrator. It is what keeps the block going even if you quit
        the app. macOS will ask for your password once.
      </Note>
      {error && <Note tone="error">{error}</Note>}
      <Primary tone="accent" disabled={busy} onClick={install}>
        {busy ? 'Installing…' : outdated ? 'Update helper' : 'Install helper'}
      </Primary>
    </>
  );
}
