import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'dialkit/styles.css';
import './styles.css';
import { Block } from './Block';
import { inTauri } from './ipc';
import { Panel } from './Panel';

// Las dos ventanas cargan el mismo bundle; la de bloqueado llega con ?view=block.
const view = new URLSearchParams(location.search).get('view');
document.documentElement.dataset.view = view ?? 'panel';
document.documentElement.dataset.host = inTauri ? 'tauri' : 'browser';

createRoot(document.getElementById('root')!).render(<StrictMode>{view === 'block' ? <Block /> : <Panel />}</StrictMode>);
