import { useEffect, useState } from "react";

export default function PopulationViewer() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [count, setCount] = useState(5);
  const [sweepParam, setSweepParam] = useState("gravity");
  const [sweepValues, setSweepValues] = useState("-9.81, -5.0, -1.0, -0.1");
  const [results, setResults] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [launched, setLaunched] = useState<any[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/models");
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        if (d.models) {
          const keys = Object.keys(d.models);
          setModels(keys);
          if (keys.length > 0) setSelectedModel(keys[0]);
        }
      } catch {}
      if (!cancelled) setLoadingModels(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async () => {
    setLoading(true);
    setResults(null);
    setError(null);
    const values = sweepValues
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((v) => !Number.isNaN(v));
    const sweeps = values.map((v) => ({ param: sweepParam, values: [v] }));
    try {
      const r = await fetch("/api/mcp/run_population", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: selectedModel, param_sweeps: sweeps, count }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setLaunched(data.jobs || []);
      if (data.jobs) {
        setTimeout(async () => {
          try {
            const ids = data.jobs.map((j: any) => j.job_id);
            const rr = await fetch("/api/mcp/population_results", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ job_ids: ids }),
            });
            setResults(await rr.json());
          } catch {}
          setLoading(false);
        }, 3000);
      } else setLoading(false);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl" data-testid="population-page">
      <h1 className="text-2xl font-bold mb-6">Population Runner</h1>

      {error && (
        <div
          className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-xl mb-4 text-sm"
          data-testid="population-error"
        >
          {error}
        </div>
      )}

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4 mb-6" data-testid="population-form">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Model</label>
            {loadingModels ? (
              <div className="text-sm text-slate-300 animate-pulse">Loading models...</div>
            ) : models.length === 0 ? (
              <div className="text-sm text-slate-300">No models — load one on the Models page.</div>
            ) : (
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                data-testid="population-model-select"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
              data-testid="population-count"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Sweep Parameter</label>
            <input
              value={sweepParam}
              onChange={(e) => setSweepParam(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
              data-testid="population-param"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Values (comma-separated)</label>
            <input
              value={sweepValues}
              onChange={(e) => setSweepValues(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
              data-testid="population-values"
            />
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading || !selectedModel}
          className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2 rounded-lg text-sm font-medium"
          data-testid="population-run"
        >
          {loading ? "Running..." : `Launch ${count} Sims`}
        </button>
      </div>

      {launched && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6" data-testid="population-launched">
          <h2 className="text-lg font-semibold mb-3 text-slate-100">Launched Jobs ({launched.length})</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-slate-300">
                <th className="pb-2">Job ID</th>
                <th className="pb-2">Model</th>
                <th className="pb-2">Params</th>
                <th className="pb-2">PID</th>
              </tr>
            </thead>
            <tbody>
              {launched.map((job) => (
                <tr key={job.job_id} className="border-t border-slate-700">
                  <td className="py-1.5 font-mono text-slate-300">{job.job_id}</td>
                  <td className="py-1.5 text-slate-100">{job.model_name}</td>
                  <td className="py-1.5 font-mono text-slate-300">{JSON.stringify(job.params)}</td>
                  <td className="py-1.5 text-slate-300">{job.pid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700" data-testid="population-results">
          <h2 className="text-lg font-semibold mb-3 text-slate-100">Results</h2>
          <p className="text-sm text-slate-300 mb-3">
            {results.completed} completed, {results.failed} failed of {results.total}
          </p>
          {results.results?.length === 0 ? (
            <p className="text-sm text-slate-300">No results yet.</p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-slate-300">
                  <th className="pb-2">Job ID</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Final Time</th>
                  <th className="pb-2">Params</th>
                </tr>
              </thead>
              <tbody>
                {(results.results || []).map((r: any) => (
                  <tr key={r.job_id} className="border-t border-slate-700">
                    <td className="py-1.5 font-mono text-slate-300">{r.job_id}</td>
                    <td className="py-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-sm ${
                          r.status === "completed"
                            ? "bg-green-900 text-green-300"
                            : r.status === "crashed"
                              ? "bg-red-900 text-red-300"
                              : "bg-yellow-900 text-yellow-300"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-slate-300">{r.final_state?.time?.toFixed(2) || "?"}s</td>
                    <td className="py-1.5 font-mono text-slate-300">{JSON.stringify(r.params)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!launched && !loading && (
        <div className="text-sm text-slate-300 text-center py-8 border border-dashed border-slate-700 rounded-xl">
          Configure a sweep above and launch parallel simulations.
        </div>
      )}
    </div>
  );
}
