import { DialRoot, useDialKit } from 'dialkit';
import { useEffect } from 'react';
import { call } from '../ipc';
import { tuningOf } from '../tuning';
import type { Config, Tuning } from '../types';
import { Header } from './parts';

type Props = { config: Config; update: (patch: Partial<Config>) => void; onBack: () => void };

/**
 * El panel oculto (⌥ clic en el ícono): un panel de DialKit sin tocar, con los
 * springs y easings de la app. Lo que se mueve acá se ve al instante en la
 * pantalla de bloqueado, que queda abierta de fondo mientras se prueba.
 */
export function Curves({ config, update, onBack }: Props) {
  const t = tuningOf(config);
  const values = useDialKit(
    'Curves',
    {
      blockScreen: {
        background: t.fondo,
        text: t.texto,
        stagger: [t.escalonado, 0, 0.2, 0.005],
        exit: t.salida,
        hold: [t.permanencia, 2, 20, 1],
      },
      panel: { change: t.panel },
      preview: { type: 'action', label: 'Preview block screen' },
      close: { type: 'action', label: 'Close preview' },
      quit: { type: 'action', label: 'Quit Foco' },
    },
    {
      id: 'foco-curves',
      onAction: (path) => {
        if (path === 'preview') void call('preview_block');
        if (path === 'close') void call('hide_block');
        if (path === 'quit') void call('quit').catch(() => {});
      },
    },
  );

  const tuning: Tuning = {
    fondo: values.blockScreen.background as Tuning['fondo'],
    texto: values.blockScreen.text as Tuning['texto'],
    escalonado: values.blockScreen.stagger,
    salida: values.blockScreen.exit as Tuning['salida'],
    permanencia: values.blockScreen.hold,
    panel: values.panel.change as Tuning['panel'],
  };
  const json = JSON.stringify(tuning);
  useEffect(() => {
    if (json !== JSON.stringify(tuningOf(config))) update({ tuning: JSON.parse(json) });
    // Solo cuando cambia un dial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json]);

  return (
    <>
      <Header title="Foco" action="Back" onAction={() => (void call('hide_block'), onBack())} />
      <div className="dials">
        <DialRoot mode="inline" theme="dark" productionEnabled versions="menu" />
      </div>
    </>
  );
}
