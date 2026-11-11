import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/800.css'
import 'dialkit/styles.css'
import './ui/app.css'
import { App } from './ui/App'
import { rt, renderMp4, renderPng } from './runtime'
import * as actions from './store'
import { useStore, loadScene } from './store'
import { PRESETS } from './scene/presets'

createRoot(document.getElementById('root')!).render(<App />)

// Gancho para automatizar renders (scripts/examples.cjs lo usa para generar los loops de ejemplo).
;(window as any).__vitro = { rt, useStore, loadScene, PRESETS, renderMp4, renderPng, actions }
