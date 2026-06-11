import { useState, useEffect, useCallback } from "react";

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

  const fetchModels = useCallback(async () => {
    try {
      const r = await fetch("/api/models");
      if (r.ok) {
        const d = await r.json();
        if (d.models) setModels(d.models);
      }
    } catch {}
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const r = await fetch("/api/simulations");
      if (r.ok) {
        const d = await r.json();
        setJobs([...(d.active || []), ...(d.completed || [])]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchModels();
    fetchJobs();
    const iv = setInterval(fetchJobs, 3000);
    return () => clearInterval(iv);
  }, [fetchModels, fetchJobs]);

  const handleStart = async () => {
    if (!selectedModel) return;
    await fetch("/api/simulations/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_name: selectedModel, headless, render }),
    });
    fetchJobs();
  };

  const handleStop = async (jobId: string) => {
    await fetch("/api/simulations/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    });
    fetchJobs();
  };

  const handleExpand = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      setStateData("");
      return;
    }
    setExpandedJob(jobId);
    try {
      const r = await fetch(`/api/simulations/${jobId}/state`);
      if (r.ok) setStateData(JSON.stringify(await r.json(), null, 2));
      else setStateData("No state available");
    } catch (e) {
      setStateData(String(e));
    }
  };

  const handleAnalyze = async (jobId: string, modelName: string) => {
    setAiResult(`Analyzing ${modelName} (#${jobId})...`);
    let stateStr = "";
    try {
      const r = await fetch(`/api/simulations/${jobId}/state`);
      if (r.ok) stateStr = JSON.stringify(await r.json());
    } catch {}
    const r = await fetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b",
        prompt: `Analyze this MuJoCo simulation state for model "${modelName}":\n${stateStr}\n\nProvide a brief summary of what's happening.`,
      }),
    });
    const data = await r.json();
    setAiResult(data.response || data.error || "No response");
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Simulations</h1>

      {/* Start Form */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
        <h2 className="text-lg font-semibold mb-4">Start Simulation</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-slate-400 mb-1">Model</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              <option value="">-- Select model --</option>
              {Object.entries(models).map(([name]) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={headless} onChange={(e) => setHeadless(e.target.checked)} />
            Headless
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={render} onChange={(e) => setRender(e.target.checked)} />
            Render Frames
          </label>
          <button
            onClick={handleStart}
            disabled={!selectedModel}
            className="bg-green-700 hover:bg-green-600 disabled:bg-slate-600 disabled:text-slate-400 text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            Start
          </button>
        </div>
      </div>

      {/* AI Result */}
      {aiResult && (
        <pre className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6 text-xs text-slate-300 max-h-40 overflow-auto whitespace-pre-wrap">
          {aiResult}
        </pre>
      )}

      {/* Jobs Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <h2 className="text-lg font-semibold p-4 border-b border-slate-700">Running Jobs</h2>
        <div className="divide-y divide-slate-700">
          {jobs.length === 0 && (
            <div className="p-4 text-sm text-slate-500">No jobs.</div>
          )}
          {jobs.map((job) => (
            <div key={job.job_id}>
              <div
                className="p-4 flex items-center justify-between text-sm cursor-pointer hover:bg-slate-750"
                onClick={() => handleExpand(job.job_id)}
              >
                <div>
                  <span className="font-medium">{job.model_name}</span>
                  <span className="text-slate-500 ml-2">#{job.job_id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      job.running
                        ? "bg-green-900 text-green-300"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {job.running ? "Running" : job.completed ? "Completed" : "Stopped"}
                  </span>
                  {job.running && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAnalyze(job.job_id, job.model_name); }}
                        className="text-xs bg-cyan-700 hover:bg-cyan-600 text-white px-2 py-1 rounded"
                      >
                        AI Analyze
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStop(job.job_id); }}
                        className="text-xs bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded"
                      >
                        Stop
                      </button>
                    </>
                  )}
                  <span className="text-slate-500 text-xs">{expandedJob === job.job_id ? "\u25BC" : "\u25B6"}</span>
                </div>
              </div>
              {expandedJob === job.job_id && stateData && (
                <pre className="px-4 pb-4 text-xs text-slate-400 max-h-60 overflow-auto whitespace-pre-wrap bg-slate-900 mx-4 mb-4 rounded-lg p-3">
                  {stateData}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
