import { parseProject, type Project } from '../core/project';
import type { AssetLibrary } from '../engine/assets';
import type { EditorStore } from './store';

const FILE_TYPES = [{ description: 'Proyecto de Motion Builder', accept: { 'application/json': ['.json'] } }];

const IMAGE_TYPES = [{ description: 'Imagen', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] } }];

type PickerOptions = { suggestedName?: string; types?: typeof FILE_TYPES };

declare global {
  interface Window {
    showOpenFilePicker(options?: PickerOptions): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: PickerOptions): Promise<FileSystemFileHandle>;
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite'; startIn?: FileSystemHandle }): Promise<FileSystemDirectoryHandle>;
  }
}

export const serializeProject = (project: Project) => `${JSON.stringify(project, null, 2)}\n`;

const isCancel = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** Archivo .json del proyecto, con la File System Access API. Recuerda dónde guardó. */
export class ProjectFile {
  private handle: FileSystemFileHandle | null = null;
  private folder: FileSystemDirectoryHandle | null = null; // el navegador no da la carpeta de un archivo: se pide si hay imágenes

  constructor(private assets: AssetLibrary) {}

  get name() {
    return this.handle?.name ?? null;
  }

  forget() {
    this.handle = null;
    this.folder = null;
  }

  private async projectFolder() {
    this.folder ??= await window.showDirectoryPicker({ mode: 'readwrite', ...(this.handle ? { startIn: this.handle } : {}) });
    return this.folder;
  }

  private async readAssets(project: Project) {
    const folder = await this.projectFolder();
    const missing: string[] = [];
    for (const asset of project.assets) {
      try {
        const file = await (await (await folder.getDirectoryHandle('assets')).getFileHandle(asset.path.replace(/^assets\//, ''))).getFile();
        await this.assets.add(asset.id, file);
      } catch {
        missing.push(asset.path);
      }
    }
    if (missing.length) throw new Error(`Faltan imágenes: ${missing.join(', ')}`);
  }

  private async writeAssets(project: Project) {
    const folder = await (await this.projectFolder()).getDirectoryHandle('assets', { create: true });
    for (const asset of project.assets) {
      const blob = this.assets.blob(asset.id);
      if (!blob) continue;
      const writable = await (await folder.getFileHandle(asset.path.replace(/^assets\//, ''), { create: true })).createWritable();
      await writable.write(blob);
      await writable.close();
    }
  }

  /** Devuelve null si se canceló el diálogo. Valida con Zod: un archivo roto no reemplaza al proyecto abierto. */
  async open(): Promise<Project | null> {
    try {
      const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES });
      const project = parseProject(JSON.parse(await (await handle.getFile()).text()));
      this.handle = handle;
      this.folder = null;
      if (project.assets.length) await this.readAssets(project);
      return project;
    } catch (e) {
      if (isCancel(e)) return null;
      throw e;
    }
  }

  async save(project: Project, saveAs = false): Promise<boolean> {
    try {
      this.handle = !saveAs && this.handle ? this.handle : await window.showSaveFilePicker({ suggestedName: `${project.name}.json`, types: FILE_TYPES });
      const writable = await this.handle.createWritable();
      await writable.write(serializeProject(project));
      await writable.close();
      if (project.assets.length) await this.writeAssets(project);
      return true;
    } catch (e) {
      if (isCancel(e)) return false;
      throw e;
    }
  }
}

/** Devuelve el archivo elegido, o null si se canceló. */
export async function pickImage() {
  try {
    const [handle] = await window.showOpenFilePicker({ types: IMAGE_TYPES as unknown as typeof FILE_TYPES });
    return handle.getFile();
  } catch (e) {
    if (isCancel(e)) return null;
    throw e;
  }
}

const DB = 'motion-builder';
const STORE = 'autosave';
const ASSETS = 'assets';
const KEY = 'current';

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      for (const name of [STORE, ASSETS]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>, name = STORE) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(name, mode).objectStore(name));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

/** Último autosave con sus imágenes, o null si no hay o ya no es válido. */
export async function loadAutosave(assets: AssetLibrary): Promise<Project | null> {
  const raw = await run('readonly', (s) => s.get(KEY));
  if (!raw) return null;
  try {
    const project = parseProject(JSON.parse(raw));
    for (const asset of project.assets) {
      const blob = await run<Blob | undefined>('readonly', (s) => s.get(asset.id), ASSETS);
      if (blob) await assets.add(asset.id, blob);
    }
    return project;
  } catch (e) {
    console.warn('Autosave inválido, se ignora', e);
    return null;
  }
}

/** Guarda en IndexedDB cada segundo, si el proyecto cambió. */
export function startAutosave(store: EditorStore) {
  let last = store.getState().project;
  const timer = setInterval(() => {
    const { project } = store.getState();
    if (project === last) return;
    last = project;
    void run('readwrite', (s) => s.put(serializeProject(project), KEY));
    for (const asset of project.assets) {
      const blob = store.assets.blob(asset.id);
      if (blob) void run('readwrite', (s) => s.put(blob, asset.id), ASSETS);
    }
  }, 1000);
  return () => clearInterval(timer);
}
