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

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (d.models) setModels(Object.keys(d.models));
      })
      .catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true);
    setResults(null);
    const values = sweepValues
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((v) => !Number.isNaN(v));
    const sweeps = values.map((v) => ({ param: sweepParam, values: [v] }));
    try {
      const r = await fetch("/api/mcp/run_population", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: selectedModel, param_sweeps: sweeps, count: count }),
      });
      const data = await r.json();
      setLaunched(data.jobs || []);
      if (data.jobs) {
        setTimeout(async () => {
          const ids = data.jobs.map((j: any) => j.job_id);
          const rr = await fetch("/api/mcp/population_results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_ids: ids }),
          });
          setResults(await rr.json());
          setLoading(false);
        }, 3000);
      }
    } catch (_e) {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Population Runner</h1>
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Model</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sweep Parameter</label>
            <input
              value={sweepParam}
              onChange={(e) => setSweepParam(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Values (comma-separated)</label>
            <input
              value={sweepValues}
              onChange={(e) => setSweepValues(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading || !selectedModel}
          className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
        >
          {loading ? "Running..." : `Launch ${count} Sims`}
        </button>
      </div>

      {launched && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold mb-3">Launched Jobs ({launched.length})</h2>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2">Job ID</th>
                <th className="pb-2">Model</th>
                <th className="pb-2">Params</th>
                <th className="pb-2">PID</th>
              </tr>
            </thead>
            <tbody>
              {launched.map((job) => (
                <tr key={job.job_id} className="border-t border-slate-700">
                  <td className="py-1.5 font-mono">{job.job_id}</td>
                  <td className="py-1.5">{job.model_name}</td>
                  <td className="py-1.5 font-mono text-slate-400">{JSON.stringify(job.params)}</td>
                  <td className="py-1.5">{job.pid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold mb-3">Results</h2>
          <p className="text-xs text-slate-400 mb-3">
            {results.completed} completed, {results.failed} failed of {results.total}
          </p>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2">Job ID</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Final Time</th>
                <th className="pb-2">Params</th>
              </tr>
            </thead>
            <tbody>
              {(results.results || []).map((r: any) => (
                <tr key={r.job_id} className="border-t border-slate-700">
                  <td className="py-1.5 font-mono">{r.job_id}</td>
                  <td className="py-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] ${
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
                  <td className="py-1.5">{r.final_state?.time?.toFixed(2) || "?"}s</td>
                  <td className="py-1.5 font-mono text-slate-400">{JSON.stringify(r.params)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
