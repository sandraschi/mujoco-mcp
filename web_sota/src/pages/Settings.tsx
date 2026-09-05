import { useCallback, useEffect, useState } from "react";
import { useLlmStore } from "../store/llm";

const PROVIDER_DEFS = [
  { id: "ollama", label: "Ollama", port: 11434 },
  { id: "lm-studio", label: "LM Studio", port: 1234 },
  { id: "vllm", label: "vLLM", port: 8000 },
];

export default function Settings() {
  const [modelDir, setModelDir] = useState("");
  const [jobsDir, setJobsDir] = useState("");
  const [toast, setToast] = useState("");

  const {
    providers,
    selectedProvider,
    selectedModel,
    setProviders,
    setSelectedProvider,
    setSelectedModel,
    setProbing,
  } = useLlmStore();
  const [testResult, setTestResult] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/settings");
        if (r.ok) {
          const d = await r.json();
          if (!cancelled && d.settings) {
            setModelDir(d.settings.model_dir || "");
            setJobsDir(d.settings.jobs_dir || "");
          }
        }
      } catch {}
      if (!cancelled) setLoadingSettings(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const probeAll = useCallback(async () => {
    setProbing(true);
    setError(null);
    // single backend probe — avoids CORS on direct 127.0.0.1:11434 fetches
    try {
      const r = await fetch("/api/llm/providers");
      if (!r.ok) throw new Error(`${r.status}`);
      const data = await r.json();
      const next: Record<string, { status: "probing" | "detected" | "not_found"; models: { name: string }[] }> = {};
      for (const def of PROVIDER_DEFS) {
        const entry = data[def.id];
        if (entry && entry.status === "detected") {
          next[def.id] = { status: "detected", models: entry.models || [] };
        } else if (entry && entry.status === "not_found") {
          next[def.id] = { status: "not_found", models: [] };
        } else {
          next[def.id] = { status: "not_found", models: [] };
        }
      }
      setProviders(next as any);

      const detected = Object.entries(next).filter(([, v]) => v.status === "detected");
      if (detected.length > 0) {
        const savedProvider = localStorage.getItem("llm_provider");
        const savedModel = localStorage.getItem("llm_model");
        if (savedProvider && next[savedProvider]?.status === "detected") {
          setSelectedProvider(savedProvider);
          const models = next[savedProvider].models;
          if (savedModel && models.some((m) => m.name === savedModel)) {
            setSelectedModel(savedModel);
          } else if (models.length > 0) {
            setSelectedModel(models[0].name);
          }
        } else if (!selectedProvider || next[selectedProvider]?.status !== "detected") {
          const first = detected[0];
          setSelectedProvider(first[0]);
          if (first[1].models.length > 0) setSelectedModel(first[1].models[0].name);
        }
      }
    } catch (e) {
      setError(String(e));
      const fallback: Record<string, { status: "not_found"; models: never[] }> = {};
      for (const def of PROVIDER_DEFS) fallback[def.id] = { status: "not_found", models: [] };
      setProviders(fallback as any);
    } finally {
      setProbing(false);
    }
  }, [setProviders, setSelectedProvider, setSelectedModel, setProbing, selectedProvider]);

  useEffect(() => {
    probeAll();
  }, [probeAll]);

  const onProviderChange = (id: string) => {
    setSelectedProvider(id);
    const info = (providers as any)[id];
    if (info && info.models.length > 0) {
      setSelectedModel(info.models[0].name);
    }
  };

  const onModelChange = (name: string) => {
    setSelectedModel(name);
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
        setToast("Settings saved.");
        setTimeout(() => setToast(""), 3000);
      } else {
        setToast("Failed to save settings.");
      }
    } catch (e) {
      setToast(String(e));
    }
  };

  const selectedInfo = (providers as any)[selectedProvider];
  const availableModels: { name: string }[] = selectedInfo?.models || [];
  const isProbing = (useLlmStore.getState() as any).probing ?? false;
  const detectedProviders = Object.entries(providers).filter(([, v]) => (v as any).status === "detected");
  const allProbed = Object.keys(providers).length > 0 && !isProbing;

  if (loadingSettings) {
    return (
      <div className="max-w-3xl p-6 text-sm text-slate-300" data-testid="settings-page">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-3xl" data-testid="settings-page">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {toast && <div className="bg-green-900 text-green-300 px-4 py-2 rounded-lg mb-4 text-sm">{toast}</div>}
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4" data-testid="settings-dirs">
        <h2 className="text-lg font-semibold">Directories</h2>
        <div>
          <label className="block text-sm text-slate-300 mb-1">MUJOCO_MODEL_DIR</label>
          <input
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500 text-slate-100"
            value={modelDir}
            onChange={(e) => setModelDir(e.target.value)}
            placeholder="models/"
            data-testid="settings-model-dir"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">MUJOCO_JOBS_DIR</label>
          <input
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500 text-slate-100"
            value={jobsDir}
            onChange={(e) => setJobsDir(e.target.value)}
            placeholder="jobs/"
            data-testid="settings-jobs-dir"
          />
        </div>
        <div className="text-sm text-slate-300">Changes persist for the current session only.</div>
        <button
          onClick={handleSave}
          className="bg-cyan-700 hover:bg-cyan-600 text-white px-5 py-2 rounded-lg text-sm font-medium"
          data-testid="settings-save"
        >
          Save
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mt-6 space-y-4" data-testid="settings-llm">
        <h2 className="text-lg font-semibold">Local LLM</h2>
        <p className="text-sm text-slate-300">AI tools use the selected provider and model for chat and analysis.</p>

        {!allProbed && (
          <div className="flex items-center gap-2 text-sm text-slate-300" data-testid="llm-probing">
            <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
            Probing local providers...
          </div>
        )}

        {allProbed && detectedProviders.length === 0 && (
          <div
            className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-sm text-amber-300"
            data-testid="llm-no-provider"
          >
            No local LLM detected. Install{" "}
            <a href="https://ollama.com" className="underline" target="_blank" rel="noreferrer">
              Ollama
            </a>{" "}
            or{" "}
            <a href="https://lmstudio.ai" className="underline" target="_blank" rel="noreferrer">
              LM Studio
            </a>{" "}
            to enable AI features.
          </div>
        )}

        {allProbed && detectedProviders.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Provider</label>
                <select
                  data-testid="llm-provider-select"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-slate-100"
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
                <label className="block text-sm text-slate-300 mb-1">Model</label>
                <select
                  data-testid="llm-model-select"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-slate-100"
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
              <span className="flex items-center gap-1.5 text-sm text-slate-300">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {selectedProvider}
              </span>
              <button
                onClick={testConnection}
                disabled={testLoading || !selectedModel}
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-sm px-3 py-1.5 rounded-lg border border-slate-600"
                data-testid="llm-test-btn"
              >
                {testLoading ? "Testing..." : "Test Connection"}
              </button>
              {testResult && (
                <span
                  className={`text-sm ${testResult === "Connected" ? "text-green-400" : "text-amber-300"}`}
                  data-testid="llm-test-result"
                >
                  {testResult}
                </span>
              )}
            </div>
          </>
        )}

        {allProbed && (
          <div className="space-y-1" data-testid="llm-detection-results">
            <p className="text-sm text-slate-300 mb-1">Detection results:</p>
            {PROVIDER_DEFS.map((def) => {
              const info = (providers as any)[def.id];
              const status = info?.status || "not_found";
              return (
                <div key={def.id} className="flex items-center gap-2 text-sm">
                  {status === "probing" && <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />}
                  {status === "detected" && <span className="w-2 h-2 rounded-full bg-green-500" />}
                  {status === "not_found" && <span className="w-2 h-2 rounded-full bg-slate-600" />}
                  <span className="text-slate-300">{def.label}</span>
                  <span className="text-slate-300">:{def.port}</span>
                  <span className={status === "detected" ? "text-green-400" : "text-slate-300"}>
                    {status === "detected" ? "Detected" : "Not found"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-sm text-slate-300">
          The LLM page uses these settings. Changes are saved to localStorage and persist across sessions.
        </div>
      </div>
    </div>
  );
}
