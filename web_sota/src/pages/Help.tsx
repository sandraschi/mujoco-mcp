import { useState } from "react";

const tabs = [
  { id: "prerequisites", label: "Prerequisites" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "architecture", label: "Architecture" },
  { id: "comparison", label: "MuJoCo vs Others" },
];

const content: Record<string, string> = {
  prerequisites: `## Prerequisites

### Required
- **Python 3.11+** — tested with 3.12, 3.13
- **MuJoCo** — install via pip: \`pip install mujoco\`
- **Git** — for cloning the repo

### Recommended
- **uv** — fast Python package manager (\`pip install uv\`)
- **Node.js 20+** — for the web dashboard

### Install
\`\`\`powershell
git clone https://github.com/sandraschi/mujoco-mcp
cd mujoco-mcp
uv sync
uv run python -m mujoco_mcp
\`\`\`

The server starts on port **11046** (FastMCP).`,

  troubleshooting: `## Troubleshooting

### "MuJoCo not found" / ImportError
\`\`\`powershell
pip install mujoco
\`\`\`
MuJoCo 3.2+ is required. Check with:
\`\`\`python
python -c "import mujoco; print(mujoco.__version__)"
\`\`\`

### Model load fails ("File not found")
Use an absolute path or a valid URL. Supported formats: MJCF (.xml), URDF.

### Simulation crashes on start
Check \`jobs/<job_id>/runner.log\` for the Python traceback. Common issues:
- Missing model file
- Invalid MJCF/XML
- GPU/rendering driver issues (use headless=true)

### Web dashboard not loading
Ensure both the backend (11046) and Vite dev server (11047) are running.
Check the browser console for proxy errors.

### Port already in use
\`\`\`powershell
Get-NetTCPConnection -LocalPort 11046 | Stop-Process -Id {OwningProcess} -Force
\`\`\``,

  architecture: `## Architecture

\`\`\`
MCP Client -> FastMCP (port 11046) -> subprocess (_sim_runner.py)
                                         -> MuJoCo mjModel + mjData
                                         -> control loop at sim frequency
                                         -> state sync via JSON files
\`\`\`

### Components
- **FastMCP server** (\`server.py\`) — MCP tools for model loading, sim lifecycle, state queries
- **Sim runner** (\`_sim_runner.py\`) — subprocess that owns the MuJoCo instance
- **JSON IPC** — state.json files written by the runner, read by the server
- **Web dashboard** — Vite + React SPA on port 11047

### Data Flow
1. User calls \`load_model\` -> XML stored in \`models/\`
2. \`start_sim\` spawns \`_sim_runner.py\` as subprocess
3. Runner loads model, enters control loop, writes \`state.json\` to \`jobs/<id>/
4. \`get_state\` reads the latest state file
5. \`apply_control\` writes \`control.json\` for the runner to pick up
6. \`stop_sim\` touches \`stop.signal\` and terminates the process`,

  comparison: `## MuJoCo vs Other Simulators

| Feature | MuJoCo | PyBullet | Isaac Sim | Gazebo |
|---------|--------|----------|-----------|--------|
| **License** | Apache 2.0 | MIT | Proprietary | Apache 2.0 |
| **Speed** | Fast (<1ms/timestep) | Moderate | GPU-accelerated | Moderate |
| **Contacts** | Analytical (convex) | Penalty-based | Multiple | Penalty/ODE |
| **Tendons/Actuators** | Native | Manual | Manual | Manual |
| **Python API** | Native ctypes | Native | Extension | ROS bridge |
| **3D Rendering** | Built-in (OpenGL) | Built-in | RTX | OGRE |
| **Soft Bodies** | Limited (flexcom) | Yes | Yes | No |
| **Terrain** | Limited | Procedural | Full | Full |
| **Install Size** | ~10 MB | ~50 MB | ~30 GB | ~2 GB |
| **Use Case** | Robotics, locomotion, control | General robotics | Photorealistic sim | Robot-in-the-loop |

**Why MuJoCo for MCP?** MuJoCo's small footprint, native Python API, and blazing fast simulation make it ideal for agent-driven workflows where multiple parallel simulations may run simultaneously.`,

};

export default function Help() {
  const [activeTab, setActiveTab] = useState("prerequisites");

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Help</h1>

      {/* Pill Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-cyan-700 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 prose prose-invert max-w-none">
        {content[activeTab]?.split("\n").map((line, i) => {
          if (line.startsWith("## ")) {
            return <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-white first:mt-0">{line.slice(3)}</h2>;
          }
          if (line.startsWith("### ")) {
            return <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-cyan-300">{line.slice(4)}</h3>;
          }
          if (line.startsWith("- **")) {
            const boldEnd = line.indexOf("**", 4);
            const label = line.slice(4, boldEnd);
            const rest = line.slice(boldEnd + 2);
            return (
              <div key={i} className="flex gap-2 text-sm text-slate-300 ml-2 mb-1">
                <span className="text-cyan-400 shrink-0">{label}</span>
                <span>{rest.replace(/^ — /, "")}</span>
              </div>
            );
          }
          if (line.startsWith("| ")) {
            return null;
          }
          if (line.startsWith("```")) {
            return null;
          }
          if (line.trim() === "") {
            return <div key={i} className="h-2" />;
          }
          return <p key={i} className="text-sm text-slate-300 mb-2">{line}</p>;
        })}
        {activeTab === "comparison" && (
          <table className="w-full text-sm mt-4 border-collapse">
            <thead>
              <tr className="bg-slate-700">
                {["Feature", "MuJoCo", "PyBullet", "Isaac Sim", "Gazebo"].map((h) => (
                  <th key={h} className="p-2 text-left text-slate-200 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["License", "Apache 2.0", "MIT", "Proprietary", "Apache 2.0"],
                ["Speed", "<1ms/timestep", "Moderate", "GPU-accelerated", "Moderate"],
                ["Contacts", "Analytical (convex)", "Penalty-based", "Multiple", "Penalty/ODE"],
                ["Tendons/Actuators", "Native", "Manual", "Manual", "Manual"],
                ["Python API", "Native ctypes", "Native", "Extension", "ROS bridge"],
                ["3D Rendering", "Built-in (OpenGL)", "Built-in", "RTX", "OGRE"],
                ["Soft Bodies", "Limited (flexcom)", "Yes", "Yes", "No"],
                ["Terrain", "Limited", "Procedural", "Full", "Full"],
                ["Install Size", "~10 MB", "~50 MB", "~30 GB", "~2 GB"],
                ["Use Case", "Robotics control", "General robotics", "Photorealistic sim", "Robot-in-loop"],
              ].map((row, ri) => (
                <tr key={ri} className="border-t border-slate-700">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`p-2 text-sm ${ci === 0 ? "text-cyan-400 font-medium" : "text-slate-300"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
