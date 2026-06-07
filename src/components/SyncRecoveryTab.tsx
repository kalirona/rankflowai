// src/components/SyncRecoveryTab.tsx

import React, { useState, useEffect } from "react";
import { 
  RefreshCw, AlertTriangle, Play, HelpCircle, Check, Database, 
  ListRestart, Eye, FileSpreadsheet, History, RotateCcw, X, Layers,
  Activity, ArrowLeftRight, Wrench, Copy, ChevronDown, ChevronUp,
  Terminal, ShieldAlert, BadgeCheck, ListPlus, Square, CheckSquare, ArrowRight,
  ClipboardCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getCsrfToken } from "../lib/csrf";

interface SyncRecoveryTabProps {
  sites?: any[];
  themeMode?: "light" | "dark";
}

interface ErrorMapping {
  title: string;
  guidance: string;
  checklist: string[];
  severity: "critical" | "warning" | "info";
}

const getErrorMapping = (status: number): ErrorMapping => {
  switch (status) {
    case 401:
      return {
        title: "401 Authentication Failure",
        guidance: "Application Password invalid",
        checklist: [
          "Case Sensitivity Check: WordPress usernames are case-sensitive on certain web servers. Confirm the casing matches.",
          "Regenerate Security Keys: Navigate to WP Admin -> Users -> Profile, and create a fresh Application Password without spaces.",
          "Proxy Stripping Isolation: Some caching reverse-proxies or server firewalls strip Basic Authorization headers. Verify server config overrides."
        ],
        severity: "critical"
      };
    case 403:
      return {
        title: "403 Access Forbidden",
        guidance: "Cloudflare or security plugin blocked request",
        checklist: [
          "Bypass Security Filters: Whitelist RankFlow IP blocks or query parameters inside security plugins like Wordfence, iThemes, Cerber, or Sucuri.",
          "Check Cloudflare WAF: Review Cloudflare Security Events to locate and whitelist any blocked requests to `/wp-json/wc/v3` or `/wp-json/wp/v2`.",
          "Check REST API Disabled: Confirm that the public WordPress REST API hasn't been completely disabled by optimization, maintenance, or security plugins."
        ],
        severity: "critical"
      };
    case 404:
      return {
        title: "404 Resource Not Found",
        guidance: "Post or product not found",
        checklist: [
          "Confirm Trash State: Verify if the product, post, or media item was trashed or permanently deleted inside WordPress admin pages.",
          "Re-align URL Permalinks: Open WP Settings -> Permalinks, and click 'Save Changes' to reconstruct your URL route rewrites.",
          "Endpoint Discrepancy: Check if you are syncing WooCommerce products on a basic blog site that only supports default posts."
        ],
        severity: "warning"
      };
    case 429:
      return {
        title: "429 Rate Limit Throttled",
        guidance: "Rate limit reached",
        checklist: [
          "Cooldown Queue Handshake: Pause synchronization requests for 3-5 minutes to let the remote site's rate filters decay.",
          "Modify Server Speed Limits: Ask your host's help desk to increase incoming request-per-hour allowances on the REST API gateway.",
          "Pause Parallel Tasks: Deactivate competitive batch exports, backups, or heavy crawlers executing on the site simultaneously."
        ],
        severity: "warning"
      };
    case 500:
      return {
        title: "500 Internal Server Error",
        guidance: "Remote server failure",
        checklist: [
          "PHP Memory Fatigue: Ensure that your WordPress `wp-config.php` has at least 256MB allocated via `define('WP_MEMORY_LIMIT', '256M');`.",
          "Inspect Server Error Logs: Consult the `wp-content/debug.log` file on your server to discover detailed PHP backtraces, fatal errors, or timeout triggers.",
          "Plugin Friction Triage: Deactivate all caching, minification, and database optimization plugins temporarily to isolate blocking write-locks."
        ],
        severity: "critical"
      };
    case 502:
      return {
        title: "502 Bad Gateway Connection",
        guidance: "Remote backend web server received an invalid, broken routing response.",
        checklist: [
          "Upstream Crash Check: Check if server processes (Nginx, Apache, or PHP-FPM) crashed or are in a restart loop.",
          "Reverse Proxy Adjustments: Verify server socket timeout rules inside the reverse proxy configs.",
          "Bypass Caching Proxy: Purge full static delivery caches on Cloudflare or public CDN nodes."
        ],
        severity: "critical"
      };
    case 503:
      return {
        title: "503 Service Temporarily Suspended",
        guidance: "Remote host is overloaded or down for active maintenance.",
        checklist: [
          "Resource Depletion Suspensions: Check with your hosting company if CPU limits, I/O rates, or request limits were exceeded.",
          "Remove Active Maintenance Files: Delete `.maintenance` lockfiles located in your WordPress root directory if a WP core update was aborted.",
          "Outbound Gateway Block: Ensure administrative firewalls on the hosting cloud are not blocking server-to-server routes."
        ],
        severity: "critical"
      };
    case 504:
      return {
        title: "504 Gateway Gateway Timeout",
        guidance: "The upstream gateway server took too long to complete.",
        checklist: [
          "Exceed Max Execution Limit: Elevate `max_execution_time` and `max_input_time` variables inside the PHP standard server configuration (`php.ini`).",
          "Identify Database Table Bloat: Clean up overhead or transients in `wp_options` or WooCommerce session tables that slow writes.",
          "Unload Large Image Uploads: Check if heavy product media processing causes server timeouts."
        ],
        severity: "warning"
      };
    default:
      return {
        title: `HTTP ${status || "Connection"} Error`,
        guidance: "The connection to WordPress was dropped or rejected.",
        checklist: [
          "Verify URL Scheme: Confirm that the Target Site URL is valid, securely absolute, and begins with the proper `https://` prefix.",
          "Inspect SSL Server Certificates: Ensure the target server possesses a fully validated, non-expired SSL security certificate.",
          "Diagnostic Handshake Test: Request a default public route `/wp-json/` directly through your browser to confirm active REST API operations."
        ],
        severity: "warning"
      };
  }
};

