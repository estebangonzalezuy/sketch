// Un panel DialKit por entorno (montado con key={env.id}: DialKit no agrega controles en caliente).
// El runtime es la fuente de verdad; el panel le manda cambios y recibe los que escribe el builder.
import { useEffect, useRef } from "react";
import { useDialKitController } from "dialkit";
import type { Env } from "../core/env";
import type { Runtime } from "../core/runtime";
import { clone } from "../core/params";

export function Panel({ rt, env }: { rt: Runtime; env: Env }) {
  const dial = useDialKitController(env.title, env.params, {
    id: env.id,
    onAction: (path: string) => void rt.runAction(path),
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
    rt.setParams(clone(dial.values));
  }, [dial.values, rt, setValues]);

  return null;
}
