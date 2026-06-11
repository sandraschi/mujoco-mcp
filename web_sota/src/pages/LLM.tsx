import { useState, useRef, useEffect } from "react";

const quickActions = [
  { title: "Run Workflow", prompt: "Plan and execute: load a model and start a simulation" },
  { title: "Analyze State", prompt: "What is the current state of all active simulations?" },
  { title: "NL Control", prompt: "Apply a small torque to the first actuator of the running simulation" },
  { title: "Discover Model", prompt: "Suggest which MuJoCo model to load for testing a new control algorithm" },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function LLM() {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("llama3.2:3b");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/llm/providers")
      .then((r) => r.json())
      .then((d) => {
        if (d.ollama) {
          const names = d.ollama.map((m: { name: string }) => m.name);
          setProviders(names);
          if (names.length > 0 && !names.includes(selectedModel)) {
            setSelectedModel(names[0]);
          }
        }
      })
      .catch(() => setProviders(["llama3.2:3b"]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const sendMessage = async (prompt: string) => {
    setChat((prev) => [...prev, { role: "user", content: prompt }]);
    setLoading(true);
    try {
      const r = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, prompt }),
      });
      const data = await r.json();
      const reply = data.response || data.error || "No response";
      setChat((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setChat((prev) => [...prev, { role: "assistant", content: String(e) }]);
    }
    setLoading(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">LLM Interface</h1>

      {/* Model Selector */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 mr-2">Ollama Model:</label>
        <select
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          {providers.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
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

      {/* Chat */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="h-80 overflow-auto p-4 space-y-3">
          {chat.length === 0 && (
            <div className="text-slate-500 text-sm text-center pt-8">
              Click a quick action or type a message to interact with the LLM.
            </div>
          )}
          {chat.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-cyan-800 text-cyan-100"
                    : "bg-slate-700 text-slate-200"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-700 rounded-xl px-4 py-2 text-sm text-slate-400 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-700 p-3 flex gap-2">
          <input
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            placeholder="Ask the LLM something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
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
