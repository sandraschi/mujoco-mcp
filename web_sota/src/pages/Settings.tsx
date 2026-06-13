import { useState, useEffect } from "react";

export default function Settings() {
  const [modelDir, setModelDir] = useState("");
  const [jobsDir, setJobsDir] = useState("");
  const [toast, setToast] = useState("");

  const [providers, setProviders] = useState<Record<string, any[]>>({});
  const [selectedProvider, setSelectedProvider] = useState("ollama");
  const [selectedModel, setSelectedModel] = useState("");
  const [testResult, setTestResult] = useState("");

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

  useEffect(() => {
    fetch("/api/llm/providers")
      .then((r) => r.json())
      .then((d) => {
        setProviders(d);
        if (d.ollama?.length) {
          const saved = localStorage.getItem("llm_provider") || "ollama";
          const savedModel = localStorage.getItem("llm_model") || d.ollama[0]?.name || "llama3.2:3b";
          setSelectedProvider(saved);
          setSelectedModel(savedModel);
        }
      })
      .catch(() => setProviders({ ollama: [{name:"llama3.2:3b"}] }));
  }, []);

  const saveLlmConfig = (provider: string, model: string) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
    localStorage.setItem("llm_provider", provider);
    localStorage.setItem("llm_model", model);
  };

  const testConnection = async () => {
    setTestResult("Testing...");
    try {
      const r = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, model: selectedModel, prompt: "Hello, respond with just: OK" }),
      });
      const data = await r.json();
      setTestResult(data.response ? "Connected" : "Failed: " + (data.error || "no response"));
    } catch (e) {
      setTestResult("Error: " + String(e));
    }
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

  const providerModels = providers[selectedProvider] || providers["ollama"] || [];
  const providerReachable = providers[selectedProvider] ? true : false;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {toast && (
        <div className="bg-green-900 text-green-300 px-4 py-2 rounded-lg mb-4 text-sm">{toast}</div>
      )}

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4">
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
        <p className="text-xs text-slate-400">Select which local LLM provider and model to use for AI tools.</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Provider</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              value={selectedProvider}
              onChange={(e) => {
                const p = e.target.value;
                const models = providers[p] || [];
                const m = models[0]?.name || "llama3.2:3b";
                saveLlmConfig(p, m);
              }}
            >
              {Object.keys(providers).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Model</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              value={selectedModel}
              onChange={(e) => saveLlmConfig(selectedProvider, e.target.value)}
            >
              {providerModels.map((m: any) => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${providerReachable ? "bg-green-500" : "bg-red-500"}`} />
            {selectedProvider}
          </span>
          <button
            onClick={testConnection}
            className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-lg border border-slate-600"
          >
            Test Connection
          </button>
          {testResult && (
            <span className={`text-xs ${testResult === "Connected" ? "text-green-400" : "text-yellow-400"}`}>
              {testResult}
            </span>
          )}
        </div>

        <div className="text-xs text-slate-500">
          The LLM page uses these settings. Changes are saved to localStorage and persist across sessions.
        </div>
      </div>
    </div>
  );
}
