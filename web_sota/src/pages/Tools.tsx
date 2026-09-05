import { useEffect, useState } from "react";

interface ToolInfo {
  name: string;
}

export default function Tools() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/capabilities");
        if (!r.ok) throw new Error(`${r.status}`);
        const data = await r.json();
        if (!cancelled) setTools((data.tools || []).map((n: string) => ({ name: n })));
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = tools.filter((t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase()));

  if (loading)
    return (
      <div className="p-6 text-slate-300" data-testid="tools-page">
        Loading tools...
      </div>
    );
  if (error)
    return (
      <div className="p-6 text-red-400 text-sm" data-testid="tools-page">
        Failed to load capabilities: {error}
      </div>
    );
  if (tools.length === 0)
    return (
      <div className="max-w-5xl p-2" data-testid="tools-page">
        <h1 className="text-xl font-bold mb-2">Tools</h1>
        <p className="text-sm text-slate-400">No tools reported by /api/capabilities.</p>
      </div>
    );

  return (
    <div className="max-w-5xl" data-testid="tools-page">
      <h1 className="text-xl font-bold mb-1">Tools</h1>
      <p className="text-sm text-slate-400 mb-4">
        {tools.length} tools — via MCP and REST bridge POST /api/mcp/{"{tool_name}"}.
      </p>
      <input
        type="search"
        placeholder="Filter tools..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-sm bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-cyan-500"
        data-testid="tools-filter"
      />
      <div
        className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700"
        data-testid="tools-list"
      >
        {filtered.map((t) => (
          <div key={t.name} className="p-3 flex items-center justify-between">
            <span className="font-mono text-sm text-cyan-300">{t.name}</span>
            <span className="text-sm text-slate-400">POST /api/mcp/{t.name}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-4 text-sm text-slate-400">No tools match &quot;{filter}&quot;.</div>
        )}
      </div>
    </div>
  );
}
