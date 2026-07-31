import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
// @ts-expect-error
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
// @ts-expect-error
import { TransformControls } from "three/examples/jsm/controls/TransformControls";

interface BodyDef {
  id: number;
  name: string;
  parentId: number;
  size: number;
  color: string;
  pos: [number, number, number];
}

const COLORS = ["#4fc3f7", "#81c784", "#ffb74d", "#e57373", "#ba68c8", "#4dd0e1", "#aed581", "#f06292"];

function mjcfEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function ModelEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const transformRef = useRef<any>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRefs = useRef<Map<number, THREE.Mesh>>(new Map());
  const [bodies, setBodies] = useState<BodyDef[]>([
    { id: 0, name: "world", parentId: -1, size: 0.1, color: "#ffffff", pos: [0, 0, 0] },
  ]);
  const [nextId, setNextId] = useState(1);
  const [selectedBody, setSelectedBody] = useState(0);
  const [editName, setEditName] = useState("body_1");
  const [editSize, setEditSize] = useState(0.15);
  const [editColor, setEditColor] = useState("#4fc3f7");
  const [editParent, setEditParent] = useState(0);
  const [exportXml, setExportXml] = useState("");
  const [mode, setMode] = useState<"translate" | "rotate" | "scale">("translate");

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3, 2, 4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode(mode);
    transform.addEventListener("dragging-changed", (e: any) => {
      controls.enabled = !e.value;
    });
    transform.addEventListener("objectChange", () => {
      const obj = transform.object as THREE.Mesh | null;
      if (!obj) return;
      const id = obj.userData.bodyId;
      if (id === undefined) return;
      setBodies((prev) =>
        prev.map((b) => (b.id === id ? { ...b, pos: [obj.position.x, obj.position.y, obj.position.z] } : b)),
      );
    });
    scene.add(transform);
    transformRef.current = transform;

    const ambient = new THREE.AmbientLight(0x404060);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    const grid = new THREE.GridHelper(4, 16, 0x444466, 0x333355);
    scene.add(grid);

    const loop = () => {
      requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    for (const m of meshRefs.current.values()) {
      scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    meshRefs.current.clear();

    for (const body of bodies) {
      if (body.id === 0 && body.name === "world") continue;
      const geo = new THREE.SphereGeometry(body.size, 16, 16);
      const mat = new THREE.MeshStandardMaterial({ color: body.color, metalness: 0.3, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(body.pos[0], body.pos[1], body.pos[2]);
      mesh.userData.bodyId = body.id;
      mesh.castShadow = true;
      scene.add(mesh);
      meshRefs.current.set(body.id, mesh);
    }

    const tc = transformRef.current;
    if (tc) {
      const sel = meshRefs.current.get(selectedBody);
      tc.attach(sel || null);
    }
  }, [bodies, selectedBody]);

  useEffect(() => {
    if (transformRef.current) transformRef.current.setMode(mode);
  }, [mode]);

  const addBody = () => {
    const parent = selectedBody;
    const pos: [number, number, number] = [Math.random() * 0.5 - 0.25, 0.5, Math.random() * 0.5 - 0.25];
    const newBody: BodyDef = {
      id: nextId,
      name: `body_${nextId}`,
      parentId: parent,
      size: 0.15,
      color: COLORS[nextId % COLORS.length],
      pos,
    };
    setBodies((prev) => [...prev, newBody]);
    setNextId((p) => p + 1);
    setSelectedBody(newBody.id);
  };

  const deleteBody = () => {
    if (selectedBody === 0) return;
    setBodies((prev) => prev.filter((b) => b.id !== selectedBody));
    setSelectedBody(0);
  };

  const updateBody = (id: number, upd: Partial<BodyDef>) => {
    setBodies((prev) => prev.map((b) => (b.id === id ? { ...b, ...upd } : b)));
  };

  const generateMjcf = useCallback(() => {
    const nonWorld = bodies.filter((b) => b.id !== 0);
    let xml = `<?xml version="1.0"?>
<mujoco model="editor_model">
  <worldbody>
    <body name="world" pos="0 0 0">\n`;
    for (const body of nonWorld) {
      const p = body.pos.map((v) => v.toFixed(4)).join(" ");
      xml += `      <body name="${mjcfEscape(body.name)}" pos="${p}">
        <geom type="sphere" size="${body.size.toFixed(4)}" rgba="0.31 0.76 0.97 1"/>
        <joint type="free"/>
      </body>\n`;
    }
    xml += `    </body>
  </worldbody>
</mujoco>`;
    setExportXml(xml);
  }, [bodies]);

  const sel = bodies.find((b) => b.id === selectedBody);

  return (
    <div className="h-full flex gap-4">
      <div className="w-72 flex-shrink-0 space-y-4">
        <h1 className="text-2xl font-bold">Model Editor</h1>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Bodies</h2>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {bodies.map((body) => (
              <button
                key={body.id}
                onClick={() => {
                  setSelectedBody(body.id);
                  setEditName(body.name);
                  setEditSize(body.size);
                  setEditColor(body.color);
                  setEditParent(body.parentId);
                }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedBody === body.id
                    ? "bg-cyan-800 text-cyan-100"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {body.name} {body.id === 0 ? "(root)" : ""}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={addBody}
              className="bg-cyan-700 hover:bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              + Add
            </button>
            <button
              onClick={deleteBody}
              disabled={selectedBody === 0}
              className="bg-red-800 hover:bg-red-700 disabled:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              Delete
            </button>
          </div>
        </div>

        {sel && sel.id !== 0 && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">Properties</h2>
            <div>
              <label className="text-xs text-slate-300">Name</label>
              <input
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  updateBody(sel.id, { name: e.target.value });
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300">Size</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={editSize}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0.1;
                  setEditSize(v);
                  updateBody(sel.id, { size: v });
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300">Color</label>
              <input
                type="color"
                value={editColor}
                onChange={(e) => {
                  setEditColor(e.target.value);
                  updateBody(sel.id, { color: e.target.value });
                }}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300">Parent</label>
              <select
                value={editParent}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setEditParent(v);
                  updateBody(sel.id, { parentId: v });
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
              >
                {bodies.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              {(["translate", "rotate", "scale"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-2 py-1 rounded text-[10px] ${mode === m ? "bg-cyan-700 text-white" : "bg-slate-700 text-slate-300"}`}
                >
                  {m[0].toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
          <button
            onClick={generateMjcf}
            className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium w-full"
          >
            Generate MJCF
          </button>
          {exportXml && (
            <textarea
              readOnly
              value={exportXml}
              className="w-full h-48 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-[10px] font-mono text-slate-300"
            />
          )}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 rounded-xl overflow-hidden border border-slate-700 min-h-0" />
    </div>
  );
}
