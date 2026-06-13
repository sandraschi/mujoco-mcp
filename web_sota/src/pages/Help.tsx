import { useState } from "react";

const TABS = ["Overview", "Tools", "Setup", "Troubleshooting"];

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
];

const TROUBLES = [
  { symptom: "MuJoCo not found / ImportError", cause: "mujoco package not installed", fix: "pip install mujoco (requires MuJoCo 3.2+)" },
  { symptom: "Model load fails: File not found", cause: "Missing or invalid model path", fix: "Use absolute path or valid URL. Supported: MJCF (.xml), URDF." },
  { symptom: "Simulation crashes on start", cause: "Invalid MJCF/XML or GPU driver issue", fix: "Check jobs/<job_id>/runner.log for traceback. Use headless=true." },
  { symptom: "Web dashboard not loading", cause: "Backend or Vite not running", fix: "Ensure backend (11046) and Vite (11047) are both running. Check browser console." },
  { symptom: "Port already in use", cause: "Previous instance still listening", fix: "Get-NetTCPConnection -LocalPort 11046 | Stop-Process -Id {OwningProcess} -Force" },
  { symptom: "export_frame returns empty/base64 error", cause: "No offscreen rendering support (EGL/OSMesa)", fix: "Install EGL drivers or run on a system with a GPU. On Windows this usually works." },
  { symptom: "Sim hangs after start_sim", cause: "Runner subprocess deadlocked", fix: "Call stop_sim(job_id) to force-terminate, then check runner.log for details." },
  { symptom: "apply_control has no effect", cause: "Control names mismatch the model", fix: "Use get_state() to list joint names, then match ctrl names exactly." },
  { symptom: "list_models returns empty", cause: "Depot not seeded", fix: "Run scripts/seed_depot.py or use load_model(url=...) to add models." },
];

export default function Help() {
  const [tab, setTab] = useState(0);
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Help</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === i ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 0 && <Overview />}
      {tab === 1 && <Tools />}
      {tab === 2 && <Setup />}
      {tab === 3 && <Troubleshooting />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 mb-4">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Overview() {
  return (
    <div className="space-y-4">
      <Card title="What It Is">
        <p className="text-sm text-slate-600 mb-2">
          <strong>mujoco-mcp</strong> exposes MuJoCo physics simulation as MCP tools. Start, control, and query
          MuJoCo simulations from any MCP client (Claude Desktop, Cursor). Each simulation runs as an isolated
          OS subprocess, communicating over a JSON pipe for crash isolation.
        </p>
        <p className="text-sm text-slate-600">
          Supports any MJCF/XML or URDF model. Built-in seed models include pendulum, cartpole, hopper, walker,
          ant, and humanoid. AI tools enable natural-language control and multi-step simulation workflows.
        </p>
      </Card>

      <Card title="Architecture">
        <pre className="bg-slate-900 text-green-300 text-xs p-4 rounded font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto mb-3">
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
        <p className="text-sm text-slate-600">State machine: <code className="text-xs bg-slate-100 px-1 rounded">IDLE → MODEL_LOADED → STARTING → RUNNING → STOPPING → STOPPED</code></p>
      </Card>

      <Card title="Ports">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 pr-4 font-medium">Port</th>
              <th className="pb-2 font-medium">Service</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2 pr-4 text-xs font-mono">11046</td>
              <td className="py-2 text-xs text-slate-600">FastAPI backend + MCP HTTP (+ FastMCP stdio)</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-xs font-mono">11047</td>
              <td className="py-2 text-xs text-slate-600">Vite React frontend (dev)</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Badges">
        <div className="flex gap-2 flex-wrap">
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">Python 3.11+</span>
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">MuJoCo 3.2+</span>
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">14 tools</span>
          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">Apache 2.0</span>
        </div>
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
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4 font-medium">Tool</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {sim.map((t) => (
                <tr key={t.name} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-xs font-mono text-blue-700 whitespace-nowrap">{t.name}</td>
                  <td className="py-2 text-xs text-slate-600">{t.desc}</td>
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
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4 font-medium">Tool</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {ai.map((t) => (
                <tr key={t.name} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-xs font-mono text-blue-700 whitespace-nowrap">{t.name}</td>
                  <td className="py-2 text-xs text-slate-600">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">See <code className="text-xs bg-slate-100 px-1 rounded">docs/TOOLS.md</code> in the repo for full reference.</p>
      </Card>
    </div>
  );
}

