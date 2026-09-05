import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Job {
  job_id: string;
  model_name: string;
  state?: string;
  running?: boolean;
  completed?: boolean;
}

export default function Inbox() {
  const [active, setActive] = useState<Job[]>([]);
  const [completed, setCompleted] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/jobs");
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const data = await r.json();
      setActive(data.active || []);
      setCompleted(data.completed || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading)
    return (
      <div className="p-6 text-slate-300" data-testid="inbox-page">
        Loading jobs...
      </div>
    );
  if (error)
    return (
      <div className="p-6" data-testid="inbox-page">
        <p className="text-red-400 text-sm mb-3">Failed to load jobs: {error}</p>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
          data-testid="inbox-retry"
        >
          Retry
        </button>
      </div>
    );

  const all = [...active, ...completed];
  if (all.length === 0)
    return (
      <div className="max-w-5xl p-2" data-testid="inbox-page">
        <h1 className="text-xl font-bold mb-2">Inbox</h1>
        <p className="text-sm text-slate-300">No jobs yet.</p>
        <p className="text-sm text-slate-400 mt-1">
          Start a simulation from{" "}
          <Link to="/simulations" className="text-cyan-400 underline">
            Simulations
          </Link>
          .
        </p>
      </div>
    );

  return (
    <div className="max-w-5xl" data-testid="inbox-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Inbox — Job Queue</h1>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-slate-800 text-slate-200 text-sm"
          data-testid="inbox-refresh"
        >
          Refresh
        </button>
      </div>
      <div
        className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700"
        data-testid="inbox-list"
      >
        {active.map((j) => (
          <div key={j.job_id} className="p-4 flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">{j.model_name}</span>
              <span className="text-slate-400 text-sm ml-2">#{j.job_id}</span>
              <span className="ml-2 px-2 py-0.5 rounded text-sm bg-green-900 text-green-300">
                {j.state || "running"}
              </span>
            </div>
            <Link to="/viewer" className="text-sm text-cyan-400 hover:underline">
              View
            </Link>
          </div>
        ))}
        {completed.map((j) => (
          <div key={j.job_id} className="p-4 flex items-center justify-between opacity-80">
            <div>
              <span className="font-medium text-sm">{j.model_name}</span>
              <span className="text-slate-400 text-sm ml-2">#{j.job_id}</span>
              <span className="ml-2 px-2 py-0.5 rounded text-sm bg-slate-700 text-slate-300">
                {j.state || "completed"}
              </span>
            </div>
            <Link to="/trajectory" className="text-sm text-cyan-400 hover:underline">
              Trajectory
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
