import { useCallback, useEffect, useState } from "react";

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

interface MenagerieModel {
  name: string;
  type: string;
  url: string;
}

export default function Models() {
  const [models, setModels] = useState<Record<string, ModelEntry>>({});
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"local" | "menagerie">("local");

  const [menagerie, setMenagerie] = useState<MenagerieModel[]>([]);
  const [menagerieSearch, setMenagerieSearch] = useState("");
  const [menagerieLoading, setMenagerieLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

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

  const fetchMenagerie = useCallback(async () => {
    setMenagerieLoading(true);
    try {
      const params = menagerieSearch ? `?search=${encodeURIComponent(menagerieSearch)}` : "";
      const r = await fetch(`/api/menagerie${params}`);
      if (r.ok) setMenagerie((await r.json()).models || []);
    } catch {}
    setMenagerieLoading(false);
  }, [menagerieSearch]);

  useEffect(() => {
    if (tab === "menagerie") fetchMenagerie();
  }, [tab, fetchMenagerie]);

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
        setMessage(`Loaded "${name}". ${d.joint_count} joints, ${d.body_count} bodies, ${d.actuator_count} actuators.`);
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

  const handleSeed = async () => {
    setSeeding(true);
    setMessage("Seeding from Menagerie...");
    try {
      const r = await fetch("/api/models/seed", { method: "POST" });
      const d = await r.json();
      setMessage(
        `Seeded ${d.seeded.length}.${d.failed.length ? ` ${d.failed.length} failed: ${d.failed.map((f: any) => f.name).join(", ")}` : ""}`,
      );
      fetchModels();
    } catch (e) {
      setMessage(String(e));
    }
    setSeeding(false);
  };

  const handleMenagerieDownload = async (modelName: string) => {
    setDownloading(modelName);
    setMessage(`Downloading ${modelName}...`);
    try {
      const r = await fetch("/api/menagerie/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName }),
      });
      const d = await r.json();
      if (d.success) {
        setMessage(`Loaded "${modelName}". ${d.joint_count}j ${d.body_count}b ${d.actuator_count}a.`);
        fetchModels();
      } else {
        setMessage(`Error: ${d.error}`);
      }
    } catch (e) {
      setMessage(String(e));
    }
    setDownloading(null);
  };

  const depotNames = new Set(Object.keys(models));

  return (
    <div className="max-w-5xl" data-testid="models-page">
      <h1 className="text-2xl font-bold mb-6">Models</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("local")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === "local" ? "bg-cyan-700 text-white" : "border border-slate-600 text-slate-400 hover:bg-slate-800"}`}
        >
          Local Depot
        </button>
        <button
          onClick={() => setTab("menagerie")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === "menagerie" ? "bg-cyan-700 text-white" : "border border-slate-600 text-slate-400 hover:bg-slate-800"}`}
        >
          MuJoCo Menagerie
        </button>
      </div>

      {tab === "local" && (
        <>
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6" data-testid="load-model-form">
            <h2 className="text-lg font-semibold mb-4">Load New Model</h2>
            <div className="flex flex-col gap-3">
              <input
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                placeholder="Model name (e.g. my_robot)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="model-name-input"
              />
              <input
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                placeholder="URL or local file path"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                data-testid="model-uri-input"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleLoad}
                  disabled={loading || !name || !uri}
                  className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  data-testid="load-model-btn"
                >
                  {loading ? "Loading..." : "Load Model"}
                </button>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="bg-green-700 hover:bg-green-600 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  data-testid="seed-models-btn"
                >
                  {seeding ? "Seeding..." : "Seed Quick Models"}
                </button>
              </div>
            </div>
            {message && (
              <pre className="mt-3 bg-slate-900 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap">
                {message}
              </pre>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700" data-testid="model-list">
            <h2 className="text-lg font-semibold p-4 border-b border-slate-700">
              Loaded Models ({Object.keys(models).length})
            </h2>
            <div className="divide-y divide-slate-700">
              {Object.keys(models).length === 0 && <div className="p-4 text-sm text-slate-400">No models loaded.</div>}
              {Object.entries(models).map(([name, entry]) => (
                <div key={name} className="p-4">
                  <div className="text-sm font-medium mb-1">{name}</div>
                  <div className="text-xs text-slate-400 mb-2 truncate">{entry.uri}</div>
                  {entry.metadata && (
                    <div className="flex gap-4 text-xs">
                      <span className="bg-slate-700 px-2 py-0.5 rounded">{entry.metadata.joint_count} joints</span>
                      <span className="bg-slate-700 px-2 py-0.5 rounded">{entry.metadata.body_count} bodies</span>
                      <span className="bg-slate-700 px-2 py-0.5 rounded">
                        {entry.metadata.actuator_count} actuators
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "menagerie" && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4">MuJoCo Menagerie</h2>
          <p className="text-xs text-slate-400 mb-4">
            Browse and download models from the{" "}
            <a
              href="https://github.com/google-deepmind/mujoco_menagerie"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              MuJoCo Menagerie
            </a>
            .
          </p>
          <input
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 mb-4"
            placeholder="Search models..."
            value={menagerieSearch}
            onChange={(e) => setMenagerieSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchMenagerie()}
            data-testid="menagerie-search"
          />
          {menagerieLoading && <div className="text-sm text-slate-400 animate-pulse">Loading...</div>}
          {!menagerieLoading && menagerie.length === 0 && (
            <div className="text-sm text-slate-500">No models found.</div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {menagerie.map((m) => {
              const inDepot = depotNames.has(m.name);
              return (
                <div
                  key={m.name}
                  className={`bg-slate-700 rounded-xl p-4 border ${inDepot ? "border-green-700" : "border-slate-600"} flex flex-col gap-2`}
                >
                  <div className="text-sm font-medium truncate" title={m.name}>
                    {m.name}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    {inDepot ? (
                      <span className="text-xs text-green-400 px-2 py-1">Loaded</span>
                    ) : (
                      <button
                        onClick={() => handleMenagerieDownload(m.name)}
                        disabled={downloading === m.name}
                        className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg"
                      >
                        {downloading === m.name ? "..." : "Download"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {message && (
            <pre className="mt-3 bg-slate-900 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap">{message}</pre>
          )}
        </div>
      )}
    </div>
  );
}
