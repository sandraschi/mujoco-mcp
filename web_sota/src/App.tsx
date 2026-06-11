import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Simulations from "./pages/Simulations";
import Models from "./pages/Models";
import Logging from "./pages/Logging";
import LLM from "./pages/LLM";
import Settings from "./pages/Settings";
import Help from "./pages/Help";

const navItems = [
  { to: "/", label: "Dashboard", icon: "\u{1F3E0}" },
  { to: "/simulations", label: "Simulations", icon: "\u{1F3AE}" },
  { to: "/models", label: "Models", icon: "\u{1F4E6}" },
  { to: "/logging", label: "Logging", icon: "\u{1F4CA}" },
  { to: "/llm", label: "LLM", icon: "\u{1F916}" },
  { to: "/settings", label: "Settings", icon: "\u2699\uFE0F" },
  { to: "/help", label: "Help", icon: "\u2753" },
];

function Sidebar() {
  return (
    <nav className="w-56 min-h-screen bg-slate-900 border-r border-slate-700 p-4 flex flex-col">
      <div className="text-lg font-bold mb-6 px-2 text-cyan-400">MuJoCo MCP</div>
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-cyan-800 text-cyan-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
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
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/simulations" element={<Simulations />} />
            <Route path="/models" element={<Models />} />
            <Route path="/logging" element={<Logging />} />
            <Route path="/llm" element={<LLM />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
