import { useCallback, useEffect, useRef, useState } from "react";

interface ProviderInfo {
  status: "probing" | "detected" | "not_found";
  models: { name: string }[];
  port: number;
}

type ProviderStatus = Record<string, ProviderInfo>;

const PROVIDER_DEFS = [
  { id: "ollama", label: "Ollama", port: 11434, probeUrl: "http://127.0.0.1:11434/api/tags" },
  { id: "lm-studio", label: "LM Studio", port: 1234, probeUrl: "http://127.0.0.1:1234/v1/models" },
  { id: "vllm", label: "vLLM", port: 8000, probeUrl: "http://127.0.0.1:8000/v1/models" },
];

export default function Settings() {
  const [modelDir, setModelDir] = useState("");
  const [jobsDir, setJobsDir] = useState("");
  const [toast, setToast] = useState("");

  const [providers, setProviders] = useState<ProviderStatus>({});
  const [selectedProvider, setSelectedProvider] = useState(() => localStorage.getItem("llm_provider") || "");
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("llm_model") || "");
  const [testResult, setTestResult] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const probing = useRef(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setModelDir(d.settings.model_dir || "");
          setJobsDir(d.settings.jobs_dir || "");
        }
      })
      .catch(() => {});
  }, []);

  const probeAll = useCallback(async () => {
    if (probing.current) return;
    probing.current = true;
    const init: ProviderStatus = {};
    for (const def of PROVIDER_DEFS) {
      init[def.id] = { status: "probing", models: [], port: def.port };
    }
    setProviders(init);

    const results = await Promise.allSettled(
      PROVIDER_DEFS.map(async (def) => {
        try {
          const r = await fetch(def.probeUrl, { signal: AbortSignal.timeout(3000) });
          if (!r.ok) throw new Error("HTTP " + r.status);
          const data = await r.json();
          let models: { name: string }[] = [];
          if (def.id === "ollama") {
            models = (data.models || []).map((m: any) => ({ name: m.name }));
          } else {
            models = (data.data || []).map((m: any) => ({ name: m.id }));
          }
          return { id: def.id, status: "detected" as const, models, port: def.port };
        } catch {
          return { id: def.id, status: "not_found" as const, models: [], port: def.port };
        }
      }),
    );

    const next: ProviderStatus = {};
    for (const result of results) {
      if (result.status === "fulfilled") {
        next[result.value.id] = { status: result.value.status, models: result.value.models, port: result.value.port };
      }
    }
    setProviders(next);

    const detected = Object.entries(next).filter(([, v]) => v.status === "detected");
    if (detected.length > 0) {
      const savedProvider = localStorage.getItem("llm_provider");
      const savedModel = localStorage.getItem("llm_model");
      if (savedProvider && next[savedProvider]) {
        setSelectedProvider(savedProvider);
        const models = next[savedProvider].models;
        if (savedModel && models.some((m) => m.name === savedModel)) {
          setSelectedModel(savedModel);
        } else if (models.length > 0) {
          setSelectedModel(models[0].name);
        }
      } else {
        const first = detected[0][1];
        setSelectedProvider(detected[0][0]);
        if (first.models.length > 0) setSelectedModel(first.models[0].name);
      }
    }
    probing.current = false;
  }, []);

  useEffect(() => {
    probeAll();
  }, [probeAll]);

  const onProviderChange = (id: string) => {
    setSelectedProvider(id);
    localStorage.setItem("llm_provider", id);
    const info = providers[id];
    if (info && info.models.length > 0) {
      setSelectedModel(info.models[0].name);
      localStorage.setItem("llm_model", info.models[0].name);
    }
  };

  const onModelChange = (name: string) => {
    setSelectedModel(name);
    localStorage.setItem("llm_model", name);
  };

  const testConnection = async () => {
    setTestLoading(true);
    setTestResult("Testing...");
    try {
      const r = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          prompt: "Hello, respond with just: OK",
        }),
      });
      const data = await r.json();
      setTestResult(data.response ? "Connected" : `Failed: ${data.error || "no response"}`);
    } catch (e) {
      setTestResult(`Error: ${String(e)}`);
    }
    setTestLoading(false);
  };

  const handleSave = async () => {
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_dir: modelDir, jobs_dir: jobsDir }),
      });
      if (r.ok) {
        setToast("Settings saved (session only).");
        setTimeout(() => setToast(""), 3000);
      } else {
        setToast("Failed to save settings.");
      }
    } catch (e) {
      setToast(String(e));
    }
  };

  const detectedProviders = Object.entries(providers).filter(([, v]) => v.status === "detected");
  const selectedInfo = providers[selectedProvider];
  const availableModels = selectedInfo?.models || [];
  const allProbed = Object.values(providers).length > 0 && Object.values(providers).every((v) => v.status !== "probing");

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {toast && <div className="bg-green-900 text-green-300 px-4 py-2 rounded-lg mb-4 text-sm">{toast}</div>}

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4">
        <h2 className="text-lg font-semibold">Directories</h2>
        <div>
          <label className="block text-xs text-slate-400 mb-1">MUJOCO_MODEL_DIR</label>
          <input
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500"
            value={modelDir}
            onChange={(e) => setModelDir(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">MUJOCO_JOBS_DIR</label>
          <input
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500"
            value={jobsDir}
            onChange={(e) => setJobsDir(e.target.value)}
          />
        </div>
        <div className="text-xs text-slate-500">Changes persist for the current session only.</div>
        <button
          onClick={handleSave}
          className="bg-cyan-700 hover:bg-cyan-600 text-white px-5 py-2 rounded-lg text-sm font-medium"
        >
          Save
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Local LLM</h2>
        <p className="text-xs text-slate-400">
          AI tools use the selected provider and model for chat and analysis.
        </p>

        {!allProbed && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
            Probing local providers...
          </div>
        )}

        {allProbed && detectedProviders.length === 0 && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-xs text-amber-300">
            No local LLM detected. Install{" "}
            <a href="https://ollama.com" className="underline" target="_blank" rel="noreferrer">Ollama</a>{" "}
            or <a href="https://lmstudio.ai" className="underline" target="_blank" rel="noreferrer">LM Studio</a> to enable AI features.
          </div>
        )}

        {allProbed && detectedProviders.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Provider</label>
                <select
                  data-testid="llm-provider-select"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  value={selectedProvider}
                  onChange={(e) => onProviderChange(e.target.value)}
                >
                  {detectedProviders.map(([id]) => (
                    <option key={id} value={id}>
                      {PROVIDER_DEFS.find((d) => d.id === id)?.label || id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Model</label>
                <select
                  data-testid="llm-model-select"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                >
                  {availableModels.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {selectedProvider}
              </span>
              <button
                onClick={testConnection}
                disabled={testLoading}
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-xs px-3 py-1.5 rounded-lg border border-slate-600"
              >
                {testLoading ? "Testing..." : "Test Connection"}
              </button>
              {testResult && (
                <span className={`text-xs ${testResult === "Connected" ? "text-green-400" : "text-yellow-400"}`}>
                  {testResult}
                </span>
              )}
            </div>
          </>
        )}

        {allProbed && (
          <div className="space-y-1">
            <p className="text-xs text-slate-500 mb-1">Detection results:</p>
            {PROVIDER_DEFS.map((def) => {
              const info = providers[def.id];
              const status = info?.status || "probing";
              return (
                <div key={def.id} className="flex items-center gap-2 text-xs">
                  {status === "probing" && <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />}
                  {status === "detected" && <span className="w-2 h-2 rounded-full bg-green-500" />}
                  {status === "not_found" && <span className="w-2 h-2 rounded-full bg-slate-600" />}
                  <span className="text-slate-400">{def.label}</span>
                  <span className="text-slate-600">:{def.port}</span>
                  <span className={status === "detected" ? "text-green-500" : status === "not_found" ? "text-slate-500" : "text-slate-400"}>
                    {status === "detected" ? "Detected" : status === "not_found" ? "Not found" : "Probing..."}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-xs text-slate-500">
          The LLM page uses these settings. Changes are saved to localStorage and persist across sessions.
        </div>
      </div>
    </div>
  );
}
