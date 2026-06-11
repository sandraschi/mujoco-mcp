import { useState, useEffect, useRef, useCallback } from "react";

interface LogEntry {
  job_id: string;
  file: string;
  content: string;
}

export default function Logging() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState("");
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const r = await fetch("/api/logs?limit=1000");
      if (r.ok) {
        const d = await r.json();
        if (d.logs) setLogs(d.logs);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchLogs();
    const iv = setInterval(fetchLogs, 3000);
    return () => clearInterval(iv);
  }, [fetchLogs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const displayed = logs.filter((l) => {
    if (selectedFile && `${l.job_id}/${l.file}` !== selectedFile) return false;
    if (search && !l.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const fileOptions = Array.from(new Set(logs.map((l) => `${l.job_id}/${l.file}`)));

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Logging</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
          value={selectedFile}
          onChange={(e) => setSelectedFile(e.target.value)}
        >
          <option value="">All files</option>
          {fileOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <input
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:border-cyan-500"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="text-xs text-slate-400 self-center">{displayed.length} entries</div>
      </div>

      {/* Terminal */}
      <div className="bg-black rounded-xl border border-slate-700 p-4 font-mono text-xs h-[600px] overflow-auto">
        {displayed.length === 0 && (
          <div className="text-slate-600">No log entries match the current filter.</div>
        )}
        {displayed.map((l, i) => (
          <div key={i} className="mb-2">
            <span className="text-cyan-500">[{l.job_id}/{l.file}]</span>{" "}
            <span className="text-slate-400 whitespace-pre-wrap">{l.content}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
