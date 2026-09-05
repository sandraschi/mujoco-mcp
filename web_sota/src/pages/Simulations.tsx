import { useCallback, useEffect, useState } from "react";

interface ModelEntry {
  uri: string;
  path: string;
  metadata: { joint_count: number; body_count: number; actuator_count: number };
}

interface Job {
  job_id: string;
  model_name: string;
  running?: boolean;
  completed?: boolean;
  state?: string;
  headless?: boolean;
}

export default function Simulations() {
  const [models, setModels] = useState<Record<string, ModelEntry>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [headless, setHeadless] = useState(true);
  const [render, setRender] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [stateData, setStateData] = useState<string>("");
  const [aiResult, setAiResult] = useState<string>("");
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stateLoading, setStateLoading] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    setError(null);
    try {
      const r = await fetch("/api/models");
      if (!r.ok) throw new Error(`${r.status}`);
      const d = await r.json();
      if (d.models) setModels(d.models);
      if (d.models && Object.keys(d.models).length > 0 && !selectedModel) {
        setSelectedModel(Object.keys(d.models)[0]);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingModels(false);
    }
  }, [selectedModel]);

  const fetchJobs = useCallback(async () => {
    try {
      const r = await fetch("/api/jobs");
      if (!r.ok) throw new Error(`${r.status}`);
      const d = await r.json();
      setJobs([...(d.active || []), ...(d.completed || [])]);
    } catch {}
    setLoadingJobs(false);
  }, []);

  useEffect(() => {
    fetchModels();
    fetchJobs();
    const iv = setInterval(fetchJobs, 3000);
    return () => clearInterval(iv);
  }, [fetchModels, fetchJobs]);

  const handleStart = async () => {
    if (!selectedModel) return;
    setStarting(true);
    setError(null);
    try {
      const r = await fetch("/api/simulations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: selectedModel, headless, render }),
      });
      const data = await r.json();
      if (data.error) setError(data.error);
      else setAiResult(data.message || `Started ${selectedModel}`);
    } catch (e) {
      setError(String(e));
    }
    setStarting(false);
    fetchJobs();
  };

  const handleStop = async (jobId: string) => {
    try {
      const r = await fetch("/api/simulations/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await r.json();
      if (data.error) setError(data.error);
    } catch (e) {
      setError(String(e));
    }
    fetchJobs();
  };

  const handleExpand = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      setStateData("");
      return;
    }
    setExpandedJob(jobId);
    setStateLoading(true);
    try {
      const r = await fetch(`/api/simulations/${jobId}/state`);
      if (r.ok) {
        const j = await r.json();
        setStateData(JSON.stringify(j, null, 2));
      } else setStateData("No state available");
    } catch (e) {
      setStateData(String(e));
    }
    setStateLoading(false);
  };

  const handleAnalyze = async (jobId: string, modelName: string) => {
    setAiResult(`Analyzing ${modelName} (#${jobId})...`);
    let stateStr = "";
    try {
      const r = await fetch(`/api/simulations/${jobId}/state`);
      if (r.ok) stateStr = JSON.stringify(await r.json());
    } catch {}
    try {
      const r = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: localStorage.getItem("llm_model") || "llama3.2:3b",
          prompt: `Analyze this MuJoCo simulation state for model "${modelName}":\n${stateStr}\n\nProvide a brief summary of what's happening.`,
        }),
      });
      const data = await r.json();
      setAiResult(data.response || data.error || "No response");
    } catch (e) {
      setAiResult(String(e));
    }
  };

  if (loadingModels && loadingJobs && jobs.length === 0) {
    return (
      <div className="max-w-5xl p-6 text-sm text-slate-300" data-testid="simulations-page">
        Loading simulations...
      </div>
    );
  }

  return (
    <div className="max-w-5xl" data-testid="simulations-page">
      <h1 className="text-2xl font-bold mb-6">Simulations</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-xl mb-4 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-sm text-slate-300 hover:text-white ml-4"
            data-testid="sim-error-dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6" data-testid="start-sim-form">
        <h2 className="text-lg font-semibold mb-4 text-slate-100">Start Simulation</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-sm text-slate-300 mb-1">Model</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              data-testid="sim-model-select"
            >
              <option value="">-- Select model --</option>
              {Object.entries(models).map(([name]) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {Object.keys(models).length === 0 && !loadingModels && (
              <p className="text-sm text-slate-300 mt-2">
                No models yet. Load one on the <span className="text-cyan-400">Models</span> page.
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={headless}
              onChange={(e) => setHeadless(e.target.checked)}
              data-testid="sim-headless-toggle"
            />
            Headless
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={render}
              onChange={(e) => setRender(e.target.checked)}
              data-testid="sim-render-toggle"
            />
            Render Frames
          </label>
          <button
            onClick={handleStart}
            disabled={!selectedModel || starting}
            className="bg-green-700 hover:bg-green-600 disabled:bg-slate-600 disabled:text-slate-400 text-white px-5 py-2 rounded-lg text-sm font-medium"
            data-testid="sim-start-btn"
          >
            {starting ? "Starting..." : "Start"}
          </button>
        </div>
      </div>

      {aiResult && (
        <pre
          className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6 text-sm text-slate-300 max-h-40 overflow-auto whitespace-pre-wrap"
          data-testid="sim-ai-result"
        >
          {aiResult}
        </pre>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700" data-testid="jobs-list">
        <h2 className="text-lg font-semibold p-4 border-b border-slate-700 text-slate-100">Running Jobs</h2>
        <div className="divide-y divide-slate-700">
          {loadingJobs && jobs.length === 0 && <div className="p-4 text-sm text-slate-300">Loading jobs...</div>}
          {!loadingJobs && jobs.length === 0 && (
            <div className="p-4 text-sm text-slate-300">No jobs. Start a simulation above.</div>
          )}
          {jobs.map((job) => (
            <div key={job.job_id} data-testid="job-row">
              <div
                className="p-4 flex items-center justify-between text-sm cursor-pointer hover:bg-slate-700/50"
                onClick={() => handleExpand(job.job_id)}
                data-testid="job-expand"
              >
                <div>
                  <span className="font-medium text-slate-100">{job.model_name}</span>
                  <span className="text-slate-300 ml-2">#{job.job_id}</span>
                  {job.state && <span className="text-slate-300 ml-2">({job.state})</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-sm font-medium ${
                      job.running ? "bg-green-900 text-green-300" : "bg-slate-700 text-slate-300"
                    }`}
                    data-testid="job-status"
                  >
                    {job.running ? "Running" : (job as any).completed ? "Completed" : job.state || "Stopped"}
                  </span>
                  {job.running && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnalyze(job.job_id, job.model_name);
                        }}
                        className="text-sm bg-cyan-700 hover:bg-cyan-600 text-white px-2 py-1 rounded"
                        data-testid="job-analyze"
                      >
                        AI Analyze
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStop(job.job_id);
                        }}
                        className="text-sm bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded"
                        data-testid="job-stop"
                      >
                        Stop
                      </button>
                    </>
                  )}
                  <span className="text-slate-300 text-sm">{expandedJob === job.job_id ? "▼" : "▶"}</span>
                </div>
              </div>
              {expandedJob === job.job_id && (
                <div className="px-4 pb-4">
                  {stateLoading ? (
                    <div className="text-sm text-slate-300 animate-pulse p-3 bg-slate-900 rounded-lg">
                      Loading state...
                    </div>
                  ) : (
                    <pre
                      className="text-sm text-slate-300 max-h-60 overflow-auto whitespace-pre-wrap bg-slate-900 mx-0 rounded-lg p-3"
                      data-testid="job-state"
                    >
                      {stateData}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
