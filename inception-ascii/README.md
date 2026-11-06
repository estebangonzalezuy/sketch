# Inception ASCII

Herramienta para pasar imágenes a ASCII y armar transiciones entre ellas. Viene con las 9 cards de los papers de inceptionlabs.ai/about. Exporta texto, PNG, GIF, video y MP4 4K.

Es una sola página estática, `index.html`, sin build. Se abre el archivo en el navegador o se sirve la carpeta:

```bash
npx serve inception-ascii
```

Necesita red: carga las tipografías de Google Fonts y mp4-muxer desde el CDN de jsdelivr (solo para el MP4 4K).

El proyecto se guarda en el navegador (IndexedDB), no en el repo.

Viene de estebangonzalezuy/motion-builder, rama `inception-ascii`, commit 4bc4dd9.
