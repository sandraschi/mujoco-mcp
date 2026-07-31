import { useEffect, useState } from "react";

export default function RLPlayground() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [algorithm, setAlgorithm] = useState("PPO");
  const [timesteps, setTimesteps] = useState(50000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (d.models) setModels(Object.keys(d.models));
      })
      .catch(() => {});
  }, []);

  const startTraining = async () => {
    setRunning(true);
    setResult(null);
    setError("");
    try {
      const r = await fetch("/api/mcp/train_policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: selectedModel, algorithm, total_timesteps: timesteps }),
      });
      const data = await r.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e: any) {
      setError(String(e));
    }
    setRunning(false);
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">RL Training Playground</h1>

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Model</label>
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
            <label className="block text-sm text-slate-300 mb-1">Algorithm</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
            >
              <option value="PPO">PPO</option>
              <option value="SAC">SAC</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Timesteps</label>
            <input
              type="number"
              min={1000}
              step={1000}
              value={timesteps}
              onChange={(e) => setTimesteps(Number(e.target.value))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={startTraining}
          disabled={running || !selectedModel}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
        >
          {running ? "Training..." : "Start Training"}
        </button>
        {running && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Training {algorithm} on {selectedModel} for {timesteps.toLocaleString()} steps...
          </div>
        )}
      </div>

      {error && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-300">{error}</p>
          <p className="text-xs text-amber-500 mt-1">
            Install RL extras: <code className="bg-slate-900 px-1.5 py-0.5 rounded">uv sync --extra rl</code>
          </p>
        </div>
      )}

      {result && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold mb-3 text-emerald-400">Training Complete</h2>
          <table className="w-full text-xs text-left">
            <tbody>
              {Object.entries(result)
                .filter(([k]) => k !== "success")
                .map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-700">
                    <td className="py-2 text-slate-400 font-medium w-1/3">{k}</td>
                    <td className="py-2 font-mono text-slate-200">{String(v)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
