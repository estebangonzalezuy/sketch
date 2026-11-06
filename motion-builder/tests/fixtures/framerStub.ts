/** Lo mínimo de Framer para montar el componente original y compararlo. */
export const addPropertyControls = () => {};
export const ControlType = new Proxy({}, { get: (_, key) => key });
export const RenderTarget = { canvas: 'canvas', preview: 'preview', current: () => 'preview' };
