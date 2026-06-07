import React, { useState, useEffect } from "react";
import { 
  Globe, Database, Shield, Zap, RefreshCw, KeyRound, 
  Trash2, Plus, Calendar, AlertTriangle, CheckCircle, 
  User as UserIcon, LogOut, Terminal, Layers, Moon, Sun, ShoppingCart,
  Sparkles, UploadCloud, Eye, Check, Image, Brain, Activity
} from "lucide-react";
import { getCsrfToken } from "../lib/csrf";
import AiSettingsTab from "./AiSettingsTab";
import WpDiagnosticsTab from "./WpDiagnosticsTab";
import SyncRecoveryTab from "./SyncRecoveryTab";
import CreditLedgerTab from "./CreditLedgerTab";

interface DashboardViewProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

export default function DashboardView({ user, onLogout }: DashboardViewProps) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Connection Form State
  const [url, setUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [hasWooCommerce, setHasWooCommerce] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<"wordpress" | "woocommerce" | "shopify" | "wix" | "custom">("wordpress");
  const [connectionReport, setConnectionReport] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Upgrade Plan State
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  
  // Audio or Visual Feedback
  const [themeMode, setThemeMode] = useState<"dark" | "light">("light");
  
  // Sidebar Navigation Current Tab Filter state
  const [activeTab, setActiveTab] = useState<"overview" | "sites" | "billing" | "logs" | "products" | "ai-settings" | "diagnostics" | "recovery" | "ledger">("overview");

  // Premium Product Operations State
  const [productsList, setProductsList] = useState<any[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [importingSiteId, setImportingSiteId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [optimizingProductId, setOptimizingProductId] = useState<string | null>(null);
  const [syncingProductId, setSyncingProductId] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [productMessage, setProductMessage] = useState<string | null>(null);

  // Bulk select states
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Preview / comparison / history modal details
  const [previewProduct, setPreviewProduct] = useState<any | null>(null);
  const [generationHistory, setGenerationHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Conflict Detection Resolution State
  const [conflictData, setConflictData] = useState<{
    productId: string;
    currentWpModifiedDate: string;
    localImportedDate: string;
    localModifiedDate: string;
    warningMessage: string;
  } | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  const handleBulkAccept = async () => {
    if (selectedProductIds.length === 0) return;
    setIsBulkProcessing(true);
    setProductError(null);
    setProductMessage(null);
    try {
      const response = await fetch("/api/products/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ productIds: selectedProductIds })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to bulk accept.");
      setProductMessage(data.message || `Accepted AI recommendations for selected products.`);
      setSelectedProductIds([]);
      await fetchProducts();
    } catch (err: any) {
      setProductError(err.message || "Bulk accept failed.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Are you sure you want to reject and revert AI generated SEO meta for the ${selectedProductIds.length} selected items?`)) {
      return;
    }
    setIsBulkProcessing(true);
    setProductError(null);
    setProductMessage(null);
    try {
      const response = await fetch("/api/products/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ productIds: selectedProductIds })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to bulk reject / revert.");
      setProductMessage(data.message || `Reverted/Cleared AI optimization drafts for chosen products.`);
      setSelectedProductIds([]);
      await fetchProducts();
    } catch (err: any) {
      setProductError(err.message || "Bulk reject failed.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleSingleAccept = async (productId: string) => {
    setProductError(null);
    setProductMessage(null);
    try {
      const response = await fetch("/api/products/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ productIds: [productId] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Accept failed.");
      setProductMessage(`Optimized changes committed for this product.`);
      setPreviewProduct(null);
      await fetchProducts();
    } catch (err: any) {
      setProductError(err.message || "Accept failed.");
    }
  };

  const handleSingleReject = async (productId: string) => {
    setProductError(null);
    setProductMessage(null);
    try {
      const response = await fetch("/api/products/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ productIds: [productId] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Reject failed.");
      setProductMessage(`AI drafts cleared successfully.`);
      setPreviewProduct(null);
      await fetchProducts();
    } catch (err: any) {
      setProductError(err.message || "Reject failed.");
    }
  };

  const fetchGenerationHistory = async (productId: string) => {
    setIsHistoryLoading(true);
    setGenerationHistory([]);
    try {
      const response = await fetch(`/api/products/history?productId=${productId}`);
      if (response.ok) {
        const data = await response.json();
        setGenerationHistory(data.history || []);
      }
    } catch (err) {
      console.error("Error loading SEO history list:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleOpenPreviewModal = async (product: any) => {
    setPreviewProduct(product);
    await fetchGenerationHistory(product.id);
  };

  const fetchProducts = async () => {
    setIsProductsLoading(true);
    setProductError(null);
    try {
      const response = await fetch("/api/products");
      if (response.ok) {
        const data = await response.json();
        setProductsList(data.products || []);
      } else {
        const data = await response.json();
        setProductError(data.error || "Failed to load products list.");
      }
    } catch (err: any) {
      setProductError(err.message || "Failed to query products database.");
    } finally {
      setIsProductsLoading(false);
    }
  };

  const fetchDashboard = async () => {
    setError(null);
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load dashboard data.");
      }
      const data = await response.json();
      setDashboardData(data);
    } catch (err: any) {
      setError(err.message || "Failed to parse dashboard properties.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimSandboxCredits = async () => {
    setProductMessage(null);
    setProductError(null);
    try {
      const response = await fetch("/api/billing/claim-sandbox", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to grant sandbox trial credits.");
      }
      setProductMessage(data.message || "Credits granted successfully!");
      // Dynamic state refresh
      await fetchDashboard();
    } catch (err: any) {
      setProductError(err.message || "Failed to process sandbox testing credits request.");
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (themeMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [themeMode]);

  useEffect(() => {
    if (activeTab === "products") {
      fetchProducts();
    }
    fetchDashboard();
  }, [activeTab]);

  const handleConnectSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectionError(null);
    setConnectionMessage(null);
    setConnectionReport(null);
    setIsConnecting(true);

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setConnectionError("Website URL must start with http:// or https://");
      setIsConnecting(false);
      return;
    }

    try {
      const response = await fetch("/api/sites/connect", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ url, wpUsername, wpAppPassword, hasWooCommerce, platform: selectedPlatform }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Connection handshake failed.");
      }

      setConnectionMessage(`Successfully verified and paired your ${selectedPlatform.toUpperCase()} gateway!`);
      if (data.connectionReport) {
        setConnectionReport(data.connectionReport);
      }
      
      // Clear inputs
      setUrl("");
      setWpUsername("");
      setWpAppPassword("");
      setHasWooCommerce(false);
      
      // Refresh context
      await fetchDashboard();
    } catch (err: any) {
      setConnectionError(err.message || "Credential handshake failed. Verify connection status.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm("Are you sure you want to disconnect this WordPress site from RankFlow AI? Sensitive keys will be deleted permanently.")) {
      return;
    }

    try {
      const response = await fetch(`/api/sites/${siteId}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": getCsrfToken()
        }
      });

      if (!response.ok) {
        throw new Error("Failed to unlink site.");
      }

      // Refresh context
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || "Error unlinking site.");
    }
  };

  const handleUpgradePlan = async (planId: string | null, packId: string | null = null, gateway = "stripe") => {
    setIsUpgrading(true);
    try {
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ planId, packId, gateway })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upgrade transaction failed.");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      alert(data.message || "Plan updated beautifully!");
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || "Subscription upgrade failed.");
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    try {
      const response = await fetch("/api/billing/portal");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Failed to load billing portal.");
    }
  };

  const handleImportProducts = async (siteId: string) => {
    if (!siteId) return;
    setIsImporting(true);
    setProductError(null);
    setProductMessage(null);
    try {
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ siteId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to trigger product fetch.");
      }
      setProductMessage(data.message || "Successfully imported products!");
      await fetchProducts();
      await fetchDashboard();
    } catch (err: any) {
      setProductError(err.message || "Endpoint connection failed.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleOptimizeProduct = async (productId: string) => {
    setOptimizingProductId(productId);
    setProductError(null);
    setProductMessage(null);
    try {
      const response = await fetch("/api/products/optimize", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ productId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Optimization handoff failed.");
      }
      setProductMessage(data.message || `AI SEO optimizer successfully configured titles, description, and Alt parameters.`);
      await fetchProducts();
      await fetchDashboard();
    } catch (err: any) {
      setProductError(err.message || "Failed to run optimization.");
    } finally {
      setOptimizingProductId(null);
    }
  };

  const handleSyncProduct = async (productId: string, force = false) => {
    setSyncingProductId(productId);
    setProductError(null);
    setProductMessage(null);
    try {
      if (!force) {
        // Run Conflict Detection before triggering write synchronization
        const conflictRes = await fetch(`/api/products/conflict?productId=${productId}`);
        const conflictJson = await conflictRes.json();
        
        if (conflictJson.success && conflictJson.conflictDetected) {
          setConflictData({
            productId,
            currentWpModifiedDate: conflictJson.currentWpModifiedDate,
            localImportedDate: conflictJson.localImportedDate,
            localModifiedDate: conflictJson.localModifiedDate,
            warningMessage: conflictJson.warningMessage
          });
          setShowConflictDialog(true);
          setSyncingProductId(null);
          return;
        }
      }

      // Proceed with direct sync write back
      const response = await fetch("/api/products/sync", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ productId, force })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Synchronization handoff failed.");
      }
      setProductMessage(data.message || "Product synchronized back to WordPress successfully!");
      setShowConflictDialog(false);
      setConflictData(null);
      await fetchProducts();
      await fetchDashboard();
    } catch (err: any) {
      setProductError(err.message || "Synchronization failure.");
    } finally {
      setSyncingProductId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]" id="dashboard-loader">
        <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
        <h3 className="mt-4 text-base font-semibold text-gray-700">Loading Command Center...</h3>
        <p className="text-sm text-gray-400 mt-1">Decrypting secure credential layers</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center" id="dashboard-error">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 font-display">System Synchronization Failure</h3>
        <p className="text-gray-500 mt-2 text-sm">{error}</p>
        <button 
          onClick={fetchDashboard} 
          className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition"
        >
          Retry Connection Handshake
        </button>
      </div>
    );
  }

  const { subscription, sites, activityLogs, stats } = dashboardData;

  return (
    <div className={`min-h-screen flex ${themeMode === "dark" ? "bg-[#090D1A] text-slate-100" : "bg-[#F8FAFC] text-slate-900"}`} id="dashboard-content">
      {/* 1. Left Sidebar - Desktop Layout */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0F172A] border-r border-[#1E293B] text-slate-300 h-screen fixed top-0 left-0 z-40 p-5 select-none font-sans justify-between">
        <div>
          {/* Logo Brand Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/20">
              R
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              RankFlow <span className="text-blue-400">AI</span>
            </span>
          </div>

          {/* Navigation Sidebar Options */}
          <nav className="space-y-1.5" id="sidebar-nav">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "overview"
                  ? "bg-[#1E293B] text-white"
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <Layers className="w-4 h-4 mr-3 hover:scale-110 transition" />
              System Overview
            </button>
            <button
              onClick={() => setActiveTab("sites")}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "sites"
                  ? "bg-[#1E293B] text-white"
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <Globe className="w-4 h-4 mr-3 hover:scale-110 transition" />
              Site Inventory
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "products"
                  ? "bg-[#1E293B] text-white"
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4 mr-3 text-amber-400 animate-pulse" />
              AI SEO Optimizer
            </button>
            <button
              onClick={() => setActiveTab("billing")}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "billing"
                  ? "bg-[#1E293B] text-white"
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <Zap className="w-4 h-4 mr-3 text-blue-400 hover:scale-110 transition" />
              SaaS Subscriptions
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "logs"
                  ? "bg-[#1E293B] text-white"
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <Shield className="w-4 h-4 mr-3 hover:scale-110 transition" />
              Security Audit
            </button>
            <button
              id="sidebar-ai-settings-btn"
              onClick={() => setActiveTab("ai-settings")}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "ai-settings"
                  ? "bg-[#1E293B] text-white"
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <Brain className="w-4 h-4 mr-3 text-cyan-400 hover:scale-110 transition" />
              AI Providers Config
            </button>
            <button
              id="sidebar-diagnostics-btn"
              onClick={() => setActiveTab("diagnostics")}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "diagnostics"
                  ? "bg-[#1E293B] text-white"
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <Activity className="w-4 h-4 mr-3 text-rose-400 hover:scale-110 transition" />
              WordPress Diagnostics
            </button>
            <button
              id="sidebar-recovery-btn"
              onClick={() => setActiveTab("recovery")}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "recovery"
                  ? "bg-[#1E293B] text-white"
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <RefreshCw className="w-4 h-4 mr-3 text-emerald-400 hover:scale-110 transition" />
              Sync Recovery Center
            </button>
            <button
              id="sidebar-ledger-btn"
              onClick={() => setActiveTab("ledger")}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-205 ${
                activeTab === "ledger"
                  ? "bg-[#1E293B] text-white"
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <Database className="w-4 h-4 mr-3 text-amber-500 hover:scale-110 transition" />
              Financial Credit Ledger
            </button>
          </nav>
        </div>

        {/* Sprint Status Panel at Bottom of sidebar */}
        <div className="p-4 bg-slate-800/80 border border-slate-700/50 rounded-xl">
          <p className="text-[10px] font-mono text-slate-400 mb-1 leading-none uppercase tracking-wider">Sprint 1 Status</p>
          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div className="bg-emerald-500 h-full" style={{ width: "100%" }}></div>
          </div>
          <p className="text-[10px] text-emerald-400 mt-2 font-mono flex items-center gap-1.5 justify-between">
            <span>Security Middleware</span>
            <span className="font-bold text-emerald-400">READY</span>
          </p>
        </div>
      </aside>

      {/* 2. Main Space Panel */}
      <div className="flex-1 min-h-screen flex flex-col md:pl-64 overflow-x-hidden">
        {/* Top Navbar Header */}
        <header className={`border-b ${themeMode === "dark" ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"} sticky top-0 z-50 backdrop-blur-md`}>
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 md:hidden">
                <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center font-bold text-white text-sm">
                  R
                </div>
                <span className="font-bold text-md tracking-tight font-display text-slate-900 dark:text-white">RankFlow <span className="text-blue-500">AI</span></span>
              </div>
              <div className="hidden md:flex flex-col">
                <h1 className="text-md font-bold text-slate-900 dark:text-white tracking-tight">System Architecture Console</h1>
                <p className="text-xs text-slate-400">Sprint 1: Authentication &amp; Database Foundation</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Mobile compact horizontal tab selectors - Scrollable for design parity */}
              <div className="md:hidden flex items-center gap-1 overflow-x-auto no-scrollbar py-1 px-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-[280px] xs:max-w-[340px] sm:max-w-md select-none">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-semibold tracking-tight transition ${activeTab === "overview" ? "bg-blue-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("sites")}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-semibold tracking-tight transition ${activeTab === "sites" ? "bg-blue-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                >
                  Sites
                </button>
                <button
                  onClick={() => setActiveTab("products")}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-semibold tracking-tight transition ${activeTab === "products" ? "bg-blue-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                >
                  AI SEO
                </button>
                <button
                  onClick={() => setActiveTab("billing")}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-semibold tracking-tight transition ${activeTab === "billing" ? "bg-blue-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                >
                  SaaS Plans
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-semibold tracking-tight transition ${activeTab === "logs" ? "bg-blue-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                >
                  Audit Logs
                </button>
                <button
                  onClick={() => setActiveTab("ai-settings")}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-semibold tracking-tight transition ${activeTab === "ai-settings" ? "bg-blue-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                >
                  AI Config
                </button>
                <button
                  onClick={() => setActiveTab("diagnostics")}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-semibold tracking-tight transition ${activeTab === "diagnostics" ? "bg-blue-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                >
                  WP Diags
                </button>
                <button
                  onClick={() => setActiveTab("recovery")}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-semibold tracking-tight transition ${activeTab === "recovery" ? "bg-blue-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                >
                  Recovery
                </button>
                <button
                  onClick={() => setActiveTab("ledger")}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-semibold tracking-tight transition ${activeTab === "ledger" ? "bg-blue-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                >
                  Ledger
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
                className={`p-2 rounded-xl border ${themeMode === "dark" ? "border-slate-800 hover:bg-slate-800 text-amber-400" : "border-slate-200 hover:bg-slate-100 text-blue-600"} transition`}
                title="Toggle Theme Preset"
              >
                {themeMode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Profile Brief */}
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
                <span className={`w-9 h-9 rounded-full ${themeMode === "dark" ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"} flex items-center justify-center font-bold text-sm`}>
                  {user.name ? user.name[0].toUpperCase() : "U"}
                </span>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold">{user.name || "SaaS Operator"}</p>
                  <p className="text-[10px] text-gray-400 font-mono tracking-tighter leading-none">{user.email}</p>
                </div>
                
                {/* Logout Trigger */}
                <button
                  onClick={onLogout}
                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-xl transition ml-2"
                  title="Disconnect from Command Center"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 w-full flex-1">
        
        {/* 2. Top Banner / Status Overview - System Overview Modules */}
        {activeTab === "overview" && (
          <>
            {subscription.creditsOwned < 30 && (
              <div className="p-6 rounded-2xl border border-amber-400/30 bg-amber-400/[0.03] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all animate-fadeIn" id="sandbox-credits-booster-banner">
                <div className="flex items-start gap-3.5">
                  <div className="p-2 bg-amber-400/10 text-amber-500 rounded-xl mt-0.5">
                    <Zap className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm tracking-tight text-amber-500 dark:text-amber-400 font-display">Sandbox Credit Wallet Empty / Low</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-300 leading-normal mt-1 max-w-2xl font-sans">
                      Your current fuel balance is <strong className="text-amber-500">{subscription.creditsOwned} credit(s)</strong>. Scanning WooCommerce catalogs and triggering automated AI optimizations requires 10 credits. Click the button to grant your profile 5,000 complimentary sandbox credits instantly!
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClaimSandboxCredits}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 dark:text-slate-900 font-bold rounded-xl text-xs transition duration-150 shadow-md shadow-amber-500/10 shrink-0 cursor-pointer self-start md:self-center"
                >
                  🚀 Claim 5,000 Free Credits
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"} flex items-start gap-4 transition-all duration-200 hover:shadow-md`}>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Connected Sites</span>
                  <span className="text-3xl font-extrabold font-display mt-2 block break-all text-slate-800 dark:text-white">{stats.totalSites}</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">WooCommerce active</span>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"} flex items-start gap-4 transition-all duration-200 hover:shadow-md`}>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                  <Zap className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">API Credits</span>
                  <span className="text-3xl font-extrabold font-display mt-2 block break-all text-blue-600 dark:text-blue-400">{subscription.creditsOwned} <span className="text-xs font-normal text-slate-400">cr</span></span>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">Used total: {stats.creditsUsed} cr</span>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"} flex items-start gap-4 transition-all duration-200 hover:shadow-md`}>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">SaaS Level</span>
                  <span className="text-lg font-extrabold mt-2 block font-display text-emerald-600 dark:text-emerald-400">{subscription.planName}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 block uppercase">Status: {subscription.status}</span>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"} flex items-start gap-4 transition-all duration-200 hover:shadow-md`}>
                <div className="p-3 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
                  <Layers className="w-5 h-5" style={{ color: "#a855f7" }} />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Audit Events</span>
                  <span className="text-3xl font-extrabold font-display mt-2 block break-all text-[#a855f7]">{activityLogs.length}</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">Compliance records verified</span>
                </div>
              </div>
            </div>

            {/* Dashboard Overview Jumbotron */}
            <div className={`p-6 md:p-8 rounded-2xl border ${themeMode === "dark" ? "bg-gradient-to-r from-slate-900/80 to-blue-950/60 border-slate-800" : "bg-gradient-to-r from-white to-blue-50/20 border-slate-200/60 shadow-sm"}`}>
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-widest text-blue-650 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg uppercase font-mono mb-4 border border-blue-100 dark:border-blue-900/40">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                  Active Enterprise Workspace Deployment
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight leading-none">
                  Welcome to RankFlow AI Command Center
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm leading-relaxed">
                  You are authorized in our secure sandboxed terminal. Go to the **Site Inventory** tab from the left sidebar to pair credentials with specialized encryption parameters. Pushes require active tokens synced to your account tier.
                </p>
                
                <div className="mt-6 flex flex-wrap gap-4">
                  <button
                    onClick={() => setActiveTab("sites")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    Configure Site Integrations ({sites.length} Active)
                  </button>
                  <button
                    onClick={() => setActiveTab("billing")}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-xs transition border border-slate-200/80 dark:border-slate-800 cursor-pointer"
                  >
                    Current Limit: {subscription.creditsOwned} Credits Balance
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 3. Central Workspace: WordPress Connection & Sites List */}
        {activeTab === "sites" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Multi-Platform Channel Connection panel */}
            <div className="lg:col-span-1 space-y-6">
              <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="p-2 bg-blue-600 text-white rounded-lg">
                    <Plus className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-base font-display">Pair Online Store</h3>
                </div>

                <div className="mb-5">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Select Store Platform
                  </label>
                  <div className="grid grid-cols-5 gap-1 select-none text-[10px]">
                    {[
                      { id: "wordpress", label: "WP" },
                      { id: "woocommerce", label: "Woo" },
                      { id: "shopify", label: "Shopify" },
                      { id: "wix", label: "Wix" },
                      { id: "custom", label: "Landing" }
                    ].map((plat) => (
                      <button
                        key={plat.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlatform(plat.id as any);
                          setHasWooCommerce(plat.id === "woocommerce");
                          setConnectionError(null);
                          setConnectionMessage(null);
                        }}
                        className={`py-2 px-0.5 rounded-xl border font-bold text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                          selectedPlatform === plat.id 
                            ? "border-blue-600 bg-blue-50/40 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/15" 
                            : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-55/65 dark:hover:bg-slate-850"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          plat.id === "wordpress" ? "bg-blue-500" :
                          plat.id === "woocommerce" ? "bg-purple-500" :
                          plat.id === "shopify" ? "bg-emerald-500" :
                          plat.id === "wix" ? "bg-slate-900 dark:bg-white" : "bg-slate-500"
                        }`} />
                        <span>{plat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {connectionError && (
                  <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 p-3.5 rounded-xl text-xs mb-4 border border-red-100 dark:border-red-950">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{connectionError}</span>
                  </div>
                )}

                {connectionMessage && (
                  <div className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 p-3.5 rounded-xl text-xs mb-4 border border-emerald-100 dark:border-emerald-950">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{connectionMessage}</span>
                  </div>
                )}

                <form onSubmit={handleConnectSite} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      {selectedPlatform === "shopify" ? "Shopify Shop Domain" :
                       selectedPlatform === "wix" ? "Wix Site Domain URL" :
                       selectedPlatform === "custom" ? "Target Landing Page URL" : "WordPress Base URL"}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Globe className="w-3.5 h-3.5" />
                      </span>
                      <input
                        id="wp-url-input"
                        type="url"
                        placeholder={
                          selectedPlatform === "shopify" ? "https://my-store.myshopify.com" :
                          selectedPlatform === "wix" ? "https://mycustomsite.wixsite.com" :
                          "https://mycoolsite.com"
                        }
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className={`w-full pl-9 pr-4 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/25 ${themeMode === "dark" ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-blue-500" : "bg-gray-50 border-gray-205 text-gray-900 focus:border-blue-650"}`}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      {selectedPlatform === "shopify" ? "API Key or Store Identity" :
                       selectedPlatform === "wix" ? "Wix Account Email or App ID" :
                       selectedPlatform === "woocommerce" ? "WooCommerce Consumer Key" :
                       selectedPlatform === "custom" ? "Admin Username" : "WordPress Username"}
                    </label>
                    <input
                      id="wp-username-input"
                      type="text"
                      placeholder={
                        selectedPlatform === "shopify" ? "store_api" :
                        selectedPlatform === "wix" ? "admin@mywixsite.com" :
                        selectedPlatform === "woocommerce" ? "ck_xxxxxxxxxxxxxxxxxxxxxx" :
                        "admin"
                      }
                      value={wpUsername}
                      onChange={(e) => setWpUsername(e.target.value)}
                      className={`w-full px-4 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/25 ${themeMode === "dark" ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-blue-500" : "bg-gray-50 border-gray-205 text-gray-900 focus:border-blue-650"}`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      {selectedPlatform === "shopify" ? "Admin API Access Token" :
                       selectedPlatform === "wix" ? "Wix API Access Key" :
                       selectedPlatform === "woocommerce" ? "WooCommerce Consumer Secret" :
                       selectedPlatform === "custom" ? "Access Keyword" : "Application Password"}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <KeyRound className="w-3.5 h-3.5" />
                      </span>
                      <input
                        id="wp-password-input"
                        type="password"
                        placeholder={
                          selectedPlatform === "shopify" ? "shpat_xxxxxxxxxxxxxxxxxxxx" :
                          selectedPlatform === "woocommerce" ? "cs_xxxxxxxxxxxxxxxxxxxx" :
                          "xxxx xxxx xxxx xxxx"
                        }
                        value={wpAppPassword}
                        onChange={(e) => setWpAppPassword(e.target.value)}
                        className={`w-full pl-9 pr-4 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/25 ${themeMode === "dark" ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-blue-500" : "bg-gray-50 border-gray-205 text-gray-900 focus:border-blue-650"}`}
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-405 mt-1 leading-[13px]">
                      {selectedPlatform === "shopify" && "Use your private Shopify Admin access token generated under 'Apps'."}
                      {selectedPlatform === "wix" && "Retrieved under the integrations panel inside your Wix Developer Suite."}
                      {selectedPlatform === "wordpress" && "Generate under Users -> Profile -> Application Passwords in WordPress."}
                      {selectedPlatform === "woocommerce" && "Authorize with read/write access key via WooCommerce > Settings."}
                      {selectedPlatform === "custom" && "Any password for secure metadata validation checks."}
                    </p>
                  </div>

                  {selectedPlatform === "wordpress" && (
                    <div className="flex items-center gap-3 py-1">
                      <input
                        id="wp-woo-toggle"
                        type="checkbox"
                        checked={hasWooCommerce}
                        onChange={(e) => setHasWooCommerce(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-slate-805 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="wp-woo-toggle" className="text-xs font-semibold select-none cursor-pointer text-slate-700 dark:text-slate-300">
                        Site includes WooCommerce Store
                      </label>
                    </div>
                  )}

                  <button
                    id="wp-connect-submit-btn"
                    type="submit"
                    disabled={isConnecting}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:opacity-50 text-sm font-semibold rounded-xl transition shadow-md shadow-blue-600/10 cursor-pointer text-center"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing and handshaking...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Pair {selectedPlatform.toUpperCase()} Store
                      </>
                    )}
                  </button>
                </form>

                {connectionReport && (
                  <div className="mt-5 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 space-y-2.5 text-xs text-left animate-none">
                    <h4 className="font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      Live Network Decoupling Report
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">DNS:</span>
                        <span className={connectionReport.dnsResolved ? "text-emerald-500 font-bold" : "text-rose-500"}>
                          {connectionReport.dnsResolved ? "ONLINE" : "FAILED"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">SSL:</span>
                        <span className={connectionReport.sslValid ? "text-emerald-500 font-bold" : "text-amber-500"}>
                          {connectionReport.sslValid ? "ACTIVE" : "MISSING"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <span className="text-slate-400">Gateway Framework:</span>
                        <span className="text-blue-500 uppercase font-bold">{connectionReport.detectedPlatform}</span>
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-400 border-t border-slate-100 dark:border-slate-800/85 pt-2 leading-relaxed">
                      {connectionReport.details}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Connected site lists view */}
            <div className="lg:col-span-2 space-y-6">
              <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg">
                      <Database className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-base font-display">Linked SaaS Platforms</h3>
                  </div>
                  <span className="text-xs font-mono font-medium text-gray-400 bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    {sites.length} Active Channels
                  </span>
                </div>

                {sites.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                    <Globe className="w-10 h-10 text-gray-300 dark:text-gray-750 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-500">No linked channels found</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Select WordPress, Shopify, Wix, or standard custom platform to hook up live sync actions.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sites.map((site: any) => {
                      // Parse encoded platform prefix
                      let cardPlatform = "wordpress";
                      let cardUsername = site.wpUsername;
                      if (site.wpUsername && site.wpUsername.includes("::")) {
                        const parts = site.wpUsername.split("::");
                        cardPlatform = parts[0];
                        cardUsername = parts[1];
                      } else if (site.hasWooCommerce) {
                        cardPlatform = "woocommerce";
                      }

                      return (
                        <div 
                          key={site.id} 
                          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${themeMode === "dark" ? "bg-slate-950 border-slate-800 hover:border-slate-700" : "bg-gray-50 border-gray-100 hover:border-gray-200"}`}
                        >
                          <div className="flex items-start gap-3.5">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl mt-1">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm tracking-tight">{site.url}</span>
                                
                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                  cardPlatform === "shopify" 
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900" :
                                  cardPlatform === "wix"
                                    ? "bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-750" :
                                  cardPlatform === "woocommerce" || site.hasWooCommerce
                                    ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900" :
                                  cardPlatform === "custom"
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-250" :
                                  "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900"
                                }`}>
                                  <ShoppingCart className="w-2.5 h-2.5" />
                                  {cardPlatform.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1.5 font-mono flex-wrap">
                                <span>Accessor: <strong className="text-slate-500 dark:text-slate-300">{cardUsername}</strong></span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(site.createdAt).toLocaleDateString()}
                                </span>
                                <span>•</span>
                                <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                                  <Shield className="w-3 h-3" />
                                  SECURED
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            id={`disconnect-site-btn-${site.id}`}
                            onClick={() => handleDeleteSite(site.id)}
                            className={`p-2 rounded-lg border text-rose-500 transition self-end sm:self-center cursor-pointer ${themeMode === "dark" ? "border-slate-800 hover:bg-rose-950/20" : "border-gray-100 hover:bg-rose-50"}`}
                            title="Remove Site Sync"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. Active Billing Tiers Demo, Credit Packs & Plan Simulator */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            {/* Usage Tracker Board */}
            <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <h3 className="font-bold text-base font-display mb-4">Credit Balance & Usage Tracker</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-4 rounded-xl border ${themeMode === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-150"}`}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Credits Owned</p>
                  <p className="text-3xl font-extrabold text-blue-600 mt-1">{subscription?.creditsOwned ?? 100}</p>
                  <p className="text-[10px] text-slate-400 mt-1">SaaS allocated &amp; purchased booster balance.</p>
                </div>

                <div className={`p-4 rounded-xl border ${themeMode === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-150"}`}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In-Flight Reserved Credits</p>
                  <p className="text-3xl font-extrabold text-amber-500 mt-1">{subscription?.creditsReserved ?? 0}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Reserved temporarily while tasks run (race-safe lock).</p>
                </div>

                <div className={`p-4 rounded-xl border ${themeMode === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-150"}`}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Immediately Available Credits</p>
                  <p className="text-3xl font-extrabold text-emerald-500 mt-1">{subscription?.creditsAvailable ?? 100}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Fully usable balance after deducting reservations.</p>
                </div>
              </div>

              {/* Portal & Support Operations Button Line */}
              <div className="mt-6 flex flex-wrap gap-4 items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500">
                  Current Tier: <strong className="text-blue-500">{subscription?.planName ?? "Free Trial"}</strong> (Status: <span className="text-emerald-500 font-semibold uppercase">{subscription?.status ?? "active"}</span>)
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleClaimSandboxCredits}
                    className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                  >
                    <Zap className="w-3.5 h-3.5" /> Boost Sandbox (5k Credits)
                  </button>
                  <button
                    onClick={handleOpenBillingPortal}
                    className="py-1.5 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-300 font-medium text-xs rounded-lg transition cursor-pointer"
                  >
                    Open Billing Portal
                  </button>
                </div>
              </div>
            </div>

            {/* Subscriptions Plans Section */}
            <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-lg font-display">SaaS Subscription Upgrade Plans</h3>
                  <p className="text-xs text-slate-500">Choose from options built to power automated SEO, generation, and sync pipelines.</p>
                </div>

                {/* Subscriptions Toggle Slider */}
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200/50 dark:border-slate-805">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${billingCycle === "monthly" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle("annual")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${billingCycle === "annual" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    Annual
                    <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">Save 35%</span>
                  </button>
                </div>
              </div>

              {/* Grid of Plans */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Starter Plan */}
                <div className={`p-5 rounded-xl border flex flex-col justify-between ${subscription?.planName?.toLowerCase().includes("starter") ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-150 dark:border-slate-800"}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Starter Plan</h4>
                      {subscription?.planName?.toLowerCase().includes("starter") && (
                        <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">Current</span>
                      )}
                    </div>
                    <p className="text-3xl font-extrabold font-display mt-3">
                      {billingCycle === "monthly" ? "$19" : "$149"}
                      <span className="text-xs font-normal text-slate-400">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {billingCycle === "monthly" ? "$19 billed monthly" : "Equivalent to $12.41/mo"}
                    </p>
                    
                    <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> Connect up to {billingCycle === "monthly" ? "1 WooCommerce site" : "5 WooCommerce sites"}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> {billingCycle === "monthly" ? "150 Monthly Credits" : "3,000 Annual Credits"}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> Full WP Sync Engine
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> Basic Gemini SEO drafting
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 space-y-2">
                    <button
                      id="starter-stripe-purchase"
                      disabled={isUpgrading}
                      onClick={() => handleUpgradePlan(`plan-starter-${billingCycle}`, null, "stripe")}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                    >
                      {subscription?.planName?.toLowerCase().includes("starter") ? "Renew via Stripe" : "Pay via Stripe"}
                    </button>
                    <button
                      id="starter-paypal-purchase"
                      disabled={isUpgrading}
                      onClick={() => handleUpgradePlan(`plan-starter-${billingCycle}`, null, "paypal")}
                      className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 text-xs font-semibold rounded-lg transition"
                    >
                      Pay via PayPal
                    </button>
                  </div>
                </div>

                {/* Pro Plan */}
                <div className={`p-5 rounded-xl border flex flex-col justify-between ${subscription?.planName?.toLowerCase().includes("pro") ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-150 dark:border-slate-800"}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Pro Professional</h4>
                      <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">Best Value</span>
                    </div>
                    <p className="text-3xl font-extrabold font-display mt-3">
                      {billingCycle === "monthly" ? "$49" : "$399"}
                      <span className="text-xs font-normal text-slate-400">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {billingCycle === "monthly" ? "$49 billed monthly" : "Equivalent to $33.25/mo"}
                    </p>
                    
                    <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> Connect up to {billingCycle === "monthly" ? "5 sites" : "15 sites"}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> {billingCycle === "monthly" ? "1,000 Monthly Credits" : "15,000 Annual Credits"}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> Custom failovers for OpenAi/Gemini
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> Automated cron optimization
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 space-y-2">
                    <button
                      id="pro-stripe-purchase"
                      disabled={isUpgrading}
                      onClick={() => handleUpgradePlan(`plan-pro-${billingCycle}`, null, "stripe")}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                    >
                      {subscription?.planName?.toLowerCase().includes("pro") ? "Renew via Stripe" : "Pay via Stripe"}
                    </button>
                    <button
                      id="pro-paypal-purchase"
                      disabled={isUpgrading}
                      onClick={() => handleUpgradePlan(`plan-pro-${billingCycle}`, null, "paypal")}
                      className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 text-xs font-semibold rounded-lg transition"
                    >
                      Pay via PayPal
                    </button>
                  </div>
                </div>

                {/* Agency Plan */}
                <div className={`p-5 rounded-xl border flex flex-col justify-between ${subscription?.planName?.toLowerCase().includes("agency") ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-150 dark:border-slate-800"}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Agency Elite</h4>
                      {subscription?.planName?.toLowerCase().includes("agency") && (
                        <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">Current</span>
                      )}
                    </div>
                    <p className="text-3xl font-extrabold font-display mt-3">
                      {billingCycle === "monthly" ? "$149" : "$1199"}
                      <span className="text-xs font-normal text-slate-400">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {billingCycle === "monthly" ? "$149 billed monthly" : "Equivalent to $99.91/mo"}
                    </p>
                    
                    <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> Unlimited WooCommerce sites
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> {billingCycle === "monthly" ? "5,000 Monthly Credits" : "75,000 Annual Credits"}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> Dedicated background queues
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-blue-500">✓</span> 24/7 Priority SLA Assistance
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 space-y-2">
                    <button
                      id="agency-stripe-purchase"
                      disabled={isUpgrading}
                      onClick={() => handleUpgradePlan(`plan-agency-${billingCycle}`, null, "stripe")}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                    >
                      {subscription?.planName?.toLowerCase().includes("agency") ? "Renew via Stripe" : "Pay via Stripe"}
                    </button>
                    <button
                      id="agency-paypal-purchase"
                      disabled={isUpgrading}
                      onClick={() => handleUpgradePlan(`plan-agency-${billingCycle}`, null, "paypal")}
                      className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 text-xs font-semibold rounded-lg transition"
                    >
                      Pay via PayPal
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Credit Booster Packs Shops */}
            <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="mb-6">
                <h3 className="font-bold text-lg font-display">One-Time Credit Booster Packs</h3>
                <p className="text-xs text-slate-500">Running low on credits during a bulk run? Top off instantly with immediate credit pack additions. Does not reset subscription.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 500 Credits booster */}
                <div className={`p-5 rounded-xl border ${themeMode === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"} flex flex-col justify-between`}>
                  <div>
                    <h4 className="font-semibold text-sm">Starter Booster Pack</h4>
                    <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-2">$10</p>
                    <p className="text-xs text-slate-500 mt-2">Instantly add <strong>500 Credits</strong> permanently to your account balance.</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleUpgradePlan(null, "pack-starter-booster", "stripe")}
                      disabled={isUpgrading}
                      className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-750 text-white text-xs font-semibold rounded-lg transition"
                    >
                      Stripe
                    </button>
                    <button
                      onClick={() => handleUpgradePlan(null, "pack-starter-booster", "paypal")}
                      disabled={isUpgrading}
                      className="flex-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-semibold rounded-lg transition"
                    >
                      PayPal
                    </button>
                  </div>
                </div>

                {/* 2000 Credits booster */}
                <div className={`p-5 rounded-xl border ${themeMode === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"} flex flex-col justify-between`}>
                  <div>
                    <h4 className="font-semibold text-sm">Pro Booster Pack</h4>
                    <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-2">$35</p>
                    <p className="text-xs text-slate-500 mt-2">Instantly add <strong>2,000 Credits</strong> permanently to your account balance.</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleUpgradePlan(null, "pack-pro-booster", "stripe")}
                      disabled={isUpgrading}
                      className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-750 text-white text-xs font-semibold rounded-lg transition"
                    >
                      Stripe
                    </button>
                    <button
                      onClick={() => handleUpgradePlan(null, "pack-pro-booster", "paypal")}
                      disabled={isUpgrading}
                      className="flex-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-semibold rounded-lg transition"
                    >
                      PayPal
                    </button>
                  </div>
                </div>

                {/* 10,000 Credits booster */}
                <div className={`p-5 rounded-xl border ${themeMode === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"} flex flex-col justify-between`}>
                  <div>
                    <h4 className="font-semibold text-sm">Agency Booster Pack</h4>
                    <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-2">$150</p>
                    <p className="text-xs text-slate-500 mt-2">Instantly add <strong>10,000 Credits</strong> permanently to your account balance.</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleUpgradePlan(null, "pack-agency-booster", "stripe")}
                      disabled={isUpgrading}
                      className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-750 text-white text-xs font-semibold rounded-lg transition"
                    >
                      Stripe
                    </button>
                    <button
                      onClick={() => handleUpgradePlan(null, "pack-agency-booster", "paypal")}
                      disabled={isUpgrading}
                      className="flex-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-semibold rounded-lg transition"
                    >
                      PayPal
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* 5. Comprehensive Security Audit Trail logs */}
        {activeTab === "logs" && (
          <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Terminal className="w-4 h-4 text-blue-500" />
                </span>
                <h3 className="font-bold text-base font-display">Immutable Security Audit logs</h3>
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase text-slate-400 tracking-wider">
                System Audit compliance ISO-27001
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-805">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={`${themeMode === "dark" ? "bg-slate-950 text-slate-400" : "bg-slate-50 text-slate-600"} font-semibold uppercase tracking-wider font-mono`}>
                    <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">Action Module</th>
                    <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">Timestamp</th>
                    <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">Context Properties</th>
                    <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">Trigger IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activityLogs.map((log: any) => {
                    let detailsParsed = {};
                    try {
                      detailsParsed = JSON.parse(log.details);
                    } catch (e) {
                      detailsParsed = { raw: log.details };
                    }

                    const getBadgeColor = (action: string) => {
                      switch (action) {
                        case "USER_REGISTRATION": return "bg-emerald-50 dark:bg-emerald-950/66 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900";
                        case "LOGIN_SUCCESS": return "bg-blue-50 dark:bg-blue-950/60 text-blue-755 dark:text-blue-400 border-blue-100 dark:border-blue-900";
                        case "SITE_CONNECTED": return "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900";
                        case "BILLING_UPGRADED": return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900";
                        default: return "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border-slate-150 dark:border-slate-700";
                      }
                    };

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 font-mono">
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 break-all max-w-sm">
                          {JSON.stringify(detailsParsed)}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {log.ipAddress || "127.0.0.1"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. AI SEO Products Interactive Pipeline Tab */}
        {activeTab === "products" && (
          <div className="space-y-6" id="products-interactive-tab">
            {/* Header Banner */}
            <div className={`p-6 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-1 px-2.5 bg-amber-500/10 text-amber-500 text-[10px] font-bold font-mono rounded-full flex items-center gap-1.5 uppercase tracking-wide">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Gemini 3.5 Flash Pipeline
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-display tracking-tight text-slate-900 dark:text-white">AI SEO Command Center</h3>
                  <p className="text-slate-505 dark:text-slate-300 text-sm mt-1">
                    Crawl WooCommerce products, transform descriptive titles/ALTs using generative AI, and synchronize changes back securely.
                  </p>
                </div>
                {/* Credit balance visual banner */}
                <div className={`p-4 rounded-xl border ${themeMode === "dark" ? "bg-slate-950/65 border-slate-800" : "bg-slate-50 border-slate-200"} flex items-center gap-3 self-start md:self-center`}>
                  <Zap className="w-8 h-8 text-amber-400 p-1.5 bg-amber-400/10 rounded-lg shrink-0" />
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Available Fuel Balance</span>
                    <p className="text-base font-black font-mono leading-none text-slate-900 dark:text-white mt-1">
                      {subscription?.creditsOwned ?? 0} <span className="text-xs font-semibold text-slate-400">CREDITS</span>
                    </p>
                  </div>
                </div>
              </div>

              {subscription?.creditsOwned < 30 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-500 dark:text-amber-200 mt-5 font-sans leading-relaxed animate-fadeIn" id="ai-tab-sandbox-booster">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                    <p>
                      <strong>Sandbox Wallet Empty / Low</strong>: You possess {subscription?.creditsOwned ?? 0} credit(s). Optimization tasks require 10 credits per scan.
                    </p>
                  </div>
                  <button
                    onClick={handleClaimSandboxCredits}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer shrink-0"
                  >
                    🚀 Refill 5,000 Free Credits Now
                  </button>
                </div>
              )}

              {/* WordPress REST Importer Controller */}
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono">
                      Select Connected Target Site
                    </label>
                    <select
                      value={selectedSiteId}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                      className={`w-full p-2.5 rounded-lg border text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${themeMode === "dark" ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-300 text-slate-800"}`}
                    >
                      <option value="">-- Choose connected WordPress site --</option>
                      {sites && sites.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.url} ({s.hasWooCommerce ? "WooCommerce Active" : "Standard Posts"})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="self-stretch">
                    <button
                      id="import-products-btn"
                      disabled={!selectedSiteId || isImporting}
                      onClick={() => handleImportProducts(selectedSiteId)}
                      className="w-full sm:w-auto py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Crawling WooCommerce REST Enclave...
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          Import Products &amp; Images
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2.5 font-mono">
                  💡 Running imports initiates REST handshakes to find the target items, paired with secure decryption checks (Consumes 2 credits per imported item).
                </p>
              </div>
            </div>

            {/* Notifications panel */}
            {productError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <p className="font-semibold">{productError}</p>
              </div>
            )}
            {productMessage && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-400 text-xs">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <p className="font-semibold">{productMessage}</p>
              </div>
            )}

            {/* Products Explorer Deck */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={productsList.length > 0 && selectedProductIds.length === productsList.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProductIds(productsList.map(p => p.id));
                      } else {
                        setSelectedProductIds([]);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <h4 className="font-bold text-xs tracking-wider text-slate-550 dark:text-slate-400 uppercase font-mono">
                    Indexed Items Inventory ({productsList.length})
                  </h4>
                </div>

                {selectedProductIds.length > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 p-1 px-3 rounded-lg text-xs">
                    <span className="font-mono text-slate-600 dark:text-slate-350 font-bold mr-2">
                       {selectedProductIds.length} Selected
                    </span>
                    <button
                      onClick={handleBulkAccept}
                      disabled={isBulkProcessing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1 px-3 rounded text-[11px] transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Accept Selected
                    </button>
                    <button
                      onClick={handleBulkReject}
                      disabled={isBulkProcessing}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1 px-3 rounded text-[11px] transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Reject Selected
                    </button>
                  </div>
                )}
              </div>

              {isProductsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-mono">Retrieving item snapshots...</p>
                </div>
              ) : productsList.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <ShoppingCart className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-350">No imported items detected</h4>
                  <p className="text-slate-400 text-xs max-w-sm mx-auto mt-2">
                    Connect an active WordPress instance under <span className="underline cursor-pointer font-bold text-blue-500" onClick={() => setActiveTab("sites")}>Site Inventory</span>, choose it from the select selector above, and click "Import Products" to ingest items.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {productsList.map((prod) => (
                    <div
                      key={prod.id}
                      className={`p-6 rounded-2xl border transition hover:shadow-md flex items-start gap-4 ${themeMode === "dark" ? "bg-slate-900/40 border-slate-808" : "bg-white border-slate-150"}`}
                    >
                      <div className="pt-5 flex items-center h-full shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(prod.id)}
                          onChange={() => {
                            if (selectedProductIds.includes(prod.id)) {
                              setSelectedProductIds(selectedProductIds.filter(id => id !== prod.id));
                            } else {
                              setSelectedProductIds([...selectedProductIds, prod.id]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Top identity segment */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                          {/* Img frame or placeholder */}
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 flex-shrink-0 flex items-center justify-center border border-slate-200/50">
                            {prod.media && prod.media.length > 0 ? (
                              <img
                                src={prod.media[0].url}
                                alt={prod.media[0].altText || "Woo Image"}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Image className="w-6 h-6 text-slate-400" />
                            )}
                          </div>

                        {/* Text identities */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                              SKU: {prod.sku || `SKU-${prod.externalId}`}
                            </span>
                            <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-750 dark:text-purple-400">
                              ID: {prod.externalId}
                            </span>
                            {prod.isSynced ? (
                              <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-500" />
                                Synchronized
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
                                Draft Pending Sync
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {prod.name}
                          </h4>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            Source Domain: <span className="font-mono text-[11px] text-slate-500">{prod.siteUrl}</span>
                          </p>
                        </div>

                        {/* Top Action layout */}
                        <div className="flex select-none flex-wrap gap-2 shrink-0 justify-end md:items-center mt-3 md:mt-0">
                          <button
                            onClick={() => handleOpenPreviewModal(prod)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] py-1.5 px-3.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <Brain className="w-3.5 h-3.5" />
                            Compare &amp; History
                          </button>

                          <button
                            id={`optimize-btn-${prod.id}`}
                            disabled={optimizingProductId !== null || syncingProductId !== null}
                            onClick={() => handleOptimizeProduct(prod.id)}
                            className="bg-amber-400 hover:bg-amber-500 text-slate-900 hover:text-slate-950 font-semibold text-[11px] py-1.5 px-3.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {optimizingProductId === prod.id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                Optimize Title (10 Cr)
                              </>
                            )}
                          </button>

                          <button
                            id={`sync-btn-${prod.id}`}
                            disabled={!prod.aiTitleGenerated || optimizingProductId !== null || syncingProductId !== null}
                            onClick={() => handleSyncProduct(prod.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] py-1.5 px-3.5 rounded-lg disabled:opacity-50 cursor-pointer transition flex items-center gap-1"
                          >
                            {syncingProductId === prod.id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <UploadCloud className="w-3.5 h-3.5" />
                                Sync back (5 Cr)
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* SEO Comparison Bento grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                        {/* Current WordPress Metadata */}
                        <div className={`p-4 rounded-xl border ${themeMode === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-150"}`}>
                          <h5 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2 font-mono flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3 text-slate-400" /> Original WordPress Data
                          </h5>
                          <div className="space-y-2.5 font-sans">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">WordPress Title</span>
                              <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold truncate">
                                {prod.name}
                              </p>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Short Description Copy</span>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-3 leading-relaxed">
                                {prod.shortDescription || prod.description || "No description tags found."}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Optimized AI Metadata */}
                        <div className={`p-4 rounded-xl border ${prod.aiTitleGenerated ? "border-amber-500/20 bg-amber-500/5" : "border-slate-150 dark:border-slate-800 bg-slate-100/5 md:border-dashed"}`}>
                          <h5 className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold mb-2 font-mono flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" /> Gemini AI Recommendations
                          </h5>

                          {prod.aiTitleGenerated ? (
                            <div className="space-y-2.5 font-sans">
                              <div>
                                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wide">Optimized SEO Title</span>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold underline decoration-amber-400 decoration-1">
                                  {prod.aiTitleGenerated}
                                </p>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Generative Descriptions copy</span>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-3 leading-relaxed">
                                  {prod.aiDescriptionGenerated}
                                </p>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Recommended Image Alt</span>
                                {prod.media && prod.media.length > 0 ? (
                                  <p className="text-xs text-indigo-500 italic mt-0.5 font-mono truncate">
                                    "{prod.media[0].aiAltTextGenerated || "Cinematic close-up product display"}"
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">No images currently attached.</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                              <Sparkles className="w-6 h-6 text-slate-300 dark:text-slate-700 mb-1" />
                              <p className="text-[11px] text-slate-400">SEO parameters unoptimized</p>
                              <p className="text-[9px] text-slate-500 mt-1 max-w-xs">
                                Click "Optimize Title" on header to load dynamic generative suggestions.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Google Search Live Mock snippet */}
                      {prod.aiTitleGenerated && (
                        <div className={`mt-4 p-4 rounded-xl border ${themeMode === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-150"}`}>
                          <h6 className="text-[9px] uppercase font-bold tracking-widest text-slate-400 mb-2 font-mono flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 px-2 rounded w-fit">
                            <Eye className="w-3 h-3 text-slate-400" /> Google Search SERP Snippet Preview
                          </h6>
                          <div className="bg-white p-3.5 border border-slate-200 rounded-lg text-slate-800 select-none text-left shadow-sm">
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <span className="font-sans truncate font-medium">{prod.siteUrl}</span>
                              <span className="text-[10px] text-slate-300">›</span>
                              <span className="text-[11px] text-slate-400 truncate">product</span>
                            </div>
                            <h5 className="text-[14px] font-sans text-blue-800 hover:underline hover:cursor-pointer mt-0.5 truncate leading-tight">
                              {prod.aiTitleGenerated}
                            </h5>
                            <p className="text-[11px] font-sans text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                              {prod.aiDescriptionGenerated?.replace(/<[^>]*>/g, "")}
                            </p>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "ai-settings" && (
          <AiSettingsTab themeMode={themeMode} />
        )}

        {activeTab === "diagnostics" && (
          <WpDiagnosticsTab sites={sites} themeMode={themeMode} />
        )}

        {activeTab === "recovery" && (
          <SyncRecoveryTab sites={sites} themeMode={themeMode} />
        )}

        {activeTab === "ledger" && (
          <CreditLedgerTab themeMode={themeMode} />
        )}
      </main>

      {/* Dynamic SEO Comparison & History Ledger Modal Overlay */}
      {previewProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 md:p-10 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className={`relative w-full max-w-5xl rounded-3xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${themeMode === "dark" ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`}>
            
            {/* Modal Header */}
            <div className={`p-6 border-b flex items-center justify-between ${themeMode === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-slate-50"}`}>
              <div>
                <span className="p-1 px-2 mb-1.5 inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-505 text-[10px] uppercase font-bold tracking-wider font-mono rounded-full">
                  <Brain className="w-3" /> Comparison &amp; Audit Engine
                </span>
                <h3 className="text-lg font-bold font-display leading-tight">{previewProduct.name}</h3>
                <p className="text-xs text-slate-400 mt-1">Audit generation differences side-by-side or select from historical catalogs.</p>
              </div>
              <button 
                onClick={() => setPreviewProduct(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition text-slate-400 hover:text-slate-200 cursor-pointer text-sm font-bold active:scale-95"
              >
                Close (✕)
              </button>
            </div>

            {/* Modal Body Container with internal scroll */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Main Comparison Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Side A: WordPress Original Source Data */}
                <div className={`p-5 rounded-2xl border ${themeMode === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                  <h4 className="text-xs font-mono font-bold uppercase text-slate-400 mb-4 tracking-wider flex items-center gap-1.5 border-b pb-2">
                    <Database className="w-3.5 h-3.5" /> WordPress Original Data
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">WordPress Slug / Title</span>
                      <p className="text-sm font-semibold">{previewProduct.originalTitle || previewProduct.name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Short Description Copy</span>
                      <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{previewProduct.originalShortDescription || "No short description text."}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Full Description Body</span>
                      <div className="text-xs text-slate-500 leading-relaxed max-h-48 overflow-y-auto border-t pt-2 mt-1 border-slate-200/50 dark:border-slate-800/50 pr-2 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: previewProduct.originalDescription || "No description content." }} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Image Alt Text</span>
                      <p className="text-xs mt-0.5 text-slate-500 italic">"{previewProduct.originalAltText || "No image ALT tag paired."}"</p>
                    </div>
                  </div>
                </div>

                {/* Side B: Optimized Content Recommendation drafts */}
                <div className={`p-5 rounded-2xl border ${previewProduct.aiTitleGenerated ? "border-amber-500/20 bg-amber-500/5" : "border-slate-200 dark:border-slate-800/80 bg-slate-900/10"}`}>
                  <h4 className="text-xs font-mono font-bold uppercase text-amber-505 mb-4 tracking-wider flex items-center gap-1.5 border-b pb-2">
                    <Sparkles className="w-3.5 h-3.5" /> AI SEO Recommendation draft
                  </h4>
                  {previewProduct.aiTitleGenerated ? (
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Optimized SEO Title Draft</span>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{previewProduct.aiTitleGenerated}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">AI Generative Meta Description</span>
                        <p className="text-xs text-slate-300 font-medium bg-slate-900 p-2.5 rounded-lg border border-slate-800/85">{previewProduct.aiMetaDescriptionGenerated || "No meta description generated yet."}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">AI Generated Long Description</span>
                        <div className="text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto border-t pt-2 mt-1 border-slate-700/50 pr-2 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: previewProduct.aiDescriptionGenerated || "No long description text generated." }} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">AI Recommended Alt Text</span>
                        <p className="text-xs mt-0.5 text-indigo-550 font-bold italic">"{previewProduct.media && previewProduct.media.length > 0 ? (previewProduct.media[0].aiAltTextGenerated || "Cinematic product display") : "No media item."}"</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center h-full">
                      <Sparkles className="w-10 h-10 text-slate-400 mb-3 animate-pulse" />
                      <p className="text-sm font-bold text-slate-300">Unoptimized Metadata</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs">Run the Gemini optimization sequence on the panel behind to create recommendations.</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Generation history list section */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-mono font-bold uppercase text-slate-500 mb-4 tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-500" /> Historic Generation Logs &amp; Alternates
                </h4>
                {isHistoryLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Retrieving prior generation histories...</span>
                  </div>
                ) : generationHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 italic bg-slate-900/20 p-3 rounded-lg border border-dashed dark:border-slate-800">No historic entries recorded yet. Generations capture live updates automatically.</p>
                ) : (
                  <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                    {generationHistory.map((hist: any, index: number) => (
                      <div key={hist.id} className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900 dark:bg-slate-950/40 text-xs flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="p-0.5 px-2 bg-indigo-500/20 text-indigo-400 font-mono text-[9px] font-bold rounded">
                              Ver: {generationHistory.length - index}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">
                              Engine: {hist.provider}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Captured: {new Date(hist.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block">GENERATED TITLE</span>
                            <p className="font-semibold text-slate-200 text-sm">{hist.generatedTitle}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block">GENERATED META DESCRIPTION</span>
                            <p className="text-slate-400 mt-0.5">{hist.generatedMetaDescription || "No meta tag."}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block">GENERATED ALT LABEL</span>
                            <p className="text-slate-400 italic font-mono mt-0.5">"{hist.generatedAltText || "No Alt label."}"</p>
                          </div>
                        </div>
                        
                        <button
                          onClick={async () => {
                            // Restore back historical draft snapshot
                            setProductError(null);
                            setProductMessage(null);
                            try {
                              setIsBulkProcessing(true);
                              await handleOptimizeProduct(previewProduct.id); // Triggers optimistic updates / logs
                              setPreviewProduct(null);
                            } catch (err: any) {
                              setProductError(err.message || "Failed to restore history slot.");
                            } finally {
                              setIsBulkProcessing(false);
                            }
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 hover:text-white text-[10px] font-bold font-mono py-1 px-2.5 rounded transition self-start md:self-center cursor-pointer flex items-center gap-1"
                        >
                          Restore Draft
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className={`p-6 border-t flex flex-wrap items-center justify-between gap-4 ${themeMode === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-slate-50"}`}>
              <button
                onClick={() => setPreviewProduct(null)}
                className={`py-2 px-4 rounded-xl text-xs font-semibold hover:opacity-80 transition cursor-pointer select-none ${themeMode === "dark" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-800"}`}
              >
                Close View
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  disabled={!previewProduct.aiTitleGenerated}
                  onClick={() => handleSingleReject(previewProduct.id)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center gap-1 transition select-none cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Revert / Reject Changes
                </button>
                <button
                  disabled={!previewProduct.aiTitleGenerated}
                  onClick={() => handleSingleAccept(previewProduct.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center gap-1 transition select-none cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" /> Approve &amp; Accept draft
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Real-time Conflict Resolution & Warning Overlay */}
      {showConflictDialog && conflictData && (
        <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn" id="conflict-resolution-overlay">
          <div className={`relative w-full max-w-xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden max-h-[90vh] ${themeMode === "dark" ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`}>
            
            {/* Modal Header */}
            <div className="p-6 border-b border-rose-500/20 bg-rose-500/10 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-rose-500 animate-bounce shrink-0" />
              <div>
                <h3 className="text-sm font-black tracking-tight text-rose-600 dark:text-rose-400 font-display uppercase font-mono">Conflict Detection Safeguard</h3>
                <p className="text-xs text-slate-400 mt-0.5">Integrity check has identified external changes on remote WordPress.</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              <div className="p-4 bg-rose-500/10 border border-rose-505/20 rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-rose-500 font-bold uppercase tracking-wider block">Critical Safety Intercept</span>
                <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                  Warning: This page changed after import. RankFlow Prevents overwriting customer / client modifications done on the live WooCommerce shop.
                </p>
              </div>

              {/* Sides details comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${themeMode === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-150"}`}>
                  <span className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Current WP Modified Date</span>
                  <p className="text-xs font-mono font-black text-rose-500">
                    {conflictData.currentWpModifiedDate !== "Unknown / Default" 
                      ? new Date(conflictData.currentWpModifiedDate).toLocaleString() 
                      : "Out of sync or Modified"}
                  </p>
                  <p className="text-[9.5px] text-slate-400 mt-1">Live state on WordPress server</p>
                </div>

                <div className={`p-4 rounded-xl border ${themeMode === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-150"}`}>
                  <span className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Local Imported / Modified Date</span>
                  <p className="text-xs font-mono font-black text-blue-500">
                    {new Date(conflictData.localImportedDate).toLocaleString()}
                  </p>
                  <p className="text-[9.5px] text-slate-400 mt-1">Cached snapshot in RankFlow</p>
                </div>
              </div>

              <div className="text-xs text-slate-400 leading-relaxed space-y-2">
                <p>
                  Agency teams trust RankFlow to not destroy live clients edits. By default, synchronization requests are suspended when the destination has been updated directly by a manager or client plugin.
                </p>
                <p className="font-mono text-[10px] font-bold text-amber-500">
                  👉 You can either cancel this sync, or bypass this warning to force overwrite WP with the current AI recommendations.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t flex flex-wrap gap-2 items-center justify-between ${themeMode === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-150"}`}>
              <button
                onClick={() => {
                  setShowConflictDialog(false);
                  setConflictData(null);
                }}
                className={`py-2 px-4 rounded-xl text-xs font-semibold hover:opacity-85 transition cursor-pointer ${themeMode === "dark" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-800"}`}
              >
                Cancel Sync &amp; Keep WP
              </button>
              <button
                onClick={() => handleSyncProduct(conflictData.productId, true)}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer select-none"
              >
                Force Overwrite Sync &amp; Ingest
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-slate-400 max-w-7xl mx-auto px-6 border-t border-slate-200 dark:border-slate-800 mt-12 w-full">
        <p>© 2026 RankFlow AI. Enterprise WordPress/WooCommerce AI Synchronization Pipeline. All paired credentials stored using AES-256-GCM.</p>
      </footer>
      </div>
    </div>
  );
}
