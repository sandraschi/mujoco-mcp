import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isMockOnboarding, MOCK_KPIS, MOCK_USERS } from "../lib/mockOnboarding";

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
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const retryRef = useRef(0);
  const [restarting, setRestarting] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);

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
    const jr = await fetch("/api/jobs");
    if (jr.ok) {
      const data = await jr.json();
      setJobs([...(data.active || []), ...(data.completed || [])]);
    }
  }, []);

  useEffect(() => {
    refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const delay = backendOk === false ? BACKOFF_MS[Math.min(retryRef.current, BACKOFF_MS.length - 1)] : BASE_INTERVAL;
      timer = setTimeout(() => {
        refresh();
        tick();
      }, delay);
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [refresh, backendOk]);

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

  const isMock = isMockOnboarding(status);

  const kpis = [
    {
      label: "MuJoCo",
      value: isMock
        ? MOCK_KPIS.mujoco_version
        : (status?.mujoco_version ?? (status?.mujoco_available ? "Available" : "N/A")),
      mock: isMock,
      testid: "kpi-mujoco",
    },
    {
      label: "Models in Depot",
      value: isMock ? MOCK_KPIS.models_in_depot : (status?.models_in_depot ?? "..."),
      mock: isMock,
      testid: "kpi-models",
    },
    {
      label: "Active Jobs",
      value: isMock ? MOCK_KPIS.active_jobs : (status?.active_jobs ?? "..."),
      mock: isMock,
      testid: "kpi-jobs",
    },
    {
      label: "Server Status",
      value: isMock ? "Degraded [MOCK]" : status ? (status.status === "ok" ? "Online" : "Degraded") : "Loading...",
      mock: isMock,
      testid: "kpi-server",
    },
    { label: "Tools", value: health?.tool_count ?? MOCK_KPIS.tool_count, mock: false, testid: "kpi-tools" },
  ];

  const displayJobs: Job[] =
    isMock && jobs.length === 0 ? MOCK_USERS.map((u) => ({ job_id: u.job, model_name: u.model, running: true })) : jobs;

  return (
    <div data-testid="dashboard" className="max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-1.5 text-sm text-slate-300">
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
              className="ml-2 bg-red-800 hover:bg-red-700 disabled:bg-slate-600 text-white text-sm px-2 py-1 rounded"
            >
              {restarting ? "Restarting..." : "Restart Backend"}
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
        <p className="text-sm text-slate-300">
          MuJoCo physics simulation via MCP — load MJCF models, run crash-isolated simulations, apply controls, and
          analyze state from any agent or this dashboard.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Link
            to="/models"
            className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-medium"
          >
            Load a model
          </Link>
          <Link
            to="/simulations"
            className="px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-200 text-sm font-medium"
          >
            Start a simulation
          </Link>
          <Link
            to="/llm"
            className="px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-200 text-sm font-medium"
          >
            Ask the AI
          </Link>
        </div>
      </div>

      <Link
        to="/help"
        data-testid="onboarding-cue"
        className="block w-full text-center mb-6 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold border border-red-600"
      >
        {isMock
          ? "MuJoCo not detected — complete ONBOARDING.md → uv sync → restart"
          : "Start MuJoCo Quickstart — docs/ONBOARDING.md"}
      </Link>

      {isMock && (
        <div
          data-testid="mock-data-banner"
          className="mb-6 rounded-xl border border-dashed border-rose-700 bg-rose-950/30 px-4 py-3"
        >
          <p className="text-sm text-rose-300">
            Displaying <strong>sample data</strong> — complete{" "}
            <code className="bg-slate-800 px-1 rounded">docs/ONBOARDING.md</code> to see live MuJoCo ({" "}
            <code className="bg-slate-800 px-1 rounded">uv sync</code> →{" "}
            <code className="bg-slate-800 px-1 rounded">mujoco_available: true</code> ). Samples use{" "}
            <span className="font-mono">Joe Mocky / Sandra Mockinger</span> — never real users.
          </p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8" data-testid="kpi-grid">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl p-4 border ${k.mock ? "bg-slate-800 border-dashed border-rose-700" : "bg-slate-800 border-slate-700"}`}
            data-testid={k.testid}
          >
            <div className="flex items-center gap-2 text-sm text-slate-300 uppercase tracking-wider">
              {k.label}
              {k.mock && (
                <span
                  data-testid="mock-badge"
                  className="text-sm bg-rose-900 text-rose-300 px-1.5 py-0.5 rounded font-mono leading-none"
                >
                  MOCK
                </span>
              )}
            </div>
            <div className="text-2xl font-bold mt-1 text-cyan-300">{k.value}</div>
            {k.mock && <div className="text-sm text-rose-300 mt-1">[MOCK] sample — clears after onboarding</div>}
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-8" data-testid="ai-workflow-card">
        <h2 className="text-lg font-semibold mb-3">Quick AI Workflow</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-slate-100"
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
          <pre className="mt-3 bg-slate-900 rounded-lg p-3 text-sm text-slate-300 max-h-40 overflow-auto whitespace-pre-wrap">
            {aiResult}
          </pre>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700" data-testid="jobs-section">
        <h2 className="text-lg font-semibold p-4 border-b border-slate-700">
          Active Jobs{" "}
          {isMock && (
            <span
              data-testid="mock-badge"
              className="ml-2 text-sm bg-rose-900 text-rose-300 px-1.5 py-0.5 rounded font-mono"
            >
              MOCK
            </span>
          )}
        </h2>
        <div className="divide-y divide-slate-700">
          {displayJobs.length === 0 && (
            <div className="p-4 text-sm text-slate-300">No jobs yet. Start a simulation from the Simulations page.</div>
          )}
          {displayJobs.map((job) => (
            <div
              key={job.job_id}
              className={`p-4 flex items-center justify-between text-sm ${isMock ? "border border-dashed border-rose-700 rounded-lg m-2" : ""}`}
            >
              <div>
                <span className="font-medium text-slate-100">{job.model_name}</span>
                <span className="text-slate-300 ml-2">#{job.job_id}</span>
                {isMock && (
                  <span className="text-sm text-rose-300 ml-2">
                    [MOCK] {MOCK_USERS.find((u) => u.job === job.job_id)?.name ?? "Sample"}
                  </span>
                )}
              </div>
              <span
                className={`px-2 py-0.5 rounded text-sm font-medium ${job.running ? "bg-green-900 text-green-300" : "bg-slate-700 text-slate-300"}`}
              >
                {isMock ? "Running [MOCK]" : job.running ? "Running" : (job as any).completed ? "Completed" : "Stopped"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
