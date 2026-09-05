import { useEffect, useRef, useState } from "react";
import { type SimMeta, SimRenderer, type SimState } from "../lib/sim-renderer";

export default function TrajectoryViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SimRenderer | null>(null);
  const [jobs, setJobs] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [frames, setFrames] = useState<SimState[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [meta, setMeta] = useState<SimMeta | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingJobs(true);
      try {
        const r = await fetch("/api/jobs");
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        const ids = [...(d.active || []), ...(d.completed || [])].map((j: any) => j.job_id);
        setJobs(ids);
        if (!selectedJob && ids.length > 0) setSelectedJob(ids[0]);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedJob]);

  useEffect(() => {
    if (!selectedJob) return;
    let cancelled = false;
    (async () => {
      setLoadingFrames(true);
      setError(null);
      try {
        const r = await fetch(`/api/trajectory/${selectedJob}`);
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        if (d.frames) {
          setFrames(d.frames);
          setFrameIdx(0);
          if (d.meta) setMeta(d.meta);
          if (!d.frames.length)
            setError("No trajectory recorded for this job. Call record_trajectory on a running sim first.");
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoadingFrames(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedJob]);

  useEffect(() => {
    if (!containerRef.current || !meta) return;
    const renderer = new SimRenderer(containerRef.current);
    rendererRef.current = renderer;
    renderer.buildScene(meta);
    renderer.startLoop();
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [meta]);

  useEffect(() => {
    if (frames.length > 0 && rendererRef.current) {
      rendererRef.current.updateState(frames[frameIdx]);
    }
  }, [frameIdx, frames]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setFrameIdx((prev) => {
          if (prev >= frames.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, frames.length]);

  const loadTrajectory = async () => {
    setLoadingFrames(true);
    setError(null);
    try {
      const r = await fetch(`/api/trajectory/${selectedJob}`);
      const f = await r.json();
      if (f.frames) {
        setFrames(f.frames);
        setFrameIdx(0);
        if (f.meta) setMeta(f.meta);
      }
    } catch (e) {
      setError(String(e));
    }
    setLoadingFrames(false);
  };

  return (
    <div className="h-full flex flex-col" data-testid="trajectory-page">
      <div className="flex items-center gap-4 mb-3 flex-shrink-0 flex-wrap">
        <h1 className="text-2xl font-bold">Trajectory Viewer</h1>
        {loadingJobs && <span className="text-sm text-slate-300 animate-pulse">Loading jobs...</span>}
        {!loadingJobs && jobs.length === 0 && <span className="text-sm text-slate-300">No jobs yet.</span>}
        {jobs.length > 0 && (
          <select
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100"
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            data-testid="trajectory-job-select"
          >
            {jobs.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={loadTrajectory}
          disabled={!selectedJob || loadingFrames}
          className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-sm px-3 py-1.5 rounded-lg border border-slate-600"
          data-testid="trajectory-load"
        >
          {loadingFrames ? "Loading..." : "Load"}
        </button>
      </div>
      {error && (
        <div className="text-sm text-amber-300 mb-2" data-testid="trajectory-error">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 rounded-xl overflow-hidden border border-slate-700 min-h-[400px] bg-slate-900"
        data-testid="trajectory-canvas"
      />
      <div className="flex items-center gap-3 mt-3 flex-shrink-0" data-testid="trajectory-controls">
        <button
          onClick={() => setPlaying(!playing)}
          disabled={frames.length === 0}
          className={`px-4 py-2 rounded-lg text-sm font-medium disabled:bg-slate-700 disabled:text-slate-500 ${playing ? "bg-red-700 hover:bg-red-600" : "bg-cyan-700 hover:bg-cyan-600"} text-white`}
          data-testid="trajectory-play"
        >
          {playing ? "Stop" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={frameIdx}
          onChange={(e) => {
            setFrameIdx(Number(e.target.value));
            setPlaying(false);
          }}
          className="flex-1 accent-cyan-500"
          data-testid="trajectory-slider"
        />
        <span className="text-sm text-slate-300 w-28 text-right" data-testid="trajectory-counter">
          {frames.length > 0
            ? `${frameIdx + 1}/${frames.length} (t=${frames[frameIdx]?.time?.toFixed(2) || "?"}s)`
            : "No frames"}
        </span>
      </div>
    </div>
  );
}
