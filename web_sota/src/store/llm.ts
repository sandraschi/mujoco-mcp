import { create } from "zustand";

export interface LlmProviderInfo {
  status: "probing" | "detected" | "not_found";
  models: { name: string }[];
}

export interface LlmState {
  providers: Record<string, LlmProviderInfo>;
  selectedProvider: string;
  selectedModel: string;
  gpuDetected: boolean;
  probing: boolean;
  setProviders: (p: Record<string, LlmProviderInfo>) => void;
  setSelectedProvider: (id: string) => void;
  setSelectedModel: (name: string) => void;
  setGpuDetected: (v: boolean) => void;
  setProbing: (v: boolean) => void;
}

export const useLlmStore = create<LlmState>((set) => ({
  providers: {},
  selectedProvider: (() => {
    try {
      return localStorage.getItem("llm_provider") || "";
    } catch {
      return "";
    }
  })(),
  selectedModel: (() => {
    try {
      return localStorage.getItem("llm_model") || "";
    } catch {
      return "";
    }
  })(),
  gpuDetected: false,
  probing: true,
  setProviders: (providers) => set({ providers }),
  setSelectedProvider: (selectedProvider) => {
    try {
      localStorage.setItem("llm_provider", selectedProvider);
    } catch {}
    set({ selectedProvider });
  },
  setSelectedModel: (selectedModel) => {
    try {
      localStorage.setItem("llm_model", selectedModel);
    } catch {}
    set({ selectedModel });
  },
  setGpuDetected: (gpuDetected) => set({ gpuDetected }),
  setProbing: (probing) => set({ probing }),
}));
