import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from '../../lib/router';
import {
  exportPNG,
  exportVideo,
  download,
  frameCount,
  renderStill,
  type Container,
  type FrameRenderer,
} from '../export';
import { loadArchivo } from '../fonts';
import { evalTimeline, totalDuration, type Phase } from '../timeline';
import { FORMATS, resolvePalette } from '../tokens';
import type { AnyTool, Common } from '../types';
import { Clock, useClock } from './clock';
import { PalettePicker, Section, Segmented, Slider, Text, Toggle } from './controls';
import { CurveEditor } from './CurveEditor';
import { Timeline } from './Timeline';
import { TOOLS } from '../../tools/registry';

const BASE_COMMON: Common = {
  format: '1:1',
  palette: { preset: 'white', bg: 'indigo', fg: 'white' },
  pixel: true,
  cell: 6,
  label: '',
  fps: 30,
};

const clonePhases = (p: Phase[]) => p.map((x) => ({ ...x, ease: [...x.ease] as Phase['ease'] }));

type ExportState = { what: string; progress: number; abort?: AbortController } | null;

declare global {
  interface Window {
    __styleframe?: {
      id: string;
      ready: boolean;
      duration: number;
      fps: number;
      frame: (t: number) => string;
      video: (c: Container) => Promise<{ base64: string; codec: string }>;
    };
  }
}

