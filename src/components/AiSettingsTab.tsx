// src/components/AiSettingsTab.tsx

import React, { useState, useEffect } from "react";
import { Sparkles, Brain, Check, RefreshCw, AlertTriangle, Play, ShieldAlert } from "lucide-react";
import { getCsrfToken } from "../lib/csrf";

export default function AiSettingsTab({ themeMode = "light" }: { themeMode?: "light" | "dark" }) {
  const [activeProvider, setActiveProvider] = useState("gemini-system");
  const [userGeminiKey, setUserGeminiKey] = useState("");
  const [userOpenaiKey, setUserOpenaiKey] = useState("");
  const [hasUserGeminiKey, setHasUserGeminiKey] = useState(false);
  const [hasUserOpenaiKey, setHasUserOpenaiKey] = useState(false);

  const [stats, setStats] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const rConfig = await fetch("/api/ai/config");
      if (rConfig.ok) {
        const c = await rConfig.json();
        setActiveProvider(c.activeProvider);
        setHasUserGeminiKey(c.hasUserGeminiKey);
        setHasUserOpenaiKey(c.hasUserOpenaiKey);
      }

      const rStats = await fetch("/api/ai/stats");
      if (rStats.ok) {
        const s = await rStats.json();
        setStats(s);
      }
    } catch (err: any) {
      setError("Failed to fetch AI configuration statuses.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/ai/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken(),
        },
        body: JSON.stringify({
          activeProvider,
          userGeminiKey: userGeminiKey || undefined,
          userOpenaiKey: userOpenaiKey || undefined,
        }),
      });

      if (!response.ok) {
         const data = await response.json();
         throw new Error(data.error || "Failed to update target keys.");
      }

      setMessage("AI configuration updated and encrypted securely via AES-256-GCM.");
      setUserGeminiKey("");
      setUserOpenaiKey("");
      await loadConfig();
    } catch (err: any) {
      setError(err.message || "Failed to save AI configuration settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setTestingId(providerId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken(),
        },
        body: JSON.stringify({ providerId }),
      });

      const res = await response.json();
      if (res.success) {
        setMessage(`Health validation succeeded for provider: ${providerId}`);
      } else {
        setError(`Health check failed for provider: ${providerId}. Check credentials.`);
      }
      await loadConfig();
    } catch (err: any) {
      setError(`Network connection failed during provider health check.`);
    } finally {
      setTestingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8" id="ai-provider-settings-tab">
      <div className={`p-6 md:p-8 rounded-2xl border transition duration-200 ${
        themeMode === "dark" 
          ? "bg-slate-900 border-slate-800 text-slate-100" 
          : "bg-white border-slate-200 text-slate-850 shadow-sm"
      }`}>
        <div className="flex items-center gap-3.5 mb-6">
          <Brain className="w-6 h-6 text-blue-550 dark:text-blue-400" />
          <div>
            <h3 className={`font-extrabold text-lg font-display ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>AI Failover &amp; Provider Settings</h3>
            <p className={`text-xs mt-0.5 ${themeMode === "dark" ? "text-slate-400" : "text-slate-500"}`}>Configure your preferred provider, failover order, or custom API credentials.</p>
          </div>
        </div>

        {message && (
          <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 rounded-xl text-xs mb-6">
            {message}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 text-rose-600 dark:text-rose-350 border border-red-500/20 rounded-xl text-xs mb-6 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider mb-2.5 ${themeMode === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                Primary API Provider
              </label>
              <select
                value={activeProvider}
                onChange={(e) => setActiveProvider(e.target.value)}
                className={`w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 border transition ${
                  themeMode === "dark" 
                    ? "bg-slate-950 border-slate-800 text-white" 
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                <option value="gemini-system">System Managed Gemini API (Shared Credits)</option>
                <option value="openai-system">System Managed OpenAI API (Shared Credits)</option>
                <option value="gemini-user">User-Owned Gemini API Key</option>
                <option value="openai-user">User-Owned OpenAI API Key</option>
              </select>
            </div>
          </div>

          <div className={`border-t pt-6 ${themeMode === "dark" ? "border-slate-800/80" : "border-slate-150"}`}>
            <h4 className={`text-xs font-bold mb-4 flex items-center gap-2 ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>
              <ShieldAlert className="w-4 h-4 text-orange-500" />
              Configure User-Owned Credentials (Optional)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider mb-2 ${themeMode === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  Your Personal Gemini API Key
                </label>
                <input
                  id="user-gemini-key-input"
                  type="password"
                  value={userGeminiKey}
                  placeholder={hasUserGeminiKey ? "•••••••••••••••• (Encrypted GCM)" : "AIzaSy..."}
                  onChange={(e) => setUserGeminiKey(e.target.value)}
                  className={`w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 border transition ${
                    themeMode === "dark" 
                      ? "bg-slate-950 border-slate-800 text-white" 
                      : "bg-white border-slate-200 text-slate-700"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider mb-2 ${themeMode === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  Your Personal OpenAI API Key
                </label>
                <input
                  id="user-openai-key-input"
                  type="password"
                  value={userOpenaiKey}
                  placeholder={hasUserOpenaiKey ? "•••••••••••••••• (Encrypted GCM)" : "sk-..."}
                  onChange={(e) => setUserOpenaiKey(e.target.value)}
                  className={`w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 border transition ${
                    themeMode === "dark" 
                      ? "bg-slate-950 border-slate-800 text-white" 
                      : "bg-white border-slate-200 text-slate-700"
                  }`}
                />
              </div>
            </div>
          </div>

          <button
            id="ai-config-save-btn"
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-2"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Encryption Setup
          </button>
        </form>
      </div>

      {/* Realtime API Health Panel */}
      <div className={`p-6 md:p-8 rounded-2xl border transition duration-200 ${
        themeMode === "dark" 
          ? "bg-slate-900 border-slate-800 text-slate-100" 
          : "bg-white border-slate-200 text-slate-850 shadow-sm"
      }`}>
        <h3 className={`font-extrabold text-base font-display mb-6 ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>Failover Diagnostics Dashboard</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.id} className={`p-4 rounded-xl flex flex-col justify-between border transition ${
              themeMode === "dark" 
                ? "bg-slate-950 border-slate-800" 
                : "bg-slate-50 border-slate-150 shadow-sm"
            }`}>
              <div>
                <div className="flex justify-between items-center">
                  <span className={`font-bold text-xs ${themeMode === "dark" ? "text-white" : "text-slate-800"}`}>{stat.name}</span>
                  <span className={`w-2 h-2 rounded-full ${stat.isHealthy ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                </div>
                <div className={`mt-3.5 space-y-1.5 text-[10px] font-mono ${themeMode === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  <p>Check: {stat.lastChecked === "Never" ? "Never checked" : new Date(stat.lastChecked).toLocaleTimeString()}</p>
                  <p>Response Time: {stat.latencyMs}ms</p>
                  <p className="text-emerald-500">Success Run: {stat.successCount}</p>
                  <p className="text-rose-500">Fail Run: {stat.failureCount}</p>
                </div>
              </div>

              <button
                id={`test-provider-btn-${stat.id}`}
                onClick={() => handleTestProvider(stat.id)}
                disabled={testingId === stat.id}
                className={`mt-4 w-full py-1.5 border font-semibold text-[10px] rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  themeMode === "dark" 
                    ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300" 
                    : "bg-white border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                {testingId === stat.id ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                ) : (
                  <Play className="w-2.5 h-2.5 text-blue-500" />
                )}
                Ping Check
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
