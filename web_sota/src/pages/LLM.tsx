import { useCallback, useEffect, useRef, useState } from "react";
import { useLlmStore } from "../store/llm";

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
  "You have access to a MuJoCo physics simulation server with 20 tools (+3 Prefab cards). You can load models, start simulations, apply controls, analyze state, and execute multi-step workflows. Prefer structured responses with clear data.";

function buildSystemPrompt(personalityId: string, skillContent: string, customPrompt: string): string {
  const skill = skillContent || DEFAULT_SKILL;
  if (personalityId === "Custom") {
    const custom = customPrompt.trim() || PERSONALITIES.Custom;
    return `${skill}\n\n---\n\n## Custom Role\n${custom}`;
  }
  const role = PERSONALITIES[personalityId] || PERSONALITIES["Research Assistant"];
  return `${skill}\n\n---\n\n## Role\n${role}`;
}

export default function LLM() {
  const [chat, setChat] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [personality, setPersonality] = useState(() => localStorage.getItem(PERSONALITY_KEY) || "Research Assistant");
  const [customPrompt, setCustomPrompt] = useState("");
  const [skillContent, setSkillContent] = useState("");
  const [skillLoading, setSkillLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { providers, selectedProvider, selectedModel, setProviders, setSelectedProvider, setSelectedModel } =
    useLlmStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/skills");
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json();
        const first = d.skills?.[0];
        if (first?.name) {
          const rr = await fetch(`/api/skills/${first.name}`);
          if (rr.ok) {
            const dd = await rr.json();
            if (!cancelled && dd.content) setSkillContent(dd.content);
          }
        }
      } catch (e) {
        if (!cancelled) setFetchError(String(e));
      } finally {
        if (!cancelled) setSkillLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/llm/providers");
        if (!r.ok) throw new Error(`${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        // d is { ollama: {status, models}, lm-studio: {...}, vllm: {...} }
        const normalized: Record<string, any> = {};
        for (const k of Object.keys(d)) {
          normalized[k] = d[k].models || [];
        }
        // keep raw shape in store? store expects status/models; but we also need models array for select
        // store already has providers as Record<string, {status, models}> — use raw d
        setProviders(d);
        // restore saved
        const savedProvider = localStorage.getItem("llm_provider");
        const savedModel = localStorage.getItem("llm_model");
        const availableProviders = Object.keys(d).filter((k) => d[k]?.status === "detected");
        if (availableProviders.length > 0) {
          const targetProvider =
            savedProvider && d[savedProvider]?.status === "detected" ? savedProvider : availableProviders[0];
          if (targetProvider !== selectedProvider) setSelectedProvider(targetProvider);
          const models = d[targetProvider]?.models || [];
          if (models.length > 0) {
            const names = models.map((m: any) => m.name);
            if (savedModel && names.includes(savedModel)) {
              if (savedModel !== selectedModel) setSelectedModel(savedModel);
            } else if (!names.includes(selectedModel)) {
              setSelectedModel(names[0]);
            }
          }
        }
      } catch {
        if (!cancelled) setProviders({ ollama: { status: "not_found", models: [{ name: "llama3.2:3b" }] } } as any);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setProviders, setSelectedProvider, setSelectedModel, selectedProvider, selectedModel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  const updateModel = (model: string) => {
    setSelectedModel(model);
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
            provider: selectedProvider || "ollama",
            model: selectedModel || "llama3.2:3b",
            prompt,
            system: buildSystemPrompt(personality, skillContent, customPrompt),
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
    [selectedProvider, selectedModel, personality, skillContent, customPrompt],
  );

  const handleSend = () => {
    if (!input.trim() || loading) return;
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

  const providerModels: any[] = (providers as any)[selectedProvider]?.models || (providers as any).ollama?.models || [];
  const providerReachable = (providers as any)[selectedProvider]?.status === "detected";
  const providerKeys = Object.keys(providers).length ? Object.keys(providers) : ["ollama"];

  return (
    <div data-testid="chat-page" className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">LLM Interface</h1>

      <div data-testid="chat-controls" className="mb-4 flex gap-4 items-end flex-wrap">
        <div>
          <label className="text-sm text-slate-300 mr-2">Provider:</label>
          <select
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100"
            value={selectedProvider || providerKeys[0] || "ollama"}
            onChange={(e) => setSelectedProvider(e.target.value)}
            data-testid="llm-provider-select"
          >
            {providerKeys.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-300 mr-2">Model:</label>
          <select
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100"
            value={selectedModel}
            onChange={(e) => updateModel(e.target.value)}
            data-testid="llm-model-select"
          >
            {providerModels.length === 0 && <option value="llama3.2:3b">llama3.2:3b</option>}
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
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100"
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
        <span className="flex items-center gap-1.5 text-sm text-slate-300" data-testid="llm-provider-status">
          <span className={`w-2 h-2 rounded-full ${providerReachable ? "bg-green-500" : "bg-amber-500"}`} />
          {selectedProvider || "ollama"}
        </span>
        <div className="flex gap-2 ml-auto">
          <button
            data-testid="chat-export"
            onClick={handleExport}
            disabled={chat.length === 0}
            className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-sm px-3 py-1.5 rounded-lg border border-slate-600"
          >
            Export
          </button>
          <button
            data-testid="chat-clear"
            onClick={handleClear}
            disabled={chat.length === 0}
            className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-sm px-3 py-1.5 rounded-lg border border-slate-600"
          >
            Clear
          </button>
        </div>
      </div>

      {fetchError && <div className="mb-3 text-sm text-amber-300">Skill load: {fetchError}</div>}
      {skillLoading && <div className="mb-3 text-sm text-slate-300 animate-pulse">Loading skill...</div>}

      {personality === "Custom" && (
        <div className="mb-4">
          <textarea
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-slate-100"
            rows={3}
            placeholder="Enter your custom system prompt..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            data-testid="custom-prompt-input"
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
            <div className="text-sm font-medium mb-1 text-slate-100">{action.title}</div>
            <div className="text-sm text-slate-300 line-clamp-2">{action.prompt}</div>
          </button>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div data-testid="chat-messages" className="h-80 overflow-auto p-4 space-y-3">
          {chat.length === 0 && (
            <div className="text-slate-300 text-sm text-center pt-8">
              Click an example prompt or type a message to interact with the LLM.
            </div>
          )}
          {chat.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user" ? "bg-cyan-800 text-cyan-100" : "bg-slate-700 text-slate-100"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-700 rounded-xl px-4 py-2 text-sm text-slate-300 animate-pulse">Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-700 p-3 flex gap-2">
          <input
            data-testid="chat-input"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-slate-100"
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
