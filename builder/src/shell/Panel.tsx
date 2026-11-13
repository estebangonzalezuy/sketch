// Un panel DialKit por entorno (montado con key={env.id}: DialKit no agrega controles en caliente).
// El runtime es la fuente de verdad; el panel le manda cambios y recibe los que escribe el builder.
import { useEffect, useMemo, useRef } from "react";
import { useDialKitController, type DialConfig } from "dialkit";
import type { Env } from "../core/env";
import type { Runtime } from "../core/runtime";
import { clone } from "../core/params";
import { PAIRS } from "../core/palette";

/** Carpeta que el shell agrega al panel de TODOS los entornos: los 4 pares cerrados, como botones. */
const COLOR = "color";

export function Panel({ rt, env }: { rt: Runtime; env: Env }) {
  // params del entorno + los presets de color (son actions: no entran en los params ni en el preset JSON)
  const config = useMemo(() => {
    const color: Record<string, unknown> = {};
    PAIRS.forEach((p, i) => (color[`par${i}`] = { type: "action", label: p.name }));
    color.invertir = { type: "action", label: "invertir" };
    return { ...env.params, [COLOR]: color } as DialConfig;
  }, [env]);

  const dial = useDialKitController(env.title, config, {
    id: env.id,
    onAction: (path: string) => {
      if (path === `${COLOR}.invertir`) rt.toggleInvert();
      else if (path.startsWith(`${COLOR}.par`)) rt.setPair(Number(path.slice(COLOR.length + 4)));
      else void rt.runAction(path);
    },
  });
  const synced = useRef(false);
  const setValues = dial.setValues;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rt.panelSetValues = (p) => setValues(p as any);
    return () => {
      rt.panelSetValues = null;
    };
  }, [rt, setValues]);

  useEffect(() => {
    if (!synced.current) {
      // primer valor del panel: puede venir de un montaje anterior; manda el runtime (URL, preset)
      synced.current = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValues(clone(rt.params) as any);
      return;
    }
    const values = clone(dial.values) as Record<string, unknown>;
    delete values[COLOR]; // la carpeta de color es del shell, no un param del entorno
    rt.setParams(values);
  }, [dial.values, rt, setValues]);

  return null;
}
