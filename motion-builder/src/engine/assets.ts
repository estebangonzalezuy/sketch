import * as THREE from 'three';

/** Imágenes del proyecto en memoria. El proyecto solo guarda su ruta relativa. */
export class AssetLibrary {
  private images = new Map<string, { blob: Blob; bitmap: ImageBitmap }>();

  async add(id: string, blob: Blob) {
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    this.images.set(id, { blob, bitmap });
  }

  bitmap = (id: string) => this.images.get(id)?.bitmap;
  blob = (id: string) => this.images.get(id)?.blob;
  ids = () => [...this.images.keys()];
}

/** Texturas de entrada: la imagen ajustada al cuadro en modo cover, en premultiplied alpha. */
export class AssetTextures {
  private entries = new Map<string, { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; bitmap: ImageBitmap }>();

  get(id: string, bitmap: ImageBitmap, width: number, height: number) {
    const key = `${id}:${width}x${height}`;
    const cached = this.entries.get(key);
    if (cached?.bitmap === bitmap) return cached.texture;
    cached?.texture.dispose();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const [w, h] = [bitmap.width * scale, bitmap.height * scale];
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.premultiplyAlpha = true;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    this.entries.set(key, { canvas, texture, bitmap });
    return texture;
  }

  dispose() {
    this.entries.forEach((e) => e.texture.dispose());
    this.entries.clear();
  }
}