export default function SyncRecoveryTab({ sites = [], themeMode = "light" }: SyncRecoveryTabProps) {
  // Existing failure audit states
  const [failures, setFailures] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDetailsId, setActiveDetailsId] = useState<string | null>(null);

  // Diagnostics Drawer state
  const [activeDiagnostic, setActiveDiagnostic] = useState<any | null>(null);
  const [isDrawerRetrying, setIsDrawerRetrying] = useState(false);
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [isTechnicalDetailsExpanded, setIsTechnicalDetailsExpanded] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [checkedChecklistItems, setCheckedChecklistItems] = useState<Record<string, boolean>>({});

  // Restore points states
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [restorePoints, setRestorePoints] = useState<any[]>([]);
  const [isPointsLoading, setIsPointsLoading] = useState(false);
  const [activeRestorePoint, setActiveRestorePoint] = useState<any | null>(null); // For Details modal
  const [confirmRestorePoint, setConfirmRestorePoint] = useState<any | null>(null); // For rollback confirmation modal
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string | null>(null);

  const loadRecoveryData = async () => {
    setIsLoading(true);
    try {
      const rf = await fetch("/api/sync/failures");
      if (rf.ok) {
        const data = await rf.json();
        setFailures(data);
      }
      const ra = await fetch("/api/sync/audits");
      if (ra.ok) {
        const data = await ra.json();
        setAudits(data);
      }
    } catch (err) {
      setError("Failed to fetch WooCommerce sync recovery logs.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadRestorePoints = async (siteId: string) => {
    if (!siteId) return;
    setIsPointsLoading(true);
    setRestoreErrorMsg(null);
    try {
      const res = await fetch(`/api/restore-points/site/${siteId}`);
      if (res.ok) {
        const data = await res.json();
        setRestorePoints(data.restorePoints || []);
      } else {
        const data = await res.json();
        setRestoreErrorMsg(data.error || "Failed to load restore points.");
      }
    } catch (err: any) {
      setRestoreErrorMsg(err.message || "Error fetching restore points.");
    } finally {
      setIsPointsLoading(false);
    }
  };

  useEffect(() => {
    loadRecoveryData();
  }, []);

  useEffect(() => {
    if (sites && sites.length > 0) {
      // default select the first site if none selected yet
      if (!selectedSiteId) {
        setSelectedSiteId(sites[0].id);
        loadRestorePoints(sites[0].id);
      } else {
        loadRestorePoints(selectedSiteId);
      }
    }
  }, [sites, selectedSiteId]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRetrySelected = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setIsRetrying(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/sync/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken(),
        },
        body: JSON.stringify({ productIds: selectedIds }),
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || "Failed to submit retry operations.");
      }

      const results = res.results || [];
      const successes = results.filter((r: any) => r.success).length;
      const failuresCount = results.filter((r: any) => !r.success).length;

      setMessage(`Completed: ${successes} items recovered successfully. ${failuresCount} items failed retry handshake.`);
      setSelectedIds([]);
      await loadRecoveryData();
    } catch (err: any) {
      setError(err.message || "Failed to connect to bulk synchronization service.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRetryAll = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsRetrying(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/sync/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken(),
        },
        body: JSON.stringify({ retryAllFailed: true }),
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || "Failed to submit retry operations.");
      }

      const results = res.results || [];
      const successes = results.filter((r: any) => r.success).length;
      const failuresCount = results.filter((r: any) => !r.success).length;

      setMessage(`Sync bulk retry completed. Recovered: ${successes}, Unresolved: ${failuresCount}`);
      setSelectedIds([]);
      await loadRecoveryData();
    } catch (err: any) {
      setError(err.message || "Failed to connect to bulk recovery queues.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handlePerformRestore = async () => {
    if (!confirmRestorePoint) return;
    setIsRestoring(true);
    setRestoreSuccessMsg(null);
    setRestoreErrorMsg(null);

    try {
      const response = await fetch(`/api/restore-points/${confirmRestorePoint.id}/restore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "WordPress refused rollback REST update transaction.");
      }

      setRestoreSuccessMsg(`Rollback successfully completed! Reverted WordPress content of resource #${confirmRestorePoint.resourceId} to Snapshot state captured on ${new Date(confirmRestorePoint.timestamp).toLocaleString()}`);
      setConfirmRestorePoint(null);
      await loadRestorePoints(selectedSiteId);
      
      // refresh global sync failure audit logs
      const ra = await fetch("/api/sync/audits");
      if (ra.ok) {
        const auditData = await ra.json();
        setAudits(auditData);
      }
    } catch (err: any) {
      setRestoreErrorMsg(err.message || "Failed to execute WordPress rollback.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSingleRetry = async (productId: string) => {
    setIsDrawerRetrying(true);
    setDrawerMessage(null);
    setDrawerError(null);
    try {
      const response = await fetch("/api/sync/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken(),
        },
        body: JSON.stringify({ productIds: [productId] }),
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || "Failed to submit retry operations.");
      }

      const results = res.results || [];
      const productResult = results.find((r: any) => r.productId === productId);
      const success = productResult ? productResult.success : false;
      const errorText = productResult ? productResult.error : "Failed retry handshake.";

      if (success) {
        setDrawerMessage("Synchronization successfully completed! Remote site synchronized clean check.");
        setCheckedChecklistItems({});
        await loadRecoveryData();
        setTimeout(() => {
          setActiveDiagnostic(null);
          setDrawerMessage(null);
        }, 2200);
      } else {
        throw new Error(errorText || "Remote site refused connection rollback or sync operation.");
      }
    } catch (err: any) {
      setDrawerError(err.message || "Failed to connect to bulk synchronization service.");
    } finally {
      setIsDrawerRetrying(false);
    }
  };

  const handleCopyDiagnosticReport = (f: any) => {
    const errorMapping = getErrorMapping(f.httpCode || f.httpStatus || 500);
    const report = `### RankFlow AI Connection Diagnostic Report
- **Product Name**: ${f.productName}
- **Product ID**: ${f.productId}
- **WordPress Target Site**: ${f.siteUrl}
- **HTTP Status Code**: ${f.httpCode || f.httpStatus || "N/A"}
- **Timestamp**: ${new Date(f.timestamp || new Date()).toLocaleString()}

### Identification & Guidance
- **Issue Category**: ${errorMapping.title}
- **Diagnostic Guidance**: ${errorMapping.guidance}

### Recommended Action Items
${errorMapping.checklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}

### Technical Trace Logs & Response Payload
\`\`\`json
${JSON.stringify(f.payload || f.wpErrorResponse || { error: f.errorMessage || f.failureReason }, null, 2)}
\`\`\`

---
*Report compiled automatically on ${new Date().toLocaleString()} by RankFlow AI Smart Sync Diagnostics.*`;

    navigator.clipboard.writeText(report).then(() => {
      setCopiedStates((prev) => ({ ...prev, [f.productId]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [f.productId]: false }));
      }, 2000);
    }).catch(err => {
      console.error("Failed to copy report to clipboard:", err);
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-650 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8" id="sync-recovery-center-tab">
      
      {/* 1. Failed Sync Recovery Module */}
      <div className={`p-6 md:p-8 rounded-2xl border transition duration-200 ${
        themeMode === "dark" 
          ? "bg-slate-900 border-slate-800 text-slate-100" 
          : "bg-white border-slate-200 text-slate-850 shadow-sm"
      }`}>
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 mb-6 ${
          themeMode === "dark" ? "border-slate-800/80" : "border-slate-150"
        }`}>
          <div>
            <h3 className={`font-extrabold text-lg font-display flex items-center gap-2 ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>
              <Activity className="w-5 h-5 text-red-500 animate-pulse" />
              Failed Sync Recovery Center
            </h3>
            <p className="text-xs text-slate-400 mt-1">Review pending or failed synchronization requests, analyze error stack-dumps, and execute retries.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="retry-selected-btn"
              onClick={handleRetrySelected}
              disabled={isRetrying || selectedIds.length === 0}
              className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Retry Selected ({selectedIds.length})
            </button>

            <button
              id="retry-all-failed-btn"
              onClick={handleRetryAll}
              disabled={isRetrying || failures.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
            >
              <ListRestart className="w-4 h-4" />
              Power Bulk Retry All ({failures.length})
            </button>
          </div>
        </div>

        {message && (
          <div className="p-4 bg-emerald-950/40 text-emerald-300 border border-emerald-900 rounded-xl text-xs mb-6">
            {message}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-955/20 text-rose-300 border border-red-900 rounded-xl text-xs mb-6 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {failures.length === 0 ? (
          <div className="text-center py-12 border border-slate-800 border-dashed rounded-2xl bg-slate-950/20">
            <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3 p-2 bg-emerald-950 rounded-full border border-emerald-900" />
            <p className="text-sm font-bold text-slate-300">WooCommerce Channels are 110% Synced</p>
            <p className="text-xs text-slate-500 mt-1">No active synchronization issues or queue blocks detected.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300 bg-slate-950">
              <thead className="bg-[#0b0f19] text-slate-400 font-mono font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === failures.length && failures.length > 0}
                      onChange={() => {
                        if (selectedIds.length === failures.length) {
                          setSelectedIds([]);
                        } else {
                          setSelectedIds(failures.map((f) => f.productId));
                        }
                      }}
                      className="w-3.5 h-3.5 text-blue-600 border-slate-700 rounded bg-slate-950"
                    />
                  </th>
                  <th className="py-3 px-4">Product details</th>
                  <th className="py-3 px-4">Remote site URL</th>
                  <th className="py-3 px-4 text-center">Code</th>
                  <th className="py-3 px-4">Fail description</th>
                  <th className="py-3 px-4 text-center">Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {failures.map((f) => (
                  <React.Fragment key={f.productId}>
                    <tr className="hover:bg-slate-900/60 transition">
                      <td className="py-3.5 px-4 text-center">
                        <input
                          id={`fail-select-box-${f.productId}`}
                          type="checkbox"
                          checked={selectedIds.includes(f.productId)}
                          onChange={() => toggleSelect(f.productId)}
                          className="w-3.5 h-3.5 text-blue-600 border-slate-700 rounded bg-slate-950"
                        />
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white max-w-xs truncate">{f.productName}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[10px] truncate">{f.siteUrl}</td>
                      <td className="py-3.5 px-4 text-center font-mono text-rose-500 font-bold">{f.httpCode}</td>
                      <td className="py-3.5 px-4 max-w-sm truncate text-slate-400 font-sans">{f.errorMessage}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          id={`inspect-failure-btn-${f.productId}`}
                          onClick={() => {
                            setActiveDiagnostic(f);
                            setDrawerMessage(null);
                            setDrawerError(null);
                            setIsTechnicalDetailsExpanded(false);
                            setActiveDetailsId(activeDetailsId === f.productId ? null : f.productId);
                          }}
                          className="p-1 px-2.5 bg-blue-600/10 border border-blue-500/20 hover:border-blue-500 hover:text-white rounded text-[10px] font-bold text-blue-400 cursor-pointer transition flex items-center gap-1 mx-auto"
                        >
                          <Wrench className="w-3 h-3 text-blue-400" />
                          Diagnose 🩺
                        </button>
                      </td>
                    </tr>

                    {/* Stack trace subview drawer */}
                    {activeDetailsId === f.productId && (
                      <tr>
                        <td colSpan={6} className="bg-[#0c101d] p-4 border-y border-red-950/30">
                          <div className="space-y-2">
                            <p className="text-[10px] font-mono text-rose-450 uppercase tracking-wider font-bold">Trace Payload Dump:</p>
                            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[9px] text-slate-400 font-mono overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                              {JSON.stringify(f.payload || { error: f.errorMessage }, null, 2)}
                            </pre>
                            <div className="p-2 bg-amber-950/20 text-orange-300 border border-amber-900/40 rounded-lg text-[9px] font-mono leading-relaxed mt-1">
                              <strong>TROUBLESHOOT:</strong> WooCommerce says <code>{f.httpCode}</code>. Confirm REST Client credentials, check permalink tags config, or verify user administrative privileges on target WordPress hosting.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Pre-Sync Restore Points Module (The Reversible Engine) */}
      <div className={`p-6 md:p-8 rounded-2xl border transition duration-200 ${
        themeMode === "dark" 
          ? "bg-slate-900 border-slate-800 text-slate-100" 
          : "bg-white border-slate-200 text-slate-850 shadow-sm"
      }`} id="pre-sync-restore-points">
        <div className={`pb-5 mb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b ${
          themeMode === "dark" ? "border-slate-800" : "border-slate-150"
        }`}>
          <div>
            <h3 className={`font-extrabold text-lg font-display flex items-center gap-2 ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>
              <History className="w-5 h-5 text-blue-550 dark:text-blue-400" />
              Pre-Sync Restore Points (Idempotent Rollback System)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Every synchronization transaction records a lossless rollback checkpoint. Instantly fallback to preceding content without consuming credits.
            </p>
          </div>

          {sites.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Workspace Instance:</span>
              <select
                id="site-restore-dropdown"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.url.replace(/^https?:\/\//i, "")}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {restoreSuccessMsg && (
          <div className="p-4 bg-emerald-950/40 text-emerald-300 border border-emerald-900 rounded-xl text-xs mb-6">
            {restoreSuccessMsg}
          </div>
        )}

        {restoreErrorMsg && (
          <div className="p-4 bg-[#230d14] text-rose-300 border border-[#4c121e] rounded-xl text-xs mb-6">
            {restoreErrorMsg}
          </div>
        )}

        {isPointsLoading ? (
          <div className="text-center py-10">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-mono">Loading restore points ledger...</p>
          </div>
        ) : restorePoints.length === 0 ? (
          <div className="text-center py-12 border border-slate-800 border-dashed rounded-2xl bg-slate-950/10">
            <Layers className="w-10 h-10 text-slate-650 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-350">No Restore Points Exist Yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Checkpoints are created automatically whenever you sync optimization content to your site.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs bg-slate-950">
              <thead className="bg-[#0b0f19] text-slate-400 font-mono font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Created Checkpoint</th>
                  <th className="py-3 px-4 text-center">Remote ID</th>
                  <th className="py-3 px-4">Title Snapshot</th>
                  <th className="py-3 px-4 text-center">Inspect Fields</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {restorePoints.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {new Date(p.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-blue-400">
                      #{p.resourceId}
                    </td>
                    <td className="py-3 px-4 font-bold text-white max-w-xs truncate">
                      {p.title}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setActiveRestorePoint(p)}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-800 rounded transition cursor-pointer"
                      >
                        Peek Snapshot
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setConfirmRestorePoint(p)}
                        className="px-3 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Rollback
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Sync Audit Ledger */}
      <div className={`p-6 md:p-8 rounded-2xl border transition duration-200 ${
        themeMode === "dark" 
          ? "bg-slate-900 border-slate-800 text-slate-100" 
          : "bg-white border-slate-200 text-slate-850 shadow-sm"
      }`}>
        <h3 className={`font-extrabold text-base font-display mb-4 flex items-center gap-2 ${themeMode === "dark" ? "text-white" : "text-slate-900"}`}>
          <FileSpreadsheet className="w-4 h-4 text-blue-550 dark:text-blue-400" />
          Synchronization Connection Audit Logs ({audits.length})
        </h3>
        
        {audits.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono py-4">No active synchronization connection events captured in local buffer.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {audits.slice(0, 40).map((a, idx) => (
              <div key={idx} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3">
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 mt-0.5 uppercase ${
                  a.actionType.includes("SUCCESS") || a.actionType.includes("ROLLBACK_SUCCESS")
                    ? "bg-emerald-950 text-emerald-450 border border-emerald-900" 
                    : a.actionType.includes("START") || a.actionType.includes("ATTEMPT")
                    ? "bg-slate-900 text-blue-400 border border-slate-800"
                    : "bg-[#2d0f16] text-rose-400 border border-[#5a1c29]"
                }`}>
                  {a.actionType}
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">{a.productName}</p>
                  <p className="text-[10px] text-slate-400 leading-normal font-sans">{a.message}</p>
                  <p className="text-[9px] text-slate-500 font-mono">{a.siteUrl} • {new Date(a.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: Snapshot Data Peeker */}
      {activeRestorePoint && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setActiveRestorePoint(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h4 className="text-lg font-bold text-white font-display">Captured Pre-Sync Parameters</h4>
              <p className="text-xs text-slate-500 mt-1 font-mono">Snapshot UUID {activeRestorePoint.id} • {new Date(activeRestorePoint.timestamp).toLocaleString()}</p>
            </div>

            <div className="space-y-3.5 divide-y divide-slate-800/65">
              <div className="pt-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Snapshot Title</span>
                <p className="text-sm font-semibold text-white mt-1">{activeRestorePoint.title}</p>
              </div>

              {activeRestorePoint.description && (
                <div className="pt-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Short Description Excerpt</span>
                  <p className="text-xs text-slate-350 mt-1 leading-relaxed bg-[#0c101d] p-3 border border-slate-800 rounded-xl max-h-24 overflow-y-auto whitespace-pre-wrap">{activeRestorePoint.description}</p>
                </div>
              )}

              {activeRestorePoint.content && (
                <div className="pt-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Raw Content / Main Body</span>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed bg-[#0c101d] p-3 border border-slate-800 rounded-xl h-44 overflow-y-auto whitespace-pre-wrap">{activeRestorePoint.content}</p>
                </div>
              )}

              <div className="pt-3 flex gap-4">
                <div className="flex-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Yoast / RankMath Schema Meta</span>
                  <pre className="p-3 bg-slate-900 text-[10px] rounded-lg mt-1 font-mono text-blue-300 max-h-36 overflow-y-auto">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(activeRestorePoint.metaFields), null, 2);
                      } catch {
                        return activeRestorePoint.metaFields || "[]";
                      }
                    })()}
                  </pre>
                </div>

                <div className="flex-grow flex-shrink w-1/3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Attached Images Mapping</span>
                  <pre className="p-3 bg-slate-900 text-[10px] rounded-lg mt-1 font-mono text-teal-300 max-h-36 overflow-y-auto">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(activeRestorePoint.images), null, 2);
                      } catch {
                        return activeRestorePoint.images || "[]";
                      }
                    })()}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => {
                  setConfirmRestorePoint(activeRestorePoint);
                  setActiveRestorePoint(null);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Trigger Rollback Revert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: Rollback Action Warning */}
      {confirmRestorePoint && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 text-center relative">
            <button
              onClick={() => setConfirmRestorePoint(null)}
              className="absolute top-4 right-4 p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-white transition cursor-pointer border border-transparent hover:border-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mx-auto w-12 h-12 bg-amber-950/40 border border-amber-800 rounded-full flex items-center justify-center text-amber-500 mb-2">
              <ArrowLeftRight className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-white font-display">Confirm Idempotent Revert?</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans px-2">
                This transaction will securely rewrite current parameters of remote product <strong>#{confirmRestorePoint.resourceId}</strong> back on WordPress with values from checkpoint snapshot {new Date(confirmRestorePoint.timestamp).toLocaleString()}.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1.5 text-left text-xs">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Account Sync Credits:</span>
                <span className="text-emerald-400 font-bold">Unused - Zero Fee</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Idempotent Execution:</span>
                <span className="text-blue-400 font-bold">Guaranteed Indefinitely</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800 pt-1.5 mt-1">
                <span>WordPress Safe Overwrite:</span>
                <span className="text-teal-400">Read Failure Shield Active</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setConfirmRestorePoint(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 rounded-xl text-xs font-bold text-slate-400 transition cursor-pointer"
              >
                Abort Revert
              </button>
              
              <button
                onClick={handlePerformRestore}
                disabled={isRestoring}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1.5 justify-center min-w-44"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Executing Restores...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Confirm Idempotent Revert
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PREMIUM DIAGNOSTIC DRAWER (Smart Sync Diagnostics Hub) */}
      <AnimatePresence>
        {activeDiagnostic && (
          <div className="fixed inset-0 z-50 overflow-hidden" id="diagnostic-drawer-wrapper">
            {/* Backdrop with custom fade effect */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xs cursor-pointer"
              onClick={() => {
                if (!isDrawerRetrying) {
                  setActiveDiagnostic(null);
                }
              }}
            />

            {/* Slide-over Drawer card */}
            <div className="absolute inset-y-0 right-0 max-w-md md:max-w-xl w-full flex">
              <motion.div
                initial={{ transform: "translateX(100%)" }}
                animate={{ transform: "translateX(0%)" }}
                exit={{ transform: "translateX(100%)" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-slate-950 border-l border-slate-800 h-full w-full flex flex-col shadow-2xl overflow-y-auto"
                id="smart-diagnostic-drawer"
              >
                {/* Drawer Header */}
                <div className="p-5 border-b border-slate-800 bg-[#0c101d] flex justify-between items-center sticky top-0 z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
                      <Wrench className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white font-display font-sans">Smart Sync Diagnostics</h4>
                      <p className="text-[10px] text-slate-400 font-mono">Triage, Resolve & Force Handshake</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveDiagnostic(null)}
                    disabled={isDrawerRetrying}
                    className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded text-xs gap-1 flex items-center transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Close
                  </button>
                </div>

                {/* Drawer Contents */}
                <div className="p-6 space-y-6 flex-1">
                  
                  {/* General context */}
                  <div className="p-4 bg-slate-900 border border-slate-800/80 rounded-2xl space-y-3">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold block">Target WooCommerce Product Parameters</span>
                    <div className="space-y-1">
                      <h5 className="text-white font-extrabold text-sm font-display leading-tight">{activeDiagnostic.productName}</h5>
                      <p className="text-[10px] text-blue-400 font-mono">Product ID: #{activeDiagnostic.productId}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10.5px]">
                      <span className="text-slate-400 font-mono">Remote URL:</span>
                      <a href={activeDiagnostic.siteUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-slate-300 hover:text-blue-400 transition underline truncate max-w-[200px]">
                        {activeDiagnostic.siteUrl.replace(/^https?:\/\//i, "")}
                      </a>
                    </div>
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="text-slate-400 font-mono">Captured Stamp:</span>
                      <span className="font-mono text-slate-400">{new Date(activeDiagnostic.timestamp || new Date()).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Diagnostic Warning Alert */}
                  {(() => {
                    const status = activeDiagnostic.httpCode || activeDiagnostic.httpStatus || 500;
                    const mapping = getErrorMapping(status);
                    const severityColors = 
                      mapping.severity === "critical" 
                        ? "bg-rose-950/20 border-rose-900/40 text-rose-350"
                        : "bg-amber-950/20 border-amber-900/40 text-amber-350";
                    
                    return (
                      <div className={`p-4 border rounded-2xl space-y-2.5 ${severityColors}`}>
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span className="font-mono font-extrabold text-[11px] uppercase tracking-wider">{mapping.title}</span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold leading-normal text-white">
                            "{mapping.guidance}"
                          </p>
                          <p className="text-[10.5px] opacity-90 leading-relaxed font-sans">
                            RankFlow diagnostic analyzer identified structural blocks preventing API writes on this route. Resolve utilizing the physical checklist below.
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleCopyDiagnosticReport(activeDiagnostic)}
                      className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 hover:text-white text-slate-350 border border-slate-800 hover:border-slate-700/85 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      id="copy-diagnostic-report-btn"
                    >
                      {copiedStates[activeDiagnostic.productId] ? (
                        <>
                          <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                          <span className="text-emerald-400">Diagnostic Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Diagnostic Report
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleSingleRetry(activeDiagnostic.productId)}
                      disabled={isDrawerRetrying}
                      className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/20 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      id="drawer-retry-action-btn"
                    >
                      {isDrawerRetrying ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Sync Handshaking...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          Retry Reset Update
                        </>
                      )}
                    </button>
                  </div>

                  {drawerMessage && (
                    <div className="p-3.5 bg-emerald-950/40 text-emerald-300 border border-emerald-900 rounded-xl text-xs font-medium" id="drawer-success-alert">
                      {drawerMessage}
                    </div>
                  )}

                  {drawerError && (
                    <div className="p-3.5 bg-[#230d14] text-rose-300 border border-[#4c121e] rounded-xl text-xs font-medium" id="drawer-error-alert">
                      {drawerError}
                    </div>
                  )}

                  {/* Recommended Action Checklist */}
                  {(() => {
                    const status = activeDiagnostic.httpCode || activeDiagnostic.httpStatus || 500;
                    const mapping = getErrorMapping(status);
                    const itemsForThisProduct = Object.keys(checkedChecklistItems).filter(k => k.startsWith(`${activeDiagnostic.productId}-`));
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Recommended Triage Steps</span>
                          <span className="text-[9px] py-0.5 px-1.5 bg-slate-900 rounded text-slate-400 font-mono font-bold">
                            {itemsForThisProduct.length} / {mapping.checklist.length} Done
                          </span>
                        </div>
                        <div className="space-y-2">
                          {mapping.checklist.map((item, index) => {
                            const itemKey = `${activeDiagnostic.productId}-${index}`;
                            const isChecked = !!checkedChecklistItems[itemKey];
                            return (
                              <div
                                key={index}
                                onClick={() => setCheckedChecklistItems(prev => ({ ...prev, [itemKey]: !isChecked }))}
                                className={`p-3 bg-slate-950 border rounded-xl flex items-start gap-2.5 cursor-pointer select-none transition ${
                                  isChecked 
                                    ? "border-emerald-600/30 bg-emerald-950/20 text-slate-350" 
                                    : "border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white"
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                                )}
                                <div className="space-y-0.5">
                                  <span className="text-[11px] font-bold text-slate-400 block">Step {index + 1}</span>
                                  <p className="text-[11px] leading-normal font-sans text-slate-300">{item}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Technical details accordion */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                    <button
                      onClick={() => setIsTechnicalDetailsExpanded(!isTechnicalDetailsExpanded)}
                      className="w-full p-4 flex justify-between items-center hover:bg-slate-900 transition text-left cursor-pointer"
                      id="diagnostic-technical-details-accordion-trigger"
                    >
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-300">
                        <Terminal className="w-4 h-4 text-slate-500" />
                        <span>Technical Payload Trace Logs</span>
                      </div>
                      {isTechnicalDetailsExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isTechnicalDetailsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-800 overflow-hidden"
                        >
                          <div className="p-4 space-y-2.5">
                            <pre className="p-3 bg-[#07090f] text-[10px] text-slate-400 font-mono rounded-lg overflow-x-auto leading-relaxed max-h-48 border border-slate-900 whitespace-pre-wrap">
                              {JSON.stringify(
                                activeDiagnostic.payload || 
                                activeDiagnostic.wpErrorResponse || 
                                { error: activeDiagnostic.errorMessage || activeDiagnostic.failureReason }, 
                                null, 
                                2
                              )}
                            </pre>
                            <span className="text-[9px] font-mono text-slate-500 block leading-tight">
                              *Payload captures the direct remote response parameters generated by WooCommerce / REST API servers during failure handshake.
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Sync Failure History timeline */}
                  {(() => {
                    // Filter audits to trace this product or site-wide sync issues
                    const productHistory = audits.filter(a => a.productId === activeDiagnostic.productId);
                    const siteHistory = audits.filter(a => a.siteUrl === activeDiagnostic.siteUrl && a.productId !== activeDiagnostic.productId);
                    
                    return (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Sync Failure History</span>
                          <span className="text-[9px] font-mono text-slate-400 block font-bold">Product Audits ({productHistory.length})</span>
                        </div>

                        {productHistory.length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-[#07090f] text-center text-[10.5px] text-slate-500">
                            No auxiliary connection items logged for product #{activeDiagnostic.productId}.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {productHistory.map((h, idx) => {
                              const isSuccess = h.actionType.includes("SUCCESS") || h.actionType.includes("ROLLBACK_SUCCESS");
                              const isProcess = h.actionType.includes("START") || h.actionType.includes("ATTEMPT");
                              const statusColor = isSuccess 
                                ? "bg-emerald-950/80 text-emerald-400 border-emerald-900" 
                                : isProcess
                                ? "bg-blue-950/80 text-blue-400 border-blue-900"
                                : "bg-rose-950/80 text-rose-400 border-rose-900";
                              
                              return (
                                <div key={h.id || idx} className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl flex items-start gap-2.5 text-[11px] leading-normal">
                                  <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-extrabold shrink-0 border mt-0.5 ${statusColor}`}>
                                    {h.actionType}
                                  </span>
                                  <div className="space-y-0.5">
                                    <p className="text-slate-350 font-sans">{h.message}</p>
                                    <span className="text-[9px] text-slate-500 font-mono tracking-wider">
                                      {new Date(h.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {siteHistory.length > 0 && (
                          <div className="pt-2">
                            <span className="text-[9.5px] font-mono text-slate-500 font-bold block mb-2">OTHER ACTIVE SITE ERRORS ON ROUTE ({siteHistory.slice(0, 3).length})</span>
                            <div className="space-y-2 opacity-65 hover:opacity-100 transition">
                              {siteHistory.slice(0, 3).map((h, idx) => (
                                <div key={idx} className="p-2.5 bg-[#0a0d17] border border-slate-900 rounded-lg flex items-start justify-between text-[10px] text-slate-400 gap-2">
                                  <span className="font-bold text-slate-300 truncate max-w-[150px]">{h.productName}</span>
                                  <span className="text-rose-400 font-mono text-[9px] tracking-tight">{h.message.substring(0, 35)}...</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
