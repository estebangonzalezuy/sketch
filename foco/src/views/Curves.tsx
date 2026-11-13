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
    'Curvas',
    {
      bloqueado: {
        fondo: t.fondo,
        texto: t.texto,
        escalonado: [t.escalonado, 0, 0.2, 0.005],
        salida: t.salida,
        permanencia: [t.permanencia, 2, 20, 1],
      },
      panel: { cambio: t.panel },
      probar: { type: 'action', label: 'Probar bloqueado' },
      cerrar: { type: 'action', label: 'Cerrar prueba' },
      salir: { type: 'action', label: 'Salir de Foco' },
    },
    {
      id: 'foco-curvas',
      onAction: (path) => {
        if (path === 'probar') void call('preview_block');
        if (path === 'cerrar') void call('hide_block');
        if (path === 'salir') void call('quit').catch(() => {});
      },
    },
  );

  const tuning: Tuning = {
    fondo: values.bloqueado.fondo as Tuning['fondo'],
    texto: values.bloqueado.texto as Tuning['texto'],
    escalonado: values.bloqueado.escalonado,
    salida: values.bloqueado.salida as Tuning['salida'],
    permanencia: values.bloqueado.permanencia,
    panel: values.panel.cambio as Tuning['panel'],
  };
  const json = JSON.stringify(tuning);
  useEffect(() => {
    if (json !== JSON.stringify(tuningOf(config))) update({ tuning: JSON.parse(json) });
    // Solo cuando cambia un dial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json]);

  return (
    <>
      <Header title="Foco" action="Volver" onAction={() => (void call('hide_block'), onBack())} />
      <div className="dials">
        <DialRoot mode="inline" theme="dark" productionEnabled versions="menu" />
      </div>
    </>
  );
}
