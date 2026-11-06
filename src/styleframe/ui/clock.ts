import { useSyncExternalStore } from 'react';

/** Playhead state outside React, so 60 fps playback doesn't re-render the control panel. */
export class Clock {
  t = 0;
  playing = false;
  private listeners = new Set<() => void>();
  private version = 0;

  set(t: number) {
    if (t === this.t) return;
    this.t = t;
    this.emit();
  }
  setPlaying(v: boolean) {
    this.playing = v;
    this.emit();
  }
  emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.version;
}

export function useClock(clock: Clock) {
  useSyncExternalStore(clock.subscribe, clock.snapshot);
  return clock;
}
