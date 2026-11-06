import type { Layer } from '../core/project';

/** Ordena las capas para que cada una se renderice después de sus entradas. Rechaza ciclos. */
export function renderOrder(layers: Layer[]): Layer[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const done = new Set<string>();
  const order: Layer[] = [];

  const visit = (layer: Layer, path: Layer[]) => {
    if (done.has(layer.id)) return;
    const seen = path.indexOf(layer);
    if (seen !== -1) {
      const cycle = [...path.slice(seen), layer].map((l) => l.name).join(' → ');
      throw new Error(`Ciclo de entradas: ${cycle}`);
    }
    for (const input of Object.values(layer.inputs)) {
      const dep = input && 'layerId' in input ? byId.get(input.layerId) : undefined;
      if (dep) visit(dep, [...path, layer]);
    }
    done.add(layer.id);
    order.push(layer);
  };

  layers.forEach((l) => visit(l, []));
  return order;
}
