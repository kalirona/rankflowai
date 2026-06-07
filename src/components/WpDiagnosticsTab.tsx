// src/components/WpDiagnosticsTab.tsx

import React, { useState, useEffect } from "react";
import { Globe, RefreshCw, AlertTriangle, CheckCircle, Activity, HelpCircle, Server, Info, ShieldAlert } from "lucide-react";
import { getCsrfToken } from "../lib/csrf";

interface WpDiagnosticsTabProps {
  sites: any[];
  themeMode?: "light" | "dark";
}

export default function WpDiagnosticsTab({ sites, themeMode = "light" }: WpDiagnosticsTabProps) {
  const [selectedSite, setSelectedSite] = useState("");
  const [customUsername, setCustomUsername] = useState("");
  const [customPassword, setCustomPassword] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sites && sites.length > 0 && !selectedSite) {
      setSelectedSite(sites[0].url);
    }
  }, [sites]);

  const loadHistory = async () => {
    if (!selectedSite) return;
    try {
      const response = await fetch(`/api/wordpress/diagnose/history?siteUrl=${encodeURIComponent(selectedSite)}`);
      if (response.ok) {
        const h = await response.json();
        setHistory(h);
      }
    } catch {
      // Slid gracefully
    }
  };

  useEffect(() => {
    loadHistory();
  }, [selectedSite]);

  const handleRunDiagnostics = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setResult(null);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/wordpress/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({
          siteUrl: selectedSite,
          username: customUsername || undefined,
          password: customPassword || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "End-to-end communication diagnostics probe returned failed code.");
      }

      setResult(data.log);
      setMessage("Channel diagnostics completed successfully.");
      await loadHistory();
    } catch (err: any) {
      setError(err.message || "WordPress API communication verification failed.");
    } finally {
      setIsRunning(false);
    }
  };

  const clearHistory = async () => {
    if (!selectedSite) return;
    try {
      await fetch(`/api/wordpress/diagnose/history?siteUrl=${encodeURIComponent(selectedSite)}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": getCsrfToken()
        }
      });
      setHistory([]);
      setMessage("Session history cleared successfully.");
    } catch (err) {
      // Soft ignore
    }
  };

  return (
    <div className="space-y-8" id="wp-diagnose-wizard-tab">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Connection inputs & selectors */}
        <div className="lg:col-span-1 space-y-6">
          <div className={`p-6 rounded-2xl border transition duration-200 ${
            themeMode === "dark" 
              ? "bg-slate-900 border-slate-800 text-slate-100" 
              : "bg-white border-slate-200 text-slate-850 shadow-sm"
          }`}>
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-5 h-5 text-blue-550 dark:text-blue-400" />
              <h3 className={`font-extrabold text-base text-white font-display ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>Diagnostics Wizard</h3>
            </div>

            <form onSubmit={handleRunDiagnostics} className="space-y-4">
              <div>
                <label className={`block text-[10px] font-mono font-bold uppercase mb-2 ${themeMode === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  Select Channel
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition ${
                      themeMode === "dark" 
                        ? "bg-slate-950 border-slate-800 text-white" 
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    {sites.length === 0 && <option value="">-- No sites connected --</option>}
                    {sites.map((site) => (
                      <option key={site.id} value={site.url}>
                        {site.url}
                      </option>
                    ))}
                  </select>

                  <div className={`text-center text-xs py-1 ${themeMode === "dark" ? "text-slate-500" : "text-slate-400"}`}>OR check unlinked workspace:</div>
                  <input
                    type="url"
                    placeholder="https://testsite.com (Unlinked)"
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 transition shadow-none ${
                      themeMode === "dark" 
                        ? "bg-slate-950 border-slate-800 text-white" 
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  />
                </div>
              </div>

              <div className={`border-t pt-4 space-y-3.5 ${themeMode === "dark" ? "border-slate-800/80" : "border-slate-150"}`}>
                <p className={`text-[10px] font-mono font-bold uppercase ${themeMode === "dark" ? "text-slate-400" : "text-slate-500"}`}>Override Credentials (Optional)</p>
                <div>
                  <input
                    type="text"
                    value={customUsername}
                    placeholder="Wp admin username"
                    onChange={(e) => setCustomUsername(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 transition ${
                      themeMode === "dark" 
                        ? "bg-slate-950 border-slate-800 text-white" 
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  />
                </div>
                <div>
                  <input
                    type="password"
                    value={customPassword}
                    placeholder="Wp Application password override"
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 transition ${
                      themeMode === "dark" 
                        ? "bg-slate-950 border-slate-800 text-white" 
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  />
                </div>
              </div>

              <button
                id="run-diagnostics-btn"
                type="submit"
                disabled={isRunning || !selectedSite}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Probing endpoints...
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5" />
                    Trigger System Probes
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Live results showing remedies */}
        <div className="lg:col-span-2 space-y-6">
          {message && (
            <div className="p-4 bg-emerald-555/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 rounded-xl text-xs">
              {message}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 text-rose-600 dark:text-rose-350 border border-red-500/20 rounded-xl text-xs flex flex-col gap-2">
              <span className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />
                Connection Handshake Dropped / Blocks Encountered
              </span>
              <p>{error}</p>
              <div className={`mt-2 p-3 rounded-lg font-mono text-[10px] leading-relaxed border transition ${
                themeMode === "dark" 
                  ? "bg-slate-950 text-slate-400 border-slate-800" 
                  : "bg-slate-50 text-slate-600 border-slate-150"
              }`}>
                <p className="font-bold text-orange-500 uppercase">REMEDY RECOMMENDATIONS:</p>
                <p>1. Ensure WordPress Permalinks are configured to anything other than "Plain" (under Settings &gt; Permalinks).</p>
                <p className="mt-1">2. Verify that there is no active Cloudflare WAF, ModSecurity, Wordfence, or general nginx reverse proxy blocking custom authentication headers from outer cloud hosts.</p>
                <p className="mt-1">3. Install the WooCommerce plugin and verify that WooCommerce REST endpoints are responding.</p>
              </div>
            </div>
          )}

          {result && (
            <div className={`p-6 border rounded-2xl space-y-6 transition duration-200 ${
              themeMode === "dark" 
                ? "bg-slate-900 border-slate-800 text-slate-100" 
                : "bg-white border-slate-200 text-slate-850 shadow-sm"
            }`} id="diagnostic-results-card">
              <div className={`flex justify-between items-center border-b pb-4 ${themeMode === "dark" ? "border-slate-800" : "border-slate-100"}`}>
                <span className={`font-extrabold text-sm ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>Diagnostics Report: {result.siteUrl}</span>
                <span className="text-[10px] font-mono text-slate-400">Timestamp: {new Date(result.timestamp).toLocaleTimeString()}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.checklist.map((c: any, idx: number) => (
                  <div key={idx} className={`p-3.5 border rounded-xl flex items-start gap-3 transition ${
                    themeMode === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-150"
                  }`}>
                    {c.status === "PASS" ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : c.status === "WARN" ? (
                      <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 font-sans">
                      <p className={`font-bold text-xs leading-normal ${themeMode === "dark" ? "text-white" : "text-slate-800"}`}>{c.prerequisite}</p>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tighter">{c.description}</p>
                      {c.remedy && (
                        <p className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-955/20 p-1.5 rounded border border-amber-200 dark:border-amber-900 font-mono mt-1 leading-relaxed">
                          Fix: {c.remedy}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagnostics history logs */}
          <div className={`p-6 rounded-2xl border transition duration-200 ${
            themeMode === "dark" 
              ? "bg-slate-900 border-slate-800 text-slate-100" 
              : "bg-white border-slate-200 text-slate-850 shadow-sm"
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h4 className={`font-bold text-sm flex items-center gap-2 ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>
                <Server className="w-4 h-4 text-blue-550 dark:text-blue-400" />
                Historic Scans ({history.length})
              </h4>
              {history.length > 0 && (
                <button
                  id="clear-diagnostics-history"
                  onClick={clearHistory}
                  className={`text-[10px] font-bold cursor-pointer transition border px-2.5 py-1 rounded-lg ${
                    themeMode === "dark" 
                      ? "border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950" 
                      : "border-slate-200 text-slate-650 hover:text-slate-850 hover:bg-slate-50"
                  }`}
                >
                  Clear Log
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-400 font-mono py-4">No diagnostic history tracks logged for this site URL.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                {history.map((h: any, idx: number) => {
                  const itemsFailed = h.checklist.filter((i: any) => i.status === "FAIL").length;
                  return (
                    <div key={idx} className={`p-3 border rounded-xl flex justify-between items-center transition ${
                      themeMode === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-100"
                    }`}>
                      <div className="space-y-0.5 font-sans">
                        <p className={`text-[10px] font-mono ${themeMode === "dark" ? "text-slate-300" : "text-slate-700"}`}>Run: {new Date(h.timestamp).toLocaleString()}</p>
                        <p className="text-[9px] text-slate-400 font-mono">Prerequisites failure count: {itemsFailed}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono border ${
                        itemsFailed === 0 
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                          : "bg-red-500/10 text-rose-600 dark:text-rose-400 border-red-500/20"
                      }`}>
                        {itemsFailed === 0 ? "STABLE" : "UNSTABLE"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
