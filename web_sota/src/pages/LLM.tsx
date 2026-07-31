import { useCallback, useEffect, useRef, useState } from "react";

const HISTORY_KEY = "mujoco-mcp-chat-history";
const PERSONALITY_KEY = "mujoco-mcp-chat-personality";
const MAX_HISTORY = 100;

const PERSONALITIES: Record<string, string> = {
  "Research Assistant":
    "You are a research assistant specializing in physics simulation and robotics. Answer concisely with relevant technical details.",
  "Expert Reviewer":
    "You are a senior robotics engineer reviewing simulation results. Be critical, thorough, and suggest improvements.",
  "Quick Summarizer":
    "You are a summarization specialist. Keep responses to 2-3 sentences. Focus on key facts and numbers.",
  Custom: "Custom prompt — editable below.",
};

const quickActions = [
  { title: "Run Workflow", prompt: "Plan and execute: load a model and start a simulation" },
  { title: "Analyze State", prompt: "What is the current state of all active simulations?" },
  { title: "NL Control", prompt: "Apply a small torque to the first actuator of the running simulation" },
  { title: "Discover Model", prompt: "Suggest which MuJoCo model to load for testing a new control algorithm" },
  { title: "Status Check", prompt: "Check the health of the MuJoCo server and active jobs" },
  { title: "Debug Logs", prompt: "Read the runner logs from the last simulation and diagnose any issues" },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
}

const DEFAULT_SKILL =
  "You have access to a MuJoCo physics simulation server with 19 tools. You can load models, start simulations, apply controls, analyze state, and execute multi-step workflows. Prefer structured responses with clear data.";

function buildSystemPrompt(personalityId: string, skillContent: string): string {
  const skill = skillContent || DEFAULT_SKILL;
  const role = PERSONALITIES[personalityId] || PERSONALITIES["Research Assistant"];
  if (personalityId === "Custom") return skill;
  return `${skill}\n\n---\n\n## Role\n${role}`;
}

export default function LLM() {
  const [chat, setChat] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Record<string, any[]>>({});
  const [selectedProvider, setSelectedProvider] = useState("ollama");
  const [selectedModel, setSelectedModel] = useState("llama3.2:3b");
  const [personality, setPersonality] = useState(() => localStorage.getItem(PERSONALITY_KEY) || "Research Assistant");
  const [customPrompt, setCustomPrompt] = useState("");
  const [skillContent, setSkillContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => {
        const first = d.skills?.[0];
        if (first?.name) return fetch(`/api/skills/${first.name}`).then((r) => r.json());
        return null;
      })
      .then((d) => {
        if (d?.content) setSkillContent(d.content);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const savedProvider = localStorage.getItem("llm_provider") || "ollama";
    const savedModel = localStorage.getItem("llm_model") || "llama3.2:3b";
    setSelectedProvider(savedProvider);
    setSelectedModel(savedModel);

    fetch("/api/llm/providers")
      .then((r) => r.json())
      .then((d) => {
        setProviders(d);
        if (d.ollama?.length) {
          const names = d.ollama.map((m: { name: string }) => m.name);
          if (names.length > 0 && !names.includes(savedModel)) {
            setSelectedModel(names[0]);
          }
        }
      })
      .catch(() => setProviders({ ollama: [{ name: "llama3.2:3b" }] }));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const updateModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem("llm_model", model);
  };

  const updatePersonality = (id: string) => {
    setPersonality(id);
    localStorage.setItem(PERSONALITY_KEY, id);
  };

  const sendMessage = useCallback(
    async (prompt: string) => {
      const userMsg: ChatMessage = { role: "user", content: prompt, ts: new Date().toISOString() };
      setChat((prev) => {
        const next = [...prev, userMsg];
        saveHistory(next);
        return next;
      });
      setLoading(true);
      try {
        const r = await fetch("/api/llm/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: selectedProvider,
            model: selectedModel,
            prompt,
            system: buildSystemPrompt(personality, skillContent),
          }),
        });
        const data = await r.json();
        const reply = data.response || data.error || "No response";
        const assistantMsg: ChatMessage = { role: "assistant", content: reply, ts: new Date().toISOString() };
        setChat((prev) => {
          const next = [...prev, assistantMsg];
          saveHistory(next);
          return next;
        });
      } catch (e) {
        const errMsg: ChatMessage = { role: "assistant", content: String(e), ts: new Date().toISOString() };
        setChat((prev) => {
          const next = [...prev, errMsg];
          saveHistory(next);
          return next;
        });
      }
      setLoading(false);
    },
    [selectedProvider, selectedModel, personality, skillContent],
  );

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleClear = () => {
    setChat([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const handleExport = () => {
    if (chat.length === 0) return;
    const lines = chat.map((m) => `[${m.ts || "no-timestamp"}] ${m.role}: ${m.content}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mujoco-mcp-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const providerModels = providers[selectedProvider] || providers.ollama || [];
  const providerReachable = !!providers[selectedProvider];

  return (
    <div data-testid="chat-page" className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">LLM Interface</h1>

      <div data-testid="chat-controls" className="mb-4 flex gap-4 items-end flex-wrap">
        <div>
          <label className="text-sm text-slate-300 mr-2">Provider:</label>
          <select
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
          >
            {Object.keys(providers).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-300 mr-2">Model:</label>
          <select
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm"
            value={selectedModel}
            onChange={(e) => updateModel(e.target.value)}
          >
            {providerModels.map((m: any) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-300 mr-2">Personality:</label>
          <select
            data-testid="personality-select"
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm"
            value={personality}
            onChange={(e) => updatePersonality(e.target.value)}
          >
            {Object.keys(PERSONALITIES).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <span className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${providerReachable ? "bg-green-500" : "bg-red-500"}`} />
          {selectedProvider}
        </span>
        <div className="flex gap-2 ml-auto">
          <button
            data-testid="chat-export"
            onClick={handleExport}
            disabled={chat.length === 0}
            className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-xs px-3 py-1.5 rounded-lg border border-slate-600"
          >
            Export
          </button>
          <button
            data-testid="chat-clear"
            onClick={handleClear}
            disabled={chat.length === 0}
            className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-xs px-3 py-1.5 rounded-lg border border-slate-600"
          >
            Clear
          </button>
        </div>
      </div>

      {personality === "Custom" && (
        <div className="mb-4">
          <textarea
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            rows={3}
            placeholder="Enter your custom system prompt..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6" data-testid="example-prompts">
        {quickActions.map((action) => (
          <button
            key={action.title}
            className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-cyan-600 transition-colors"
            onClick={() => sendMessage(action.prompt)}
          >
            <div className="text-sm font-medium mb-1">{action.title}</div>
            <div className="text-xs text-slate-400 line-clamp-2">{action.prompt}</div>
          </button>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div data-testid="chat-messages" className="h-80 overflow-auto p-4 space-y-3">
          {chat.length === 0 && (
            <div className="text-slate-400 text-sm text-center pt-8">
              Click an example prompt or type a message to interact with the LLM.
            </div>
          )}
          {chat.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user" ? "bg-cyan-800 text-cyan-100" : "bg-slate-700 text-slate-200"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-700 rounded-xl px-4 py-2 text-sm text-slate-400 animate-pulse">Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-700 p-3 flex gap-2">
          <input
            data-testid="chat-input"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            placeholder="Ask the LLM something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            data-testid="chat-send"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
