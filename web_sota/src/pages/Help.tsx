import { useState } from "react";

const TABS = ["Overview", "MuJoCo", "Compare", "Fleet", "Tools", "Setup", "Troubleshooting"];

const TOOLS = [
  { name: "sim_status", desc: "Health check: mujoco importable, model dir, active jobs", group: "Core Sim" },
  { name: "load_model", desc: "Download/load an MJCF/XML model into the depot", group: "Core Sim" },
  { name: "start_sim", desc: "Launch a MuJoCo simulation as an isolated subprocess", group: "Core Sim" },
  { name: "stop_sim", desc: "Stop a running simulation by job_id", group: "Core Sim" },
  { name: "get_state", desc: "Read joint positions, velocities, and sensor data", group: "Core Sim" },
  { name: "apply_control", desc: "Apply control signals (position, velocity, torque)", group: "Core Sim" },
  { name: "list_models", desc: "List all models in the depot with metadata", group: "Core Sim" },
  { name: "list_jobs", desc: "List active and completed simulation jobs", group: "Core Sim" },
  { name: "export_frame", desc: "Export the latest offscreen render frame as base64 PNG", group: "Core Sim" },
  { name: "agentic_sim_workflow", desc: "Multi-step sim orchestration via host LLM", group: "AI Workflow" },
  { name: "natural_language_control", desc: "NL to actuator control values", group: "AI Workflow" },
  { name: "analyze_sim_state", desc: "Describe robot posture/behaviour from state data", group: "AI Workflow" },
  { name: "analyze_sim_logs", desc: "Root-cause diagnosis from sim stderr", group: "AI Workflow" },
  { name: "discover_model", desc: "Find + download MJCF from GitHub by description", group: "AI Workflow" },
  { name: "record_trajectory", desc: "Start recording state trajectory to trajectory.jsonl", group: "Trajectory" },
  { name: "list_trajectories", desc: "Query trajectory metadata (frame count, time range)", group: "Trajectory" },
  { name: "run_population", desc: "Launch N parallel sims with parameter sweeps", group: "Population" },
  { name: "population_results", desc: "Aggregate results from population sims", group: "Population" },
  { name: "train_policy", desc: "Train PPO/SAC policy via stable-baselines3", group: "RL" },
  { name: "shutdown_server", desc: "Gracefully shut down the server (confirm=True)", group: "Server" },
];

const TROUBLES = [
  {
    symptom: "MuJoCo not found / ImportError",
    cause: "mujoco package not installed",
    fix: "pip install mujoco (requires MuJoCo 3.2+)",
  },
  {
    symptom: "Model load fails: File not found",
    cause: "Missing or invalid model path",
    fix: "Use absolute path or valid URL. Supported: MJCF (.xml), URDF.",
  },
  {
    symptom: "Simulation crashes on start",
    cause: "Invalid MJCF/XML or GPU driver issue",
    fix: "Check jobs/<job_id>/runner.log for traceback. Use headless=true.",
  },
  {
    symptom: "Web dashboard not loading",
    cause: "Backend or Vite not running",
    fix: "Ensure backend (11046) and Vite (11047) are both running. Check browser console.",
  },
  {
    symptom: "Port already in use",
    cause: "Previous instance still listening",
    fix: "Get-NetTCPConnection -LocalPort 11046 | Stop-Process -Id {OwningProcess} -Force",
  },
  {
    symptom: "export_frame returns empty/base64 error",
    cause: "No offscreen rendering support (EGL/OSMesa)",
    fix: "Install EGL drivers or run on a system with a GPU. On Windows this usually works.",
  },
  {
    symptom: "Sim hangs after start_sim",
    cause: "Runner subprocess deadlocked",
    fix: "Call stop_sim(job_id) to force-terminate, then check runner.log for details.",
  },
  {
    symptom: "apply_control has no effect",
    cause: "Control names mismatch the model",
    fix: "Use get_state() to list joint names, then match ctrl names exactly.",
  },
  {
    symptom: "list_models returns empty",
    cause: "Depot not seeded",
    fix: "Run scripts/seed_depot.py or use load_model(url=...) to add models.",
  },
];

