const SIM_ROS = [
  {
    repo: "gazebo-mcp",
    ports: "10990/10991",
    why: "SDF worlds, ROS 2 topics — outdoor, sensor-heavy sims. MuJoCo’s counterpart for full sensor suites.",
  },
  {
    repo: "isaac-mcp",
    ports: "11048/11049",
    why: "Isaac Sim/Lab — GPU photoreal + USD scenes. Use when you need synthetic perception data.",
  },
  {
    repo: "ros-mcp",
    ports: "11050/11051",
    why: "Native ROS 2 bridge (topics/services/bags). Gazebo talks ROS; MuJoCo talks MPC. This shims both.",
  },
];

const ROBOTICS = [
  {
    repo: "limx-robotics-mcp",
    ports: "11044/11045",
    why: "LimX TRON 1 + Oli — wraps *this* MuJoCo server with VLA policies + real hardware.",
  },
  {
    repo: "unitree-mcp",
    ports: "11052/11053",
    why: "Unitree Go2 / H1 / G1 — MuJoCo + ROS 2, same depot as here, different morphologies.",
  },
  { repo: "yahboom-mcp", ports: "10792/10793", why: "Yahboom ROSMaster — cheap ROS arms/cars for real-world replay." },
  {
    repo: "norirobotics-mcp",
    ports: "11970/11971",
    why: "Nori A3 (19-DoF bimanual) — LeRobot recording, feeds vla-mcp.",
  },
];

const VR = [
  {
    repo: "overte-mcp",
    ports: "11110/11111",
    why: "Overte (open VR) — social VR scene graph. Pair with mujoco 3D Viewer for teleop.",
  },
  {
    repo: "vrchat-mcp",
    ports: "10712",
    why: "VRChat OSC — avatar pipeline. Drive a mujoco humanoid from VRChat tracking.",
  },
  {
    repo: "resonite-mcp",
    ports: "10978/10979",
    why: "Resonite — advanced VR world import. Proto for VR→sim pose streaming.",
  },
  {
    repo: "teleoperator-mcp",
    ports: "10900/10901",
    why: "WebXR (Pico/Meta) → fleet. Streams head+hands to Goliath; mujoco consumes the pose.",
  },
];

