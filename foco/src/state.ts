import { useCallback, useEffect, useRef, useState } from 'react';
import { call, on } from './ipc';
import type { Config, Snapshot } from './types';

/** El estado del helper: lo empuja Rust cada vez que cambia. */
export function useSnapshot(): [Snapshot | null, (s: Snapshot) => void] {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  useEffect(() => {
    const off = on('status', setSnap);
    call('snapshot').then(setSnap);
    return off;
  }, []);
  return [snap, setSnap];
}

/** La configuración: se edita acá y se guarda sola, con un respiro entre escrituras. */
export function useConfig(): [Config | null, (patch: Partial<Config>) => void] {
  const [config, setConfig] = useState<Config | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    call('get_config').then(setConfig);
    return on('config', setConfig);
  }, []);

  const update = useCallback((patch: Partial<Config>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void call('set_config', { config: next }), 150);
      return next;
    });
  }, []);

  return [config, update];
}

/** Pone el acento elegido en la variable CSS que usa toda la interfaz. */
export function useAccent(config: Config | null) {
  useEffect(() => {
    if (config?.accent) document.documentElement.style.setProperty('--accent', config.accent);
  }, [config?.accent]);
}
