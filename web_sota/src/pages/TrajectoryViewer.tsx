import { useEffect, useRef, useState } from "react";
import { SimRenderer, SimMeta, SimState } from "../lib/sim-renderer";

export default function TrajectoryViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SimRenderer | null>(null);
  const [jobs, setJobs] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [frames, setFrames] = useState<SimState[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [meta, setMeta] = useState<SimMeta | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => {
        const ids = [...(d.active || []), ...(d.completed || [])].map((j: any) => j.job_id);
        setJobs(ids);
        if (!selectedJob && ids.length > 0) setSelectedJob(ids[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    fetch(`/api/trajectory/${selectedJob}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.frames) {
          setFrames(d.frames);
          setFrameIdx(0);
          if (d.meta) setMeta(d.meta);
        }
      })
      .catch(() => {});
  }, [selectedJob]);

  useEffect(() => {
    if (!containerRef.current || !meta) return;
    const renderer = new SimRenderer(containerRef.current);
    rendererRef.current = renderer;
    renderer.buildScene(meta);
    renderer.startLoop();
    return () => { renderer.destroy(); rendererRef.current = null; };
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
          if (prev >= frames.length - 1) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, frames.length]);

  const loadTrajectory = async () => {
    const f = await (await fetch(`/api/trajectory/${selectedJob}`)).json();
    if (f.frames) { setFrames(f.frames); setFrameIdx(0); if (f.meta) setMeta(f.meta); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 mb-3 flex-shrink-0">
        <h1 className="text-2xl font-bold">Trajectory Viewer</h1>
        <select
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm"
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
        >
          {jobs.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <button onClick={loadTrajectory} className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-lg border border-slate-600">Load</button>
      </div>
      <div ref={containerRef} className="flex-1 rounded-xl overflow-hidden border border-slate-700 min-h-0" />
      <div className="flex items-center gap-3 mt-3 flex-shrink-0">
        <button
          onClick={() => setPlaying(!playing)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${playing ? "bg-red-700 hover:bg-red-600" : "bg-cyan-700 hover:bg-cyan-600"} text-white`}
        >
          {playing ? "Stop" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={frameIdx}
          onChange={(e) => { setFrameIdx(Number(e.target.value)); setPlaying(false); }}
          className="flex-1 accent-cyan-500"
        />
        <span className="text-xs text-slate-400 w-24 text-right">
          {frames.length > 0 ? `${frameIdx + 1}/${frames.length} (t=${frames[frameIdx]?.time?.toFixed(2) || "?"}s)` : "No frames"}
        </span>
      </div>
    </div>
  );
}
