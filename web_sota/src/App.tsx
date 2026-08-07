import { useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import FloatingChat from "./components/FloatingChat";
import { useZoom } from "./lib/use-zoom";
import Dashboard from "./pages/Dashboard";import Help from "./pages/Help";
import LLM from "./pages/LLM";
import Logging from "./pages/Logging";
import ModelEditor from "./pages/ModelEditor";
import Models from "./pages/Models";
import PopulationViewer from "./pages/PopulationViewer";
import RLPlayground from "./pages/RLPlayground";
import Settings from "./pages/Settings";
import Simulations from "./pages/Simulations";
import Skills from "./pages/Skills";
import TrajectoryViewer from "./pages/TrajectoryViewer";
import Viewer3D from "./pages/Viewer3D";

const navItems = [
  { to: "/", label: "Dashboard", icon: "\u{1F3E0}" },
  { to: "/simulations", label: "Simulations", icon: "\u{1F3AE}" },
  { to: "/viewer", label: "3D Viewer", icon: "\u{1F5BC}" },
  { to: "/trajectory", label: "Trajectory", icon: "\u{23F1}" },
  { to: "/population", label: "Population", icon: "\u{1F300}" },
  { to: "/editor", label: "Editor", icon: "\u{270F}" },
  { to: "/rl", label: "RL", icon: "\u{1F9E9}" },
  { to: "/models", label: "Models", icon: "\u{1F4E6}" },
  { to: "/skills", label: "Skills", icon: "\u{1F4D6}" },
  { to: "/logging", label: "Logging", icon: "\u{1F4CA}" },
  { to: "/llm", label: "LLM", icon: "\u{1F916}" },
  { to: "/settings", label: "Settings", icon: "\u2699\uFE0F" },
  { to: "/help", label: "Help", icon: "\u2753" },
];

function Sidebar() {
  // EXPERIMENTAL light mode (invert hack). Not fleet standard - see index.css.
  // Toggling `.dark` off the root flips the invert filter; persisted so the
  // choice survives reloads. Delete this + the CSS block to revert.
  const [light, setLight] = useState(() => {
    try {
      return localStorage.getItem("mujoco-light-mode") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", !light);
    try {
      localStorage.setItem("mujoco-light-mode", light ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [light]);

  return (
    <nav className="w-56 min-h-screen bg-slate-900 border-r border-slate-700 p-4 flex flex-col" data-testid="sidebar">
      <div className="flex items-center justify-between mb-6 px-2" data-testid="app-logo">
        <span className="text-lg font-bold text-cyan-400">MuJoCo MCP</span>
        <button
          type="button"
          onClick={() => setLight((v) => !v)}
          className="text-lg leading-none text-slate-400 hover:text-white transition-colors"
          title={light ? "Switch to dark (experimental light mode)" : "Switch to light (experimental, ugly)"}
          aria-label="Toggle light mode (experimental)"
        >
          {light ? "\u{1F319}" : "\u2600\uFE0F"}
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? "bg-cyan-800 text-cyan-100" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function App() {
  useZoom();
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-950" data-testid="app-shell">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto" data-testid="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/simulations" element={<Simulations />} />
            <Route path="/viewer" element={<Viewer3D />} />
            <Route path="/trajectory" element={<TrajectoryViewer />} />
            <Route path="/population" element={<PopulationViewer />} />
            <Route path="/editor" element={<ModelEditor />} />
            <Route path="/rl" element={<RLPlayground />} />
            <Route path="/models" element={<Models />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/logging" element={<Logging />} />
            <Route path="/llm" element={<LLM />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
          </Routes>
        </main>
        <FloatingChat />
      </div>
    </BrowserRouter>
  );
}