export default function Help() {
  const [tab, setTab] = useState(0);
  return (
    <div data-testid="help-page">
      <h1 className="text-2xl font-bold mb-6">Help</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            data-testid={`help-tab-${t.toLowerCase()}`}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === i ? "bg-cyan-700 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 0 && <Overview />}
      {tab === 1 && <MujocoHelp />}
      {tab === 2 && <CompareHelp />}
      {tab === 3 && <FleetHelp />}
      {tab === 4 && <Tools />}
      {tab === 5 && <Setup />}
      {tab === 6 && <Troubleshooting />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-4">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Overview() {
  return (
    <div className="space-y-4">
      <Card title="What It Is">
        <p className="text-sm text-slate-300 mb-2">
          <strong>mujoco-mcp</strong> exposes MuJoCo physics simulation as MCP tools. Start, control, and query MuJoCo
          simulations from any MCP client (Claude Desktop, Cursor). Each simulation runs as an isolated OS subprocess,
          communicating over a JSON pipe for crash isolation. Also see the dedicated{" "}
          <span className="text-cyan-400">MuJoCo</span> and <span className="text-cyan-400">Fleet</span> tabs.
        </p>
        <p className="text-sm text-slate-300">
          Supports any MJCF/XML or URDF model. Built-in seed models include pendulum, cartpole, hopper, walker, ant,
          humanoid, Unitree H1, and Unitree Go2. The <strong>Models</strong> page has a MuJoCo Menagerie browser tab
          that lists all available models from{" "}
          <code className="text-sm bg-slate-700 px-1 rounded text-slate-300">
            github.com/google-deepmind/mujoco_menagerie
          </code>{" "}
          with search and one-click download. AI tools enable natural-language control and multi-step simulation
          workflows.
        </p>
      </Card>

      <Card title="Architecture">
        <pre className="bg-slate-900 text-green-300 text-sm p-4 rounded font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto mb-3">
          {`MCP Client (Claude Desktop, Cursor)
    │  stdio / HTTP
    ▼
FastMCP server (port 11046)
    │  subprocess.Popen
    ▼
_runner.py ─── MuJoCo mjModel + mjData
    │          control loop at sim frequency
    │          state sync via JSON files
    ▼
Simulation state (mjData → state.json)`}
        </pre>
        <p className="text-sm text-slate-300">
          State machine:{" "}
          <code className="text-sm bg-slate-700 px-1 rounded text-slate-300">
            IDLE → MODEL_LOADED → STARTING → RUNNING → STOPPING → STOPPED
          </code>
        </p>
      </Card>

      <Card title="Ports">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-300">
              <th className="pb-2 pr-4 font-medium">Port</th>
              <th className="pb-2 font-medium">Service</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-700">
              <td className="py-2 pr-4 text-sm font-mono text-cyan-400">11046</td>
              <td className="py-2 text-sm text-slate-300">FastAPI backend + MCP HTTP (+ FastMCP stdio)</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-sm font-mono text-cyan-400">11047</td>
              <td className="py-2 text-sm text-slate-300">Vite React frontend (dev) — now 16 pages</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Badges">
        <div className="flex gap-2 flex-wrap">
          <span className="px-2 py-1 bg-blue-900 text-blue-300 text-sm rounded-full font-medium">Python 3.11+</span>
          <span className="px-2 py-1 bg-green-900 text-green-300 text-sm rounded-full font-medium">MuJoCo 3.2+</span>
          <span className="px-2 py-1 bg-purple-900 text-purple-300 text-sm rounded-full font-medium">20 tools</span>
          <span className="px-2 py-1 bg-orange-900 text-orange-300 text-sm rounded-full font-medium">Apache 2.0</span>
        </div>
      </Card>
    </div>
  );
}

function MujocoHelp() {
  return (
    <div className="space-y-4">
      <Card title="What is MuJoCo?">
        <p className="text-sm text-slate-300 leading-relaxed">
          Multi-Joint dynamics with Contact — a C/C++ engine that solves articulated-body dynamics in generalized
          coordinates. Joints are the coordinates, contacts are a soft convex solver with analytic gradients. Hence
          MuJoCo dominates contact-rich robotics (grasping, legged locomotion) and differentiable simulation.
        </p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-sm font-semibold text-cyan-300">Newton solver</div>
            <div className="text-sm text-slate-300 mt-1">
              Recursive Newton-Euler + sparse Jacobians; no iterative drift.
            </div>
          </div>
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-sm font-semibold text-cyan-300">Soft contact</div>
            <div className="text-sm text-slate-300 mt-1">Elliptic cone + analytic derivatives; stable at 2–5 ms.</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-sm font-semibold text-cyan-300">MJCF</div>
            <div className="text-sm text-slate-300 mt-1">One XML: bodies, joints, actuators, sensors, tendons.</div>
          </div>
        </div>
      </Card>

      <Card title="History">
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex gap-3">
            <span className="font-mono text-cyan-400 w-24 shrink-0">2009–12</span>
            <span>
              <strong>Emanuel Todorov</strong> (U. Washington) at <strong>Roboti LLC</strong> ships MuJoCo — humanoids
              faster than realtime on a CPU.
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-cyan-400 w-24 shrink-0">2015–21</span>
            <span>DM Control + Gym adopt it; RL locomotion papers standardize on it. Commercial ~$3k/seat.</span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-cyan-400 w-24 shrink-0">Oct 2021</span>
            <span>
              DeepMind acquires, Apache 2.0 open source on <span className="font-mono">google-deepmind/mujoco</span> +
              Menagerie (30+ robots).
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-cyan-400 w-24 shrink-0">2022–now</span>
            <span>
              ~12k stars, 200+ contributors, Brax/JAX GPU (10k envs), Playground. This server uses MuJoCo 3.2+ directly.
            </span>
          </div>
        </div>
      </Card>

      <Card title="Community">
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <span className="font-mono text-cyan-400">mujoco.org</span> — docs + 200 examples
            </li>
            <li>
              <span className="font-mono text-cyan-400">Menagerie</span> — 30 open robots (H1/Go2, Shadow Hand, Franka)
            </li>
            <li>
              <span className="font-mono text-cyan-400">DM Control</span> — cheetah/walker/humanoid
            </li>
          </ul>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <span className="font-mono text-cyan-400">Brax</span> — JAX GPU, 10k parallel
            </li>
            <li>
              <span className="font-mono text-cyan-400">Playground</span> — browser MJCF
            </li>
            <li>Slack ~5k — solver tuning answers in hours</li>
          </ul>
        </div>
      </Card>

      <Card title="Strengths & Weaknesses">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-green-300 mb-2">Strengths</h3>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              <li>10–50× realtime (1 CPU); 1k+ on 1 GPU (Brax)</li>
              <li>Analytic derivatives — trajectory opt, no PPO needed</li>
              <li>One-file XML, ~10 MB wheel, &lt;1 s cold start</li>
              <li>Muscle/tendon/sensors built in</li>
              <li>First-class Python</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-300 mb-2">Weaknesses</h3>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              <li>No lidar/camera noise, aero, hydro</li>
              <li>Minimal sensor plugins vs Gazebo</li>
              <li>No multi-robot networking</li>
              <li>EGL for headless offscreen on Linux</li>
              <li>Deformables experimental</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CompareHelp() {
  return (
    <div className="space-y-4">
      <Card title="MuJoCo vs Alternatives — at a glance">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-300">
                <th className="pb-2 pr-4">Feature</th>
                <th className="pb-2 pr-4">MuJoCo</th>
                <th className="pb-2 pr-4">Gazebo</th>
                <th className="pb-2 pr-4">Isaac Sim</th>
                <th className="pb-2">PyBullet</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">License</td>
                <td className="py-2 pr-4 text-green-300">Apache 2.0</td>
                <td className="py-2 pr-4 text-slate-300">Apache 2.0</td>
                <td className="py-2 pr-4 text-amber-300">NVIDIA EULA</td>
                <td className="py-2 text-slate-300">MIT</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Contact</td>
                <td className="py-2 pr-4 text-cyan-300">Soft + grad</td>
                <td className="py-2 pr-4 text-slate-300">Penalty</td>
                <td className="py-2 pr-4 text-slate-300">PhysX LCP</td>
                <td className="py-2 text-slate-300">Penalty</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Diff</td>
                <td className="py-2 pr-4 text-cyan-300">yes</td>
                <td className="py-2 pr-4 text-slate-300">no</td>
                <td className="py-2 pr-4 text-slate-300">no</td>
                <td className="py-2 text-slate-300">no</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Speed</td>
                <td className="py-2 pr-4 text-green-300">10–50× CPU</td>
                <td className="py-2 pr-4 text-slate-300">0.5–1×</td>
                <td className="py-2 pr-4 text-slate-300">1–5× GPU</td>
                <td className="py-2 text-slate-300">2–10×</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-slate-300">Cold start</td>
                <td className="py-2 pr-4 text-green-300">&lt;1 s · 10 MB</td>
                <td className="py-2 pr-4 text-amber-300">10–60 s · 2 GB</td>
                <td className="py-2 pr-4 text-amber-300">30–120 s · 10 GB</td>
                <td className="py-2 text-green-300">&lt;1 s · 5 MB</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-300">When?</td>
                <td className="py-2 pr-4 text-slate-300">RL, contacts, diff</td>
                <td className="py-2 pr-4 text-slate-300">ROS, sensors</td>
                <td className="py-2 pr-4 text-slate-300">Photoreal</td>
                <td className="py-2 text-slate-300">Simple pip</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre className="mt-4 bg-slate-900 text-green-300 text-sm p-3 rounded font-mono whitespace-pre-wrap overflow-x-auto">
          {`photoreal?              -> Isaac Sim
camera/lidar plugins?   -> Gazebo
differentiable?         -> MuJoCo
1000s parallel envs?    -> MuJoCo (Brax) or Isaac
ROS already?            -> Gazebo
soft bodies?            -> PyBullet
CPU laptop only?        -> MuJoCo or PyBullet`}
        </pre>
        <p className="text-sm text-slate-300 mt-3">
          Full 17-row matrix + MJCF vs URDF in{" "}
          <code className="bg-slate-700 px-1 rounded">docs/MUJOCO_VS_OTHERS.md</code> and the dedicated{" "}
          <span className="text-cyan-400">MuJoCo</span> dashboard page.
        </p>
      </Card>
    </div>
  );
}

function FleetHelp() {
  return (
    <div className="space-y-4">
      <Card title="Where MuJoCo fits — Fleet VR / Sim / Robotics">
        <pre className="bg-slate-900 text-green-300 text-sm p-4 rounded font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
          {`VLA (limx / unitree / vla-mcp)
        │  joint targets
        ▼
mujoco-mcp ── 10–50× CPU ──► reward / contact
        │              │
        │ ws:positions    json: state.json
        ▼              ▼
  3D Viewer      ros-mcp ──► real robot
        │
        │ WebXR (teleoperator-mcp)
        ▼
 Overte / Resonite / VRChat`}
        </pre>
        <p className="text-sm text-slate-300 mt-3">
          Train cheap in MuJoCo, validate photoreal in <span className="font-mono text-cyan-400">isaac-mcp 11048</span>,
          field in <span className="font-mono text-cyan-400">gazebo-mcp 10990</span> (sensors), teleop in VR. All share{" "}
          <code className="bg-slate-700 px-1 rounded">start_sim / get_state / apply_control</code>.
        </p>
      </Card>

      <Card title="Fleet map — Sim / ROS">
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between border-b border-slate-700 py-2">
            <span className="font-mono text-cyan-400">gazebo-mcp 10990/10991</span>
            <span>SDF worlds + ROS 2 topics — sensor-heavy outdoor sims.</span>
          </div>
          <div className="flex justify-between border-b border-slate-700 py-2">
            <span className="font-mono text-cyan-400">isaac-mcp 11048/11049</span>
            <span>Isaac Sim/Lab + USD — GPU photoreal + synthetic data.</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-mono text-cyan-400">ros-mcp 11050/11051</span>
            <span>Native ROS 2 bridge — shims Gazebo ↔ MuJoCo.</span>
          </div>
        </div>
      </Card>

      <Card title="Fleet map — Robotics">
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between border-b border-slate-700 py-2">
            <span className="font-mono text-cyan-400">limx-robotics-mcp 11044</span>
            <span>LimX TRON 1 + Oli — wraps this server + VLA.</span>
          </div>
          <div className="flex justify-between border-b border-slate-700 py-2">
            <span className="font-mono text-cyan-400">unitree-mcp 11052</span>
            <span>Go2/H1/G1 — same depot, different morphologies.</span>
          </div>
          <div className="flex justify-between border-b border-slate-700 py-2">
            <span className="font-mono text-cyan-400">norirobotics-mcp 11970</span>
            <span>Nori A3 19-DoF bimanual — LeRobot → vla-mcp.</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-mono text-cyan-400">yahboom-mcp 10792</span>
            <span>Yahboom ROSMaster — cheap arms/cars for replay.</span>
          </div>
        </div>
      </Card>

      <Card title="Fleet map — VR / Teleop">
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between border-b border-slate-700 py-2">
            <span className="font-mono text-cyan-400">overte-mcp 11110</span>
            <span>Overte open VR — pair with 3D Viewer for teleop.</span>
          </div>
          <div className="flex justify-between border-b border-slate-700 py-2">
            <span className="font-mono text-cyan-400">vrchat-mcp 10712</span>
            <span>VRChat OSC — drive humanoid from VRChat tracking.</span>
          </div>
          <div className="flex justify-between border-b border-slate-700 py-2">
            <span className="font-mono text-cyan-400">resonite-mcp 10978</span>
            <span>Resonite — advanced VR world import.</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-mono text-cyan-400">teleoperator-mcp 10900</span>
            <span>WebXR (Pico/Quest) → Goliath head+hands pose.</span>
          </div>
        </div>
      </Card>

      <Card title="Also on the Fleet page">
        <p className="text-sm text-slate-300">
          The dashboard’s <span className="text-cyan-400">Fleet</span> page renders this map as three tiles (Sim,
          Robotics, VR) with live links to each service (
          <code className="bg-slate-700 px-1 rounded">http://127.0.0.1:11044</code> etc.) and a when-to-use table. Same
          verbs across all: <code className="bg-slate-700 px-1 rounded">start_sim / get_state / apply_control</code>.
        </p>
      </Card>
    </div>
  );
}

function Tools() {
  const sim = TOOLS.filter((t) => t.group === "Core Sim");
  const ai = TOOLS.filter((t) => t.group === "AI Workflow");
  return (
    <div className="space-y-4">
      <Card title="Core Simulation Tools (9)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-300">
                <th className="pb-2 pr-4 font-medium">Tool</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {sim.map((t) => (
                <tr key={t.name} className="border-b border-slate-700">
                  <td className="py-2 pr-4 text-sm font-mono text-cyan-400 whitespace-nowrap">{t.name}</td>
                  <td className="py-2 text-sm text-slate-300">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="AI Workflow Tools (5)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-300">
                <th className="pb-2 pr-4 font-medium">Tool</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {ai.map((t) => (
                <tr key={t.name} className="border-b border-slate-700">
                  <td className="py-2 pr-4 text-sm font-mono text-cyan-400 whitespace-nowrap">{t.name}</td>
                  <td className="py-2 text-sm text-slate-300">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-300 mt-3">
          See <code className="text-sm bg-slate-700 px-1 rounded text-slate-300">docs/TOOLS.md</code> in the repo for
          full reference.{" "}
          <span className="text-slate-300">
            (Tools listed here for reference; the actual surface is discovered dynamically at runtime.)
          </span>
        </p>
      </Card>
    </div>
  );
}

function Setup() {
  return (
    <div className="space-y-4">
      <Card title="Prerequisites">
        <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
          <li>
            <strong>Python 3.11+</strong> — tested with 3.12, 3.13
          </li>
          <li>
            <strong>MuJoCo</strong> —{" "}
            <code className="text-sm bg-slate-700 px-1 rounded text-slate-300">pip install mujoco</code> (3.2+)
          </li>
          <li>
            <strong>Git</strong> — for cloning the repo
          </li>
          <li>
            <strong>uv</strong> (recommended) —{" "}
            <code className="text-sm bg-slate-700 px-1 rounded text-slate-300">pip install uv</code>
          </li>
          <li>
            <strong>Node.js 20+</strong> — for the web dashboard
          </li>
        </ul>
      </Card>

      <Card title="Quick Install">
        <pre className="bg-slate-900 text-green-300 text-sm p-3 rounded font-mono whitespace-pre-wrap">
          {`git clone https://github.com/sandraschi/mujoco-mcp\ncd mujoco-mcp\nuv sync\nuv run python -m mujoco_mcp`}
        </pre>
        <p className="text-sm text-slate-300 mt-2">
          Or use <code className="text-sm bg-slate-700 px-1 rounded text-slate-300">.\\start.bat</code> (backend +
          webapp) or <code className="text-sm bg-slate-700 px-1 rounded text-slate-300">.\\start.ps1 -Headless</code>{" "}
          (backend only). After starting, open the <strong>Models</strong> page → <strong>MuJoCo Menagerie</strong> tab
          → browse 100+ robots.
        </p>
      </Card>

      <Card title="Configuration">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-300">
                <th className="pb-2 pr-4 font-medium">Variable</th>
                <th className="pb-2 pr-4 font-medium">Default</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-sm font-mono text-cyan-400">MUJOCO_MCP_DEPOT</td>
                <td className="py-2 pr-4 text-sm text-slate-300">~/.mujoco-mcp/models/</td>
                <td className="py-2 text-sm text-slate-300">Model depot directory</td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 pr-4 text-sm font-mono text-cyan-400">MUJOCO_MCP_PORT</td>
                <td className="py-2 pr-4 text-sm text-slate-300">11046</td>
                <td className="py-2 text-sm text-slate-300">MCP server HTTP port</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-sm font-mono text-cyan-400">OLLAMA_URL</td>
                <td className="py-2 pr-4 text-sm text-slate-300">http://localhost:11434</td>
                <td className="py-2 text-sm text-slate-300">Ollama for AI tool fallback</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Development Commands">
        <pre className="bg-slate-900 text-green-300 text-sm p-3 rounded font-mono whitespace-pre-wrap">
          {`just lint     # ruff check\njust test     # pytest (22 unit tests)\njust e2e      # Playwright e2e tests (web_sota/)\njust dev      # backend + frontend with hot reload`}
        </pre>
      </Card>
    </div>
  );
}

function Troubleshooting() {
  return (
    <Card title="Common Issues">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-300">
              <th className="pb-2 pr-4 font-medium">Symptom</th>
              <th className="pb-2 pr-4 font-medium">Cause</th>
              <th className="pb-2 font-medium">Fix</th>
            </tr>
          </thead>
          <tbody>
            {TROUBLES.map((t, i) => (
              <tr key={i} className="border-b border-slate-700">
                <td className="py-2 pr-4 text-sm text-red-400 font-medium align-top">{t.symptom}</td>
                <td className="py-2 pr-4 text-sm text-slate-300 align-top">{t.cause}</td>
                <td className="py-2 text-sm text-slate-300 font-mono align-top whitespace-pre-wrap">{t.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-3 bg-slate-700 rounded text-sm text-slate-300">
        <p className="mb-1">
          <strong>Log files:</strong>{" "}
          <code className="text-sm bg-slate-800 px-1 rounded">jobs/&lt;job_id&gt;/runner.log</code> — per-simulation
          subprocess stderr
        </p>
        <p className="mb-1">
          <strong>Reset:</strong> Delete <code className="text-sm bg-slate-800 px-1 rounded">jobs/</code> and{" "}
          <code className="text-sm bg-slate-800 px-1 rounded">models/.depot/registry.json</code> to clear all state
        </p>
      </div>
    </Card>
  );
}
