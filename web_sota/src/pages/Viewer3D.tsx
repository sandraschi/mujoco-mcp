import { useEffect, useRef, useState } from "react";
import { type SimMeta, SimRenderer, type SimState } from "../lib/sim-renderer";

export default function Viewer3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SimRenderer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [jobs, setJobs] = useState<{ job_id: string; model_name: string }[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [simTime, setSimTime] = useState(0);
  const [simStep, setSimStep] = useState(0);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingJobs(true);
      setJobsError(null);
      try {
        const r = await fetch("/api/jobs");
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        const all = [...(d.active || []), ...(d.completed || [])];
        setJobs(all);
        if (!selectedJob && all.length > 0) setSelectedJob(all[0].job_id);
        if (all.length === 0) setStatus("No simulations yet. Start one on the Simulations page.");
      } catch (e) {
        if (!cancelled) setJobsError(String(e));
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedJob]);

  useEffect(() => {
    if (!selectedJob || !containerRef.current) return;

    const renderer = new SimRenderer(containerRef.current);
    rendererRef.current = renderer;
    renderer.startLoop();

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const host = location.host;
    const ws = new WebSocket(`${proto}//${host}/ws/sim/${selectedJob}`);
    wsRef.current = ws;
    setConnected(false);
    setStatus("Connecting...");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "meta") {
          const meta = msg.data as SimMeta;
          if (meta.body_names) renderer.buildScene(meta);
          setConnected(true);
          setStatus(`Model: ${meta.body_names?.[0] || "unknown"} — ${meta.body_names?.length || 0} bodies`);
        } else if (msg.type === "state") {
          const state = msg.data as SimState;
          if (state.body_positions) renderer.updateState(state);
          setSimTime(state.time);
          setSimStep(state.step);
        } else if (msg.type === "done") {
          setStatus(msg.error ? `Crashed: ${msg.error}` : "Simulation completed");
          setConnected(false);
        }
      } catch {}
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setStatus("WebSocket error — is the backend running on :11046?");

    return () => {
      renderer.destroy();
      rendererRef.current = null;
      ws.close();
      wsRef.current = null;
    };
  }, [selectedJob]);

  return (
    <div className="h-full flex flex-col" data-testid="viewer3d-page">
      <div className="flex items-center gap-4 mb-3 flex-shrink-0 flex-wrap">
        <h1 className="text-2xl font-bold">3D Viewer</h1>
        {loadingJobs && <span className="text-sm text-slate-300 animate-pulse">Loading jobs...</span>}
        {jobsError && <span className="text-sm text-red-300">{jobsError}</span>}
        {!loadingJobs && !jobsError && jobs.length === 0 && (
          <span className="text-sm text-slate-300">No jobs — start a simulation first.</span>
        )}
        {jobs.length > 0 && (
          <select
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100"
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            data-testid="viewer-job-select"
          >
            {jobs.map((j) => (
              <option key={j.job_id} value={j.job_id}>
                {j.job_id} — {j.model_name || "?"}
              </option>
            ))}
          </select>
        )}
        <span
          className={`flex items-center gap-1.5 text-sm ${connected ? "text-green-400" : "text-slate-300"}`}
          data-testid="viewer-status"
        >
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-slate-600"}`} />
          {connected ? "Live" : "Disconnected"}
        </span>
        <div className="text-sm text-slate-300" data-testid="viewer-time">
          t={simTime.toFixed(2)}s step={simStep}
        </div>
      </div>
      <div className="text-sm text-slate-300 mb-2" data-testid="viewer-detail">
        {status}
      </div>
      <div
        ref={containerRef}
        className="flex-1 rounded-xl overflow-hidden border border-slate-700 min-h-[400px] bg-slate-900"
        data-testid="viewer-canvas"
      />
    </div>
  );
}
