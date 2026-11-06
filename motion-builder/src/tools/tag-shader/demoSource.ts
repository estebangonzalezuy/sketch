import * as THREE from 'three';

/**
 * Fuente interna cuando la capa no tiene entrada: un nudo y una esfera a un render target offscreen
 * de baja resolución. El shader del mosaico solo lee de ahí luminancia y color.
 * El target queda en lineal: el mosaico lo codifica al leerlo (uSourceLinear).
 */
const RT_W = 480; // alcanza y sobra: se muestrea una vez por bloque
const TAU = Math.PI * 2;

export class DemoSource {
  readonly rt = new THREE.WebGLRenderTarget(RT_W, RT_W, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
  });

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  private pivot = new THREE.Group();
  private demo = new THREE.Group();
  private aspect = 0;

  constructor() {
    this.scene.background = new THREE.Color(0x000000);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x202020, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2.5, 3, 4);
    const rim = new THREE.DirectionalLight(0xffffff, 1.4);
    rim.position.set(-3, 1, -2.5);
    this.scene.add(key, rim, this.pivot);

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.2, 300, 40, 2, 3), mat);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 64, 32), mat);
    this.demo.add(knot, ball);
    this.pivot.add(this.demo);
  }

  setAspect(aspect: number) {
    if (aspect === this.aspect) return;
    this.aspect = aspect;
    this.rt.setSize(RT_W, Math.round(RT_W / aspect));
    this.camera.aspect = aspect;
    // Cámara a una distancia que encuadra una esfera de radio 1 en cualquier aspect.
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const dist = 1.05 / Math.sin(Math.min(vfov, hfov) / 2);
    this.camera.position.set(0, 0, dist);
    this.camera.near = dist / 100;
    this.camera.far = dist * 10;
    this.camera.updateProjectionMatrix();
  }

  /** turns: vueltas acumuladas del pivote · phase: fase del movimiento secundario, con período 1. */
  update(turns: number, phase: number) {
    this.pivot.rotation.y = TAU * turns;
    this.demo.rotation.x = 0.35 * Math.sin(TAU * phase);
    this.demo.children[1].position.set(Math.cos(TAU * phase) * 0.9, Math.sin(TAU * 2 * phase) * 0.25, Math.sin(TAU * phase) * 0.9);
  }

  render(renderer: THREE.WebGLRenderer) {
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.rt.dispose();
    this.pivot.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    ((this.demo.children[0] as THREE.Mesh).material as THREE.Material).dispose();
  }
}
