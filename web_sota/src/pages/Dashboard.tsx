import { useState, useEffect, useCallback } from "react";

interface Status {
  mujoco_available: boolean;
  mujoco_version: string | null;
  models_in_depot: number;
  active_jobs: number;
}

interface Job {
  job_id: string;
  model_name: string;
  running?: boolean;
  completed?: boolean;
}

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/status");
      if (r.ok) setStatus(await r.json());
    } catch {}
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const r = await fetch("/api/simulations");
      if (r.ok) {
        const data = await r.json();
        setJobs([...(data.active || []), ...(data.completed || [])]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchJobs();
    const iv = setInterval(fetchJobs, 3000);
    return () => clearInterval(iv);
  }, [fetchStatus, fetchJobs]);

  const handleAiExecute = async () => {
    setAiResult("Thinking...");
    try {
      const r = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2:3b",
          prompt: `You are a MuJoCo simulation assistant. ${aiPrompt}`,
        }),
      });
      const data = await r.json();
      setAiResult(data.response || data.error || "No response");
    } catch (e) {
      setAiResult(String(e));
    }
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Health Card */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "MuJoCo", value: status?.mujoco_version ?? (status?.mujoco_available ? "Available" : "N/A") },
          { label: "Models in Depot", value: status?.models_in_depot ?? "..." },
          { label: "Active Jobs", value: status?.active_jobs ?? "..." },
          { label: "Server Status", value: status ? "Online" : "Loading..." },
        ].map((c) => (
          <div key={c.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-xs text-slate-400 uppercase tracking-wider">{c.label}</div>
            <div className="text-2xl font-bold mt-1 text-cyan-300">{c.value}</div>
          </div>
        ))}
      </div>

      {/* AI Workflow Card */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-8">
        <h2 className="text-lg font-semibold mb-3">Quick AI Workflow</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            placeholder="e.g. load the pendulum model and start a simulation"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAiExecute()}
          />
          <button
            onClick={handleAiExecute}
            className="bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
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

      {/* Active Jobs */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
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
                  job.running
                    ? "bg-green-900 text-green-300"
                    : "bg-slate-700 text-slate-400"
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
