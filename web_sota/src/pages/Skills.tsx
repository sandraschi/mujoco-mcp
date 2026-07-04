import { useEffect, useState } from "react";

export default function Skills() {
  const [skills, setSkills] = useState<{ name: string; title: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setSkills(d.skills || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) {
      setContent("");
      return;
    }
    setLoading(true);
    fetch(`/api/skills/${selected}`)
      .then((r) => r.json())
      .then((d) => setContent(d.content || "Skill not found"))
      .catch(() => setContent("Failed to load skill"))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Skills</h1>
      <p className="text-sm text-slate-400 mb-6">
        Skills tell an LLM how to use the MuJoCo server effectively. Select a skill to view its instructions.
      </p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {skills.map((s) => (
          <button
            key={s.name}
            onClick={() => setSelected(s.name)}
            className={`bg-slate-800 rounded-xl p-4 border text-left transition-colors ${
              selected === s.name ? "border-cyan-500 bg-slate-700" : "border-slate-700 hover:border-slate-500"
            }`}
          >
            <div className="text-sm font-medium text-slate-200">{s.title}</div>
            <div className="text-xs text-slate-500 mt-1 font-mono">{s.name}</div>
          </button>
        ))}
        {skills.length === 0 && (
          <div className="col-span-4 text-sm text-slate-500 text-center py-8">
            No skills found. The server may not expose any skills yet.
          </div>
        )}
      </div>

      {loading && <div className="text-slate-400 text-sm animate-pulse">Loading skill...</div>}

      {content && !loading && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 prose prose-invert max-w-none">
          <div className="text-sm text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
            {content.split("\n").map((line, i) => {
              if (line.startsWith("# "))
                return (
                  <h1 key={i} className="text-xl font-bold text-cyan-300 mb-4 mt-2">
                    {line.slice(2)}
                  </h1>
                );
              if (line.startsWith("## "))
                return (
                  <h2 key={i} className="text-lg font-semibold text-slate-100 mb-3 mt-6">
                    {line.slice(3)}
                  </h2>
                );
              if (line.startsWith("- `"))
                return (
                  <div key={i} className="text-sm text-slate-300 mb-1 ml-4">
                    {line}
                  </div>
                );
              if (line.trim() === "") return <div key={i} className="h-2" />;
              return (
                <p key={i} className="text-sm text-slate-300 mb-2">
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
