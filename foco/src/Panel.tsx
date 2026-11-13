import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { call, on } from './ipc';
import { useAccent, useConfig, useSnapshot } from './state';
import { motionOf, tuningOf } from './tuning';
import { History } from './views/History';
import { Install } from './views/Install';
import { Running } from './views/Running';
import { Setup } from './views/Setup';
import { Summary } from './views/Summary';
import { Curves } from './views/Curves';

type View = 'main' | 'history' | 'tuning';

/** El popover de la barra de menú. Una vista por vez; la ventana sigue su alto. */
export function Panel() {
  const [snap, setSnap] = useSnapshot();
  const [config, update] = useConfig();
  const [view, setView] = useState<View>(() => (new URLSearchParams(location.search).get('panel') as View) ?? 'main');
  const shell = useRef<HTMLDivElement>(null);
  useAccent(config);

  useEffect(() => on('view', setView), []);

  useLayoutEffect(() => {
    const el = shell.current;
    if (!el) return;
    // El alto máximo: la pantalla menos la barra de menú y un margen.
    el.style.setProperty('--room', `${Math.max(320, window.screen.availHeight - 24)}px`);
    const fit = () => void call('resize_panel', { height: Math.ceil(el.getBoundingClientRect().height) });
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as HTMLElement).closest('input, [role="listbox"]')) return;
      void call('hide_block');
      void call('hide_panel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!snap || !config) return <div ref={shell} className="shell" />;

  let key: string;
  let body: React.ReactNode;
  if (view === 'tuning') {
    key = 'tuning';
    body = <Curves config={config} update={update} onBack={() => setView('main')} />;
  } else if (view === 'history') {
    key = 'history';
    body = <History onBack={() => setView('main')} />;
  } else if (snap.helper !== 'ok') {
    key = 'install';
    body = <Install snap={snap} onDone={setSnap} />;
  } else if (snap.session) {
    key = 'running';
    body = <Running session={snap.session} snifferOk={snap.sniffer_ok} onChange={setSnap} />;
  } else if (snap.last_finished) {
    key = 'summary';
    body = <Summary record={snap.last_finished} onDone={setSnap} />;
  } else {
    key = 'setup';
    body = <Setup config={config} update={update} onStart={setSnap} onHistory={() => setView('history')} />;
  }

  const spring = motionOf(tuningOf(config).panel);
  return (
    <div ref={shell} className="shell dialkit-root" data-theme="dark" data-mode="inline">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={key}
          className="view"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: spring }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
