import * as THREE from "three";
// @ts-expect-error
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

interface BodyInfo {
  name: string;
  parent: number;
}

export interface SimMeta {
  body_names: string[];
  body_parents: number[];
  joint_names: string[];
  actuator_names: string[];
}

export interface SimState {
  time: number;
  step: number;
  body_positions: number[][];
  body_orientations: number[][];
  qpos: number[];
}

const BODY_COLORS = [
  0x4fc3f7, 0x81c784, 0xffb74d, 0xe57373, 0xba68c8, 0x4dd0e1, 0xaed581, 0xffd54f, 0xf06292, 0x9575cd,
];

export class SimRenderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  bodies: THREE.Mesh[] = [];
  bones: THREE.LineSegments[] = [];
  ground: THREE.Mesh;
  container: HTMLElement;
  animFrame = 0;
  meta: SimMeta | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(4, 3, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 0.5, 0);

    const ambient = new THREE.AmbientLight(0x404060);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x4488ff, 0.5);
    fill.position.set(-3, 2, -4);
    this.scene.add(fill);

    const grid = new THREE.GridHelper(10, 20, 0x444466, 0x333355);
    this.scene.add(grid);

    const geo = new THREE.PlaneGeometry(10, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.01;
    this.scene.add(this.ground);

    window.addEventListener("resize", this._onResize);
  }

  private _onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  buildScene(meta: SimMeta) {
    this.meta = meta;
    this._clearBodies();
    const names = meta.body_names;
    const _parents = meta.body_parents;
    for (let i = 0; i < names.length; i++) {
      const color = BODY_COLORS[i % BODY_COLORS.length];
      const size = i === 0 ? 0.08 : 0.04;
      const geo = new THREE.SphereGeometry(size, 12, 12);
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.bodies.push(mesh);
    }
    this._rebuildBones();
  }

  private _clearBodies() {
    for (const m of this.bodies) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.bodies = [];
    this._clearBones();
  }

  private _clearBones() {
    for (const b of this.bones) {
      this.scene.remove(b);
      b.geometry.dispose();
      (b.material as THREE.Material).dispose();
    }
    this.bones = [];
  }

  private _rebuildBones() {
    this._clearBones();
    if (!this.meta) return;
    const parents = this.meta.body_parents;
    if (this.bodies.length < 2) return;
    const positions: number[] = [];
    for (let i = 0; i < this.bodies.length; i++) {
      const p = parents[i];
      if (p >= 0 && p < this.bodies.length) {
        const a = this.bodies[p].position;
        const b = this.bodies[i].position;
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    if (positions.length === 0) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x4488cc, transparent: true, opacity: 0.4 });
    const lines = new THREE.LineSegments(geo, mat);
    this.scene.add(lines);
    this.bones.push(lines);
  }

  updateState(state: SimState) {
    const pos = state.body_positions;
    const quat = state.body_orientations;
    for (let i = 0; i < this.bodies.length && i < pos.length; i++) {
      this.bodies[i].position.set(pos[i][0], pos[i][1], pos[i][2]);
      if (quat && i < quat.length) {
        this.bodies[i].quaternion.set(quat[i][0], quat[i][1], quat[i][2], quat[i][3]);
      }
    }
    this._rebuildBones();
  }

  startLoop() {
    const loop = () => {
      this.animFrame = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stopLoop() {
    cancelAnimationFrame(this.animFrame);
  }

  destroy() {
    this.stopLoop();
    this._clearBodies();
    this._clearBones();
    this.scene.remove(this.ground);
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    window.removeEventListener("resize", this._onResize);
  }
}