export function Shell({ tool }: { tool: AnyTool }) {
  const initialCommon = useMemo(
    () => ({ ...BASE_COMMON, label: `tMSC / ${tool.name} ${tool.number}`, ...tool.common }),
    [tool],
  );
  const [params, setParams] = useState(() => ({ ...tool.defaults }));
  const [common, setCommon] = useState<Common>(initialCommon);
  const [phases, setPhases] = useState(() => clonePhases(tool.phases));
  const [selected, setSelected] = useState<string | null>(tool.phases[0]?.id ?? null);
  // `undefined` is "still loading". `null` is a tool with no assets (Bitmap Reveal).
  const [assets, setAssets] = useState<unknown>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loop, setLoop] = useState(true);
  const [exporting, setExporting] = useState<ExportState>(null);
  const clock = useMemo(() => new Clock(), []);
  useClock(clock);

  const canvas = useRef<HTMLCanvasElement>(null);
  const { w, h } = FORMATS[common.format];
  const duration = totalDuration(phases);
  const key = tool.assetsKey(params, common);

  useEffect(() => {
    let live = true;
    Promise.all([loadArchivo(), tool.load(params, common)])
      .then(([, a]) => {
        if (!live) return;
        setAssets(a);
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // Reload only when the tool says its assets changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, key]);

  const render: FrameRenderer | null = useMemo(() => {
    if (assets === undefined) return null;
    const pal = resolvePalette(common.palette);
    return (ctx, t) => {
      const { width, height } = ctx.canvas;
      ctx.save();
      tool.render(
        ctx,
        { t, w: width, h: height, u: height / 1080, tl: evalTimeline(phases, t), pal, common },
        params,
        assets,
      );
      ctx.restore();
    };
  }, [assets, common, phases, params, tool]);

  // Playback + redraw loop. Draws only when the frame or the inputs changed.
  const renderRef = useRef(render);
  const dirty = useRef(true);
  useEffect(() => {
    renderRef.current = render;
    dirty.current = true;
  }, [render, w, h]);
  useEffect(() => clock.subscribe(() => (dirty.current = true)), [clock]);
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (clock.playing) {
        let t = clock.t + dt;
        if (t >= duration) {
          if (loopRef.current) t = t % duration;
          else {
            t = duration - 1 / common.fps;
            clock.setPlaying(false);
          }
        }
        clock.set(t);
      }
      const r = renderRef.current;
      const c = canvas.current;
      if (dirty.current && r && c) {
        dirty.current = false;
        r(c.getContext('2d', { alpha: false })!, Math.min(clock.t, duration));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, duration, common.fps]);

  // Clamp the playhead when the timeline gets shorter.
  useEffect(() => {
    if (clock.t > duration) clock.set(duration);
  }, [clock, duration]);

  const slug = `tmsc-${tool.id}-${tool.number}`;

  const doPNG = useCallback(async () => {
    if (!render) return;
    const blob = await exportPNG(w, h, render, clock.t);
    download(blob, `${slug}_f${String(Math.round(clock.t * common.fps)).padStart(4, '0')}.png`);
  }, [render, w, h, clock, slug, common.fps]);

  const doVideo = useCallback(
    async (container: Container) => {
      if (!render || exporting) return;
      const abort = new AbortController();
      setExporting({ what: container.toUpperCase(), progress: 0, abort });
      clock.setPlaying(false);
      try {
        const { blob } = await exportVideo({
          width: w,
          height: h,
          fps: common.fps,
          duration,
          render,
          container,
          signal: abort.signal,
          onProgress: (p) => setExporting((s) => (s ? { ...s, progress: p } : s)),
        });
        download(blob, `${slug}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      } finally {
        setExporting(null);
      }
    },
    [render, exporting, clock, w, h, common.fps, duration, slug],
  );

  // Headless hook used by scripts/render-styleframes.ts.
  useEffect(() => {
    window.__styleframe = {
      id: tool.id,
      ready: !!render,
      duration,
      fps: common.fps,
      frame: (t) => (render ? renderStill(w, h, render, t).toDataURL('image/png') : ''),
      video: async (container) => {
        if (!render) throw new Error('not ready');
        const { blob, codec } = await exportVideo({
          width: w,
          height: h,
          fps: common.fps,
          duration,
          render,
          container,
        });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000)
          bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { base64: btoa(bin), codec };
      },
    };
  }, [tool.id, render, duration, common.fps, w, h]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select')) return;
      const step = 1 / common.fps;
      if (e.key === ' ') {
        e.preventDefault();
        if (!clock.playing && clock.t >= duration - step) clock.set(0);
        clock.setPlaying(!clock.playing);
      } else if (e.key === 'ArrowRight')
        clock.set(Math.min(duration, clock.t + step * (e.shiftKey ? 10 : 1)));
      else if (e.key === 'ArrowLeft')
        clock.set(Math.max(0, clock.t - step * (e.shiftKey ? 10 : 1)));
      else if (e.key === 'Home') clock.set(0);
      else if (e.key === 'End') clock.set(duration - step);
      else return;
      clock.setPlaying(e.key === ' ' ? clock.playing : false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clock, duration, common.fps]);

  useEffect(() => {
    clock.setPlaying(true);
    return () => clock.setPlaying(false);
  }, [clock]);

  const set = useCallback((patch: object) => setParams((p: object) => ({ ...p, ...patch })), []);
  const setC = (patch: Partial<Common>) => setCommon((c) => ({ ...c, ...patch }));
  const sel = phases.find((p) => p.id === selected);
  const selState = sel ? evalTimeline(phases, clock.t).get(sel.id) : null;
  const frames = frameCount(duration, common.fps);
  const frame = Math.min(frames - 1, Math.round(clock.t * common.fps));

  const reset = () => {
    setParams({ ...tool.defaults });
    setCommon(initialCommon);
    setPhases(clonePhases(tool.phases));
  };

  const Controls = tool.Controls;

  return (
    <div className="sf">
      <header className="sf-head">
        <Link to="/tools" className="sf-brand">
          tMSC / Styleframe Tools
        </Link>
        <nav>
          {TOOLS.map((t) => (
            <Link key={t.id} to={`/tools/${t.id}`} className={t.id === tool.id ? 'on' : ''}>
              <span>{t.number}</span> {t.name}
            </Link>
          ))}
        </nav>
        <div className="sf-export">
          {exporting ? (
            <>
              <span className="sf-progress" style={{ '--p': exporting.progress } as CSSProperties}>
                {exporting.what} {Math.round(exporting.progress * 100)}%
              </span>
              <button type="button" onClick={() => exporting.abort?.abort()}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={doPNG} disabled={!render}>
                PNG frame
              </button>
              <button type="button" onClick={() => doVideo('mp4')} disabled={!render}>
                MP4
              </button>
              <button type="button" onClick={() => doVideo('webm')} disabled={!render}>
                WebM
              </button>
            </>
          )}
        </div>
      </header>

      <main className="sf-stage">
        <canvas
          ref={canvas}
          width={w}
          height={h}
          style={{ aspectRatio: `${w} / ${h}` }}
          aria-label={`${tool.name} preview`}
        />
        {!render && !error && <p className="sf-note">Loading outlines and fonts…</p>}
        {error && <p className="sf-note err">{error}</p>}
      </main>

      <div className="sf-bottom">
        <div className="sf-transport">
          <button type="button" onClick={() => clock.set(0)} aria-label="Go to start">
            |◂
          </button>
          <button
            type="button"
            onClick={() => clock.set(Math.max(0, clock.t - 1 / common.fps))}
            aria-label="Previous frame"
          >
            ◂
          </button>
          <button
            type="button"
            className="play"
            onClick={() => {
              if (!clock.playing && clock.t >= duration - 1 / common.fps) clock.set(0);
              clock.setPlaying(!clock.playing);
            }}
          >
            {clock.playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => clock.set(Math.min(duration, clock.t + 1 / common.fps))}
            aria-label="Next frame"
          >
            ▸
          </button>
          <label className="sf-loop">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />{' '}
            Loop
          </label>
          <span className="sf-time">
            {clock.t.toFixed(2)}s / {duration.toFixed(2)}s · f {String(frame).padStart(3, '0')}/
            {frames} · {common.fps} fps · {w}×{h}
          </span>
        </div>
        <Timeline
          phases={phases}
          clock={clock}
          fps={common.fps}
          selected={selected}
          onSelect={setSelected}
          onResize={(id, d) =>
            setPhases((ps) => ps.map((p) => (p.id === id ? { ...p, duration: d } : p)))
          }
        />
      </div>

      <aside className="sf-panel">
        <div className="sf-panel-head">
          <h1>
            <span>{tool.number}</span> {tool.name}
          </h1>
          <p>{tool.blurb}</p>
          <button type="button" className="sf-reset" onClick={reset}>
            Reset
          </button>
        </div>

        <Controls params={params} set={set} common={common} />

        <Section title="Timing">
          <div className="sf-phases">
            {phases.map((p) => (
              <div key={p.id} className={`sf-phase-row${p.id === selected ? ' sel' : ''}`}>
                <button type="button" onClick={() => setSelected(p.id)}>
                  {p.label}
                </button>
                <input
                  type="number"
                  min={0.05}
                  max={10}
                  step={0.05}
                  value={p.duration}
                  aria-label={`${p.label} duration (s)`}
                  onChange={(e) =>
                    setPhases((ps) =>
                      ps.map((x) =>
                        x.id === p.id
                          ? { ...x, duration: Math.max(0.05, +e.target.value || 0.05) }
                          : x,
                      ),
                    )
                  }
                />
                <span>s</span>
              </div>
            ))}
          </div>
          {sel && (
            <CurveEditor
              label={`Easing · ${sel.label}`}
              value={sel.ease}
              progress={selState?.raw}
              onChange={(ease) =>
                setPhases((ps) => ps.map((x) => (x.id === sel.id ? { ...x, ease } : x)))
              }
            />
          )}
        </Section>

        <Section title="Look">
          <PalettePicker value={common.palette} onChange={(palette) => setC({ palette })} />
          <Segmented
            label="Format"
            value={common.format}
            options={[
              { value: '1:1', label: '1:1' },
              { value: '16:9', label: '16:9' },
            ]}
            onChange={(format) => setC({ format })}
          />
          <Toggle label="Bitmap" value={common.pixel} onChange={(pixel) => setC({ pixel })} />
          <Slider
            label="Cell"
            value={common.cell}
            min={2}
            max={16}
            onChange={(cell) => setC({ cell })}
            unit="px"
          />
          <Text
            label="Label"
            value={common.label}
            onChange={(label) => setC({ label })}
            maxLength={48}
          />
          <Segmented
            label="FPS"
            value={common.fps}
            options={[
              { value: 24, label: '24' },
              { value: 30, label: '30' },
              { value: 60, label: '60' },
            ]}
            onChange={(fps) => setC({ fps })}
          />
        </Section>
      </aside>
    </div>
  );
}
