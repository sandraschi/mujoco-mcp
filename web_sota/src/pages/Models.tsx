import { useState, useEffect, useCallback } from "react";

interface ModelMeta {
  joint_count: number;
  body_count: number;
  actuator_count: number;
}

interface ModelEntry {
  uri: string;
  path: string;
  metadata: ModelMeta;
}

export default function Models() {
  const [models, setModels] = useState<Record<string, ModelEntry>>({});
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchModels = useCallback(async () => {
    try {
      const r = await fetch("/api/models");
      if (r.ok) {
        const d = await r.json();
        if (d.models) setModels(d.models);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleLoad = async () => {
    if (!name || !uri) return;
    setLoading(true);
    setMessage("");
    try {
      const r = await fetch("/api/models/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, uri }),
      });
      const d = await r.json();
      if (d.success) {
        setMessage(`Loaded "${name}" successfully. ${d.joint_count} joints, ${d.body_count} bodies, ${d.actuator_count} actuators.`);
        setName("");
        setUri("");
        fetchModels();
      } else {
        setMessage(`Error: ${d.error}`);
      }
    } catch (e) {
      setMessage(String(e));
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Models</h1>

      {/* Load Form */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
        <h2 className="text-lg font-semibold mb-4">Load New Model</h2>
        <div className="flex flex-col gap-3">
          <input
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            placeholder="Model name (e.g. my_robot)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            placeholder="URL or local file path"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
          />
          <div>
            <button
              onClick={handleLoad}
              disabled={loading || !name || !uri}
              className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {loading ? "Loading..." : "Load Model"}
            </button>
          </div>
        </div>
        {message && (
          <pre className="mt-3 bg-slate-900 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap">
            {message}
          </pre>
        )}
      </div>

      {/* Model List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <h2 className="text-lg font-semibold p-4 border-b border-slate-700">
          Loaded Models ({Object.keys(models).length})
        </h2>
        <div className="divide-y divide-slate-700">
          {Object.keys(models).length === 0 && (
            <div className="p-4 text-sm text-slate-500">No models loaded.</div>
          )}
          {Object.entries(models).map(([name, entry]) => (
            <div key={name} className="p-4">
              <div className="text-sm font-medium mb-1">{name}</div>
              <div className="text-xs text-slate-400 mb-2 truncate">{entry.uri}</div>
              {entry.metadata && (
                <div className="flex gap-4 text-xs">
                  <span className="bg-slate-700 px-2 py-0.5 rounded">{entry.metadata.joint_count} joints</span>
                  <span className="bg-slate-700 px-2 py-0.5 rounded">{entry.metadata.body_count} bodies</span>
                  <span className="bg-slate-700 px-2 py-0.5 rounded">{entry.metadata.actuator_count} actuators</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
