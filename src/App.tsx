import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, RefreshCw, Shield, Layers, HelpCircle, Terminal } from "lucide-react";
import LoginView from "./components/LoginView";
import RegisterView from "./components/RegisterView";
import DashboardView from "./components/DashboardView";
import { getCsrfToken } from "./lib/csrf";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [isThemeDark, setIsThemeDark] = useState<boolean>(false);

  useEffect(() => {
    // Audit check session token on reload
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/status");
        if (response.ok) {
          const data = await response.json();
          if (data.isAuthenticated && data.user) {
            setUser(data.user);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        console.error("Session verification handshake failed:", e);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (authenticatedUser: any) => {
    setUser(authenticatedUser);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { 
        method: "POST",
        headers: {
          "X-CSRF-Token": getCsrfToken()
        }
      });
    } catch (e) {
      console.error("Failed to cleanly disconnect session:", e);
    }
    setUser(null);
    setIsAuthenticated(false);
    setAuthView("login");
  };

  // 1. Initial Handshake Boot loader
  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100" id="global-boot-loading">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="p-4 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-600/35 mb-6"
        >
          <Zap className="w-10 h-10" />
        </motion.div>
        <span className="font-bold text-xl tracking-tight font-display text-white">RankFlow AI</span>
        <p className="text-sm text-slate-400 mt-2 font-mono flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
          Initializing Security Subsystems...
        </p>
      </div>
    );
  }

  // 2. Logged In Command Center view
  if (isAuthenticated && user) {
    return (
      <DashboardView 
        user={user} 
        onLogout={handleLogout} 
      />
    );
  }

  // 3. Marketing Landing Frame & Authentication flow
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row" id="auth-workspace-frame">
      {/* Visual Ambient Banner Panel */}
      <div className="md:w-2/5 xl:w-1/3 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 md:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/80 relative overflow-hidden">
        {/* Subtle decorative items to avoid tech-slop, focusing purely on beautiful negative space typography */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-500/5 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-slate-500/5 blur-[100px]" />

        <div className="flex items-center gap-3 relative z-10">
          <span className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-600/35">
            <Zap className="w-6 h-6" />
          </span>
          <span className="font-bold font-display text-white text-xl tracking-tight">RankFlow <span className="text-blue-400">AI</span></span>
        </div>

        <div className="my-auto py-12 md:py-0 relative z-10 max-w-lg">
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-5xl font-extrabold text-white font-display leading-[1.1] tracking-tight"
          >
            WooCommerce &amp; WordPress <span className="text-blue-400">SEO Automation</span> Command.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-slate-400 mt-6 text-base leading-relaxed"
          >
            Connect WordPress channels safely, monitor sync pipelines, generate rich schema graphs, and push optimized meta structures in real time. Built with maximum audit safety.
          </motion.p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/[0.01] border border-white/[0.05] rounded-2xl">
              <Shield className="w-5 h-5 text-blue-400 mb-2.5" />
              <h4 className="text-white text-xs font-bold uppercase tracking-wider font-mono">AES-256-GCM Secure</h4>
              <p className="text-slate-500 text-xs mt-1">Symmetric encryption key layers shielding WP passwords.</p>
            </div>
            <div className="p-4 bg-white/[0.01] border border-white/[0.05] rounded-2xl">
              <Layers className="w-5 h-5 text-blue-400 mb-2.5" />
              <h4 className="text-white text-xs font-bold uppercase tracking-wider font-mono">Activity Logs</h4>
              <p className="text-slate-500 text-xs mt-1">Immutable security ledger capturing sessions &amp; sites.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 pt-6 border-t border-slate-900/60 font-mono">
          <span>Enterprise Edition Sprint 1</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            ISO 27001 Secure
          </span>
        </div>
      </div>

      {/* Interactive Form Panel */}
      <div className="md:w-3/5 xl:w-2/3 min-h-[50vh] md:min-h-screen bg-slate-950 flex items-center justify-center p-6 md:p-12">
        <AnimatePresence mode="wait">
          {authView === "login" ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <LoginView
                onSuccess={handleLoginSuccess}
                onNavigateToRegister={() => setAuthView("register")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <RegisterView
                onSuccess={handleLoginSuccess}
                onNavigateToLogin={() => setAuthView("login")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
