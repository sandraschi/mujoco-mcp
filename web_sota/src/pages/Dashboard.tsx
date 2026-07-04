import { useCallback, useEffect, useRef, useState } from "react";

interface Status {
  mujoco_available: boolean;
  mujoco_version: string | null;
  models_in_depot: number;
  active_jobs: number;
  version?: string;
  uptime_seconds?: number;
  tool_count?: number;
  status?: string;
}

interface HealthData {
  tool_count?: number;
  uptime_seconds?: number;
  version?: string;
}

interface Job {
  job_id: string;
  model_name: string;
  running?: boolean;
  completed?: boolean;
}

const BASE_INTERVAL = 10000;

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const retryRef = useRef(0);
  const [restarting, setRestarting] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);

  const _checkBackendHealth = useCallback(async () => {
    try {
      const r = await fetch("/api/health");
      if (r.ok) {
        const data = await r.json();
        setStatus(data);
        setBackendOk(true);
        retryRef.current = 0;
      } else {
        setBackendOk(false);
      }
    } catch {
      setBackendOk(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const retry = retryRef.current;
    try {
      const r = await fetch("/api/health");
      if (r.ok) {
        const data = await r.json();
        setStatus(data);
        setHealth(data);
        setBackendOk(true);
        retryRef.current = 0;
      }
    } catch {
      setBackendOk(false);
      retryRef.current = Math.min(retry + 1, 5);
    }
    const jr = await fetch("/api/simulations");
    if (jr.ok) {
      const data = await jr.json();
      setJobs([...(data.active || []), ...(data.completed || [])]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, BASE_INTERVAL);
    return () => clearInterval(iv);
  }, [refresh]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<string>("backend-status", (event) => {
          if (event.payload === "ready") {
            refresh();
          } else if (typeof event.payload === "string" && event.payload.startsWith("error:")) {
            setBackendOk(false);
          }
        });
      } catch {}
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, [refresh]);

  const restartBackend = useCallback(async () => {
    setRestarting(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("start_backend");
    } catch {
      setRestarting(false);
    }
  }, []);

  const handleAiExecute = async () => {
    setAiResult("Thinking...");
    try {
      const r = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: localStorage.getItem("llm_model") || "llama3.2:3b",
          prompt: `You are a MuJoCo simulation assistant. ${aiPrompt}`,
        }),
      });
      const data = await r.json();
      setAiResult(data.response || data.error || "No response");
    } catch (e) {
      setAiResult(String(e));
    }
  };

  const kpis = [
    {
      label: "MuJoCo",
      value: status?.mujoco_version ?? (status?.mujoco_available ? "Available" : "N/A"),
      testid: "kpi-mujoco",
    },
    { label: "Models in Depot", value: status?.models_in_depot ?? "...", testid: "kpi-models" },
    { label: "Active Jobs", value: status?.active_jobs ?? "...", testid: "kpi-jobs" },
    {
      label: "Server Status",
      value: status ? (status.status === "ok" ? "Online" : "Degraded") : "Loading...",
      testid: "kpi-server",
    },
    { label: "Tools", value: health?.tool_count ?? "...", testid: "kpi-tools" },
  ];

  return (
    <div data-testid="dashboard" className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span
            id="backend-dot"
            data-testid="backend-dot"
            className={`w-2 h-2 rounded-full ${backendOk === null ? "bg-gray-500" : backendOk ? "bg-green-500" : "bg-red-500"} animate-pulse`}
          />
          <span>{backendOk === null ? "Connecting..." : backendOk ? "Connected" : "Offline"}</span>
          {backendOk === false && (
            <button
              onClick={restartBackend}
              disabled={restarting}
              className="ml-2 bg-red-800 hover:bg-red-700 disabled:bg-slate-600 text-white text-xs px-2 py-1 rounded"
            >
              {restarting ? "Restarting..." : "Restart Backend"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8" data-testid="kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700" data-testid={k.testid}>
            <div className="text-xs text-slate-400 uppercase tracking-wider">{k.label}</div>
            <div className="text-2xl font-bold mt-1 text-cyan-300">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-8" data-testid="ai-workflow-card">
        <h2 className="text-lg font-semibold mb-3">Quick AI Workflow</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            placeholder="e.g. load the pendulum model and start a simulation"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAiExecute()}
            data-testid="ai-prompt-input"
          />
          <button
            onClick={handleAiExecute}
            className="bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            data-testid="ai-execute-btn"
          >
            Execute
          </button>
        </div>
        {aiResult && (
          <pre className="mt-3 bg-slate-900 rounded-lg p-3 text-xs text-slate-300 max-h-40 overflow-auto whitespace-pre-wrap">
            {aiResult}
          </pre>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700" data-testid="jobs-section">
        <h2 className="text-lg font-semibold p-4 border-b border-slate-700">Active Jobs</h2>
        <div className="divide-y divide-slate-700">
          {jobs.length === 0 && (
            <div className="p-4 text-sm text-slate-500">No jobs yet. Start a simulation from the Simulations page.</div>
          )}
          {jobs.map((job) => (
            <div key={job.job_id} className="p-4 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{job.model_name}</span>
                <span className="text-slate-500 ml-2">#{job.job_id}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  job.running ? "bg-green-900 text-green-300" : "bg-slate-700 text-slate-400"
                }`}
              >
                {job.running ? "Running" : job.completed ? "Completed" : "Stopped"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