export default function Fleet() {
  return (
    <div className="max-w-5xl space-y-6" data-testid="fleet-page">
      <div>
        <h1 className="text-2xl font-bold">Fleet — where MuJoCo fits</h1>
        <p className="text-sm text-slate-300 mt-1">
          213 repos · physics/research stack. <span className="font-mono text-cyan-400">mujoco-mcp</span> is the CPU
          fast path. Isaac is the GPU photoreal path. Gazebo is the sensor/ROS path. This page maps the three and the VR
          teleop that drives them.
        </p>
      </div>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5" data-testid="fleet-diagram">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Pipeline</h2>
        <pre className="bg-slate-900 text-green-300 text-sm p-4 rounded font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
          {`VLA policy (limx / unitree / vla-mcp)
        │  joint targets
        ▼
mujoco-mcp ─── 10–50× realtime CPU sim ───► reward / contact check
        │                │
        │ ws:body_positions                │ json: state.json
        ▼                ▼
  3D Viewer      ros-mcp bridge ──► real robot (Unitree/Yahboom/Nori)
        │
        │ WebXR pose (teleoperator-mcp)
        ▼
  Overte / Resonite / VRChat  (human teleop → joint targets loop)`}
        </pre>
        <p className="text-sm text-slate-300 mt-3">
          Train in mujoco-mcp (cheap, fast, differentiable), validate in{" "}
          <span className="font-mono text-cyan-400">isaac-mcp</span> (photoreal, RTX), field in{" "}
          <span className="font-mono text-cyan-400">gazebo-mcp</span> (sensors, ROS). Same MJCF → USD/SDF via convert
          scripts in <code className="bg-slate-700 px-1 rounded">scripts/</code>.
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="fleet-tiles">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-cyan-300 mb-3">Sim / ROS layer</h3>
          <div className="space-y-3">
            {SIM_ROS.map((r) => (
              <div key={r.repo} className="border-t border-slate-700 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-cyan-400">{r.repo}</span>
                  <span className="font-mono text-sm text-slate-300">{r.ports}</span>
                </div>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed">{r.why}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-cyan-300 mb-3">Robotics layer</h3>
          <div className="space-y-3">
            {ROBOTICS.map((r) => (
              <div key={r.repo} className="border-t border-slate-700 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-cyan-400">{r.repo}</span>
                  <span className="font-mono text-sm text-slate-300">{r.ports}</span>
                </div>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed">{r.why}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-cyan-300 mb-3">VR / Teleop layer</h3>
          <div className="space-y-3">
            {VR.map((r) => (
              <div key={r.repo} className="border-t border-slate-700 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-cyan-400">{r.repo}</span>
                  <span className="font-mono text-sm text-slate-300">{r.ports}</span>
                </div>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed">{r.why}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5" data-testid="fleet-when">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">When to use what</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-300">
                <th className="pb-2 pr-4">You need…</th>
                <th className="pb-2 pr-4">Use…</th>
                <th className="pb-2">Why not the other</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">1k RL envs, CPU laptop</td>
                <td className="py-2 pr-4 font-mono text-cyan-400">mujoco-mcp</td>
                <td className="py-2 text-slate-300">Isaac wants 4 GB VRAM; Gazebo wants ROS + 10 s boot</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Photoreal + RTX domain rand</td>
                <td className="py-2 pr-4 font-mono text-cyan-400">isaac-mcp</td>
                <td className="py-2 text-slate-300">MuJoCo renderer is debug-grade; no RTX</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Lidar/IMU plugin noise</td>
                <td className="py-2 pr-4 font-mono text-cyan-400">gazebo-mcp</td>
                <td className="py-2 text-slate-300">MuJoCo sensors are analytic, not noisy</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Real bimanual demos</td>
                <td className="py-2 pr-4 font-mono text-cyan-400">norirobotics / unitree-mcp</td>
                <td className="py-2 text-slate-300">
                  These wrap the same depot — record on hardware, replay in MuJoCo
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-300">Human teleop</td>
                <td className="py-2 pr-4 font-mono text-cyan-400">teleoperator + mujoco</td>
                <td className="py-2 text-slate-300">
                  Stream WebXR pose → <code className="bg-slate-700 px-1 rounded">apply_control</code> → 3D Viewer
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-slate-800 rounded-xl border border-slate-700 p-5" data-testid="fleet-links">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Cross-links to explore</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <a
            href="http://127.0.0.1:11044"
            target="_blank"
            rel="noreferrer"
            className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 text-slate-300"
          >
            <span className="font-mono text-cyan-400">limx-robotics-mcp</span> — 11044 (LimX TRON 1)
          </a>
          <a
            href="http://127.0.0.1:11052"
            target="_blank"
            rel="noreferrer"
            className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 text-slate-300"
          >
            <span className="font-mono text-cyan-400">unitree-mcp</span> — 11052 (Go2/H1)
          </a>
          <a
            href="http://127.0.0.1:10990"
            target="_blank"
            rel="noreferrer"
            className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 text-slate-300"
          >
            <span className="font-mono text-cyan-400">gazebo-mcp</span> — 10990 (Gazebo)
          </a>
          <a
            href="http://127.0.0.1:11048"
            target="_blank"
            rel="noreferrer"
            className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 text-slate-300"
          >
            <span className="font-mono text-cyan-400">isaac-mcp</span> — 11048 (Isaac Sim)
          </a>
        </div>
        <p className="text-sm text-slate-300 mt-3">
          All four share the same job lifecycle idea (depot → job → state → control). Fleet pattern: train in MuJoCo
          (cheap), refine in Isaac (photoreal), field in Gazebo (sensors), teleop in VR. Each has the same
          <code className="bg-slate-700 px-1 rounded">start_sim / get_state / apply_control</code> verbs.
        </p>
      </section>
    </div>
  );
}
