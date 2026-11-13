import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { call, inTauri, on } from './ipc';
import { useAccent, useConfig, useSnapshot } from './state';
import { clock, useNow } from './time';
import { motionOf, tuningOf } from './tuning';

const PHRASE = ['Volvé', 'a', 'lo', 'tuyo.'];

/**
 * La pantalla de bloqueado. Entra cuando se intenta abrir algo prohibido:
 * el fondo de tinta sube desde abajo, la frase aparece palabra por palabra
 * desde atrás de su propia línea y el tiempo restante llega último.
 */
export function Block() {
  const [snap] = useSnapshot();
  const [config] = useConfig();
  // `run` cambia en cada aparición para que la entrada vuelva a correr.
  const [state, setState] = useState<{ run: number; open: boolean; preview: boolean }>({ run: 0, open: !inTauri, preview: false });
  const now = useNow(state.open);
  const tuning = tuningOf(config);
  useAccent(config);

  useEffect(() => on('block', (preview) => setState((s) => ({ run: s.run + 1, open: true, preview }))), []);

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  // En la prueba, cada dial que se mueve vuelve a correr la entrada.
  const curves = JSON.stringify(tuning);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    setState((s) => (s.open && s.preview ? { ...s, run: s.run + 1 } : s));
  }, [curves]);

  // Una aparición nueva reemplaza a la anterior: la ventana se oculta solo
  // cuando la que sale era la última.
  const open = useRef(state.open);
  open.current = state.open;

  // Se va sola a los pocos segundos; en la prueba se queda para poder afinarla.
  useEffect(() => {
    if (!state.open || state.preview) return;
    const id = setTimeout(close, tuning.permanencia * 1000);
    return () => clearTimeout(id);
  }, [state.open, state.preview, state.run, tuning.permanencia, close]);

  useEffect(() => {
    if (!state.open) return;
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [state.open, close]);

  const session = snap?.session ?? null;
  const attempt = state.preview ? null : (session?.last_attempt ?? null);
  const left = session ? session.ends_at - now : 25 * 60;
  const progress = session ? Math.min(1, Math.max(0, (now - session.started_at) / (session.ends_at - session.started_at))) : 0.4;
  const exit = motionOf(tuning.salida);
  // La frase y el tiempo esperan a que el fondo esté casi puesto.
  const after = tuning.fondo.type === 'easing' ? tuning.fondo.duration * 0.55 : 0.15;

  return (
    <AnimatePresence onExitComplete={() => !open.current && void call('hide_block')}>
      {state.open && (
        <motion.main
          key={state.run}
          className="block"
          onClick={close}
          initial={{ clipPath: 'inset(100% 0 0 0)' }}
          animate={{ clipPath: 'inset(0% 0 0 0)', transition: motionOf(tuning.fondo) }}
          exit={{ opacity: 0, transition: exit }}
        >
          <motion.div
            className="block-time"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.4, delay: after + PHRASE.length * tuning.escalonado + 0.1 } }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" pathLength="1" className="track" />
              <circle cx="12" cy="12" r="9" pathLength="1" strokeDasharray={`${1 - progress} 1`} />
            </svg>
            <span>{clock(left)}</span>
          </motion.div>

          <div className="block-body">
            <h1 aria-label={PHRASE.join(' ')}>
              {PHRASE.map((word, i) => (
                <span key={i} className="line">
                  <motion.span initial={{ y: '110%' }} animate={{ y: 0, transition: motionOf(tuning.texto, after + i * tuning.escalonado) }}>
                    {word}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.4, delay: after + PHRASE.length * tuning.escalonado + 0.1 } }}
            >
              {attempt ? (
                <>
                  <b>{attempt.target}</b> está en pausa hasta que termine la sesión.
                </>
              ) : (
                'Así se ve cuando intentás abrir algo que pusiste en pausa.'
              )}
            </motion.p>
          </div>
        </motion.main>
      )}
    </AnimatePresence>
  );
}