function Setup() {
  return (
    <div className="space-y-4">
      <Card title="Prerequisites">
        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
          <li><strong>Python 3.11+</strong> — tested with 3.12, 3.13</li>
          <li><strong>MuJoCo</strong> — <code className="text-xs bg-slate-100 px-1 rounded">pip install mujoco</code> (3.2+)</li>
          <li><strong>Git</strong> — for cloning the repo</li>
          <li><strong>uv</strong> (recommended) — <code className="text-xs bg-slate-100 px-1 rounded">pip install uv</code></li>
          <li><strong>Node.js 20+</strong> — for the web dashboard</li>
        </ul>
      </Card>

      <Card title="Quick Install">
        <pre className="bg-slate-900 text-green-300 text-xs p-3 rounded font-mono whitespace-pre-wrap">
{`git clone https://github.com/sandraschi/mujoco-mcp
cd mujoco-mcp
uv sync
uv run python -m mujoco_mcp`}
        </pre>
        <p className="text-xs text-slate-500 mt-2">Or use <code className="text-xs bg-slate-100 px-1 rounded">.\start.bat</code> (backend + webapp) or <code className="text-xs bg-slate-100 px-1 rounded">.\start.ps1 -Headless</code> (backend only).</p>
      </Card>

      <Card title="Configuration">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4 font-medium">Variable</th>
                <th className="pb-2 pr-4 font-medium">Default</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 text-xs font-mono">MUJOCO_MCP_DEPOT</td>
                <td className="py-2 pr-4 text-xs text-slate-500">~/.mujoco-mcp/models/</td>
                <td className="py-2 text-xs text-slate-600">Model depot directory</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 text-xs font-mono">MUJOCO_MCP_PORT</td>
                <td className="py-2 pr-4 text-xs text-slate-500">11046</td>
                <td className="py-2 text-xs text-slate-600">MCP server HTTP port</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-xs font-mono">OLLAMA_URL</td>
                <td className="py-2 pr-4 text-xs text-slate-500">http://localhost:11434</td>
                <td className="py-2 text-xs text-slate-600">Ollama for AI tool fallback</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Development Commands">
        <pre className="bg-slate-900 text-green-300 text-xs p-3 rounded font-mono whitespace-pre-wrap">
{`just lint     # ruff check
just test     # pytest (22 unit tests)
just e2e      # Playwright e2e tests (web_sota/)
just dev      # backend + frontend with hot reload`}
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
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 pr-4 font-medium">Symptom</th>
              <th className="pb-2 pr-4 font-medium">Cause</th>
              <th className="pb-2 font-medium">Fix</th>
            </tr>
          </thead>
          <tbody>
            {TROUBLES.map((t, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-xs text-red-700 font-medium align-top">{t.symptom}</td>
                <td className="py-2 pr-4 text-xs text-slate-600 align-top">{t.cause}</td>
                <td className="py-2 text-xs text-slate-800 font-mono align-top whitespace-pre-wrap">{t.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-3 bg-slate-50 rounded text-xs text-slate-600">
        <p className="mb-1"><strong>Log files:</strong> <code className="text-xs bg-slate-100 px-1 rounded">jobs/&lt;job_id&gt;/runner.log</code> — per-simulation subprocess stderr</p>
        <p className="mb-1"><strong>Reset:</strong> Delete <code className="text-xs bg-slate-100 px-1 rounded">jobs/</code> and <code className="text-xs bg-slate-100 px-1 rounded">models/.depot/registry.json</code> to clear all state</p>
      </div>
    </Card>
  );
}
