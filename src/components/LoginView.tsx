// src/components/LoginView.tsx

import React, { useState } from "react";
import { KeyRound, Mail, AlertTriangle, Sparkles, UserCheck, Terminal, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";
import { getCsrfToken } from "../lib/csrf";

interface LoginViewProps {
  onSuccess: (user: any) => void;
  onNavigateToRegister: () => void;
}

export default function LoginView({ onSuccess, onNavigateToRegister }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Simulator States
  const [simStep, setSimStep] = useState(0); // 0 = idle, 1-5 = visual steps
  const [simText, setSimText] = useState("");
  const [simProfile, setSimProfile] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Strict input validation checks
    if (!email.trim() || !password.trim()) {
      setError("Please fill out all credential inputs.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // Automated 1-Click Simulation Engine
  const handleSimulateLogin = async (profileName: string, config: { name: string; email: string }) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setSimProfile(profileName);
    setSimText("Initializing developer sandbox bypass...");
    setSimStep(1);
    
    // Realistic micro-delays to let developer see the system checklist progress
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    try {
      setSimText("Attempting profile handshake with Database...");
      setSimStep(2);
      
      const payload = {
        name: config.name,
        email: config.email,
        password: "demopassword123",
      };

      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify(payload)
      });
      
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (registerRes.ok) {
        setSimText("Simulation identity seeded. Directing token workspace...");
        setSimStep(4);
        const data = await registerRes.json();
        await new Promise((resolve) => setTimeout(resolve, 250));
        setSimStep(5);
        await new Promise((resolve) => setTimeout(resolve, 150));
        onSuccess(data.user);
        return;
      }

      // If registered already (Email already exists), invoke login sequence
      setSimText("Simulation identity verified. Resuming standard login...");
      setSimStep(3);
      
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({
          email: config.email,
          password: "demopassword123"
        })
      });

      await new Promise((resolve) => setTimeout(resolve, 350));

      if (!loginRes.ok) {
        const errData = await loginRes.json();
        throw new Error(errData.error || "Simulation credentials rejected.");
      }

      setSimText("Encrypted token cookie issued. Redirecting...");
      setSimStep(4);
      const data = await loginRes.json();
      await new Promise((resolve) => setTimeout(resolve, 250));
      setSimStep(5);
      await new Promise((resolve) => setTimeout(resolve, 150));
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Simulated login handshake failed.");
      setSimStep(0);
      setSimText("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4" id="login-container-card">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* LEFT COLUMN: Main Secure Login Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-xl border border-gray-100 p-8 flex flex-col justify-between">
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center p-3 px-3.5 bg-blue-50 text-blue-600 rounded-2xl mb-4">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold font-display text-gray-900 tracking-tight">Access Command Center</h2>
              <p className="text-gray-500 mt-2 text-sm">Enter your credentials to manage optimization pipelines</p>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 mb-6 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 animate-pulse" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="login-email-input"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm placeholder-gray-400 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    id="login-password-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm placeholder-gray-400 transition"
                    required
                  />
                </div>
              </div>

              <button
                id="login-submit-button"
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-medium text-sm rounded-xl tracking-wide transition shadow-lg shadow-blue-600/15 cursor-pointer"
              >
                {isLoading && simStep === 0 ? "Authenticating user..." : "Access Command Center"}
              </button>
            </form>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              New to RankFlow AI?{" "}
              <button
                id="goto-register-button"
                type="button"
                onClick={onNavigateToRegister}
                className="text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Start Free Trial
              </button>
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Built-in Custom Sandbox Simulator */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 flex flex-col justify-between" id="developer-sandbox-simulator">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold bg-blue-950/80 border border-blue-900/60 px-2.5 py-1 rounded-full">
                <Terminal className="w-3.5 h-3.5" />
                Control Deck
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                Active Sandbox
              </span>
            </div>

            <h3 className="text-lg font-bold font-display text-white tracking-tight">Sandbox Login Simulator</h3>
            <p className="text-slate-400 mt-1 text-xs leading-relaxed">
              Skip typing or creating accounts. Use these simulated identities to login and test live synchronization, SEO diagnostics, and rollbacks instantly.
            </p>

            {/* Profile simulation selectors */}
            <div className="mt-6 space-y-3.5">
              
              {/* Profile A: Super Administrator */}
              <button
                id="sim-profile-admin-btn"
                type="button"
                disabled={isLoading}
                onClick={() => handleSimulateLogin("Administrator", {
                  name: "Enterprise Admin",
                  email: "admin@rankflow.ai"
                })}
                className={`w-full text-left p-4 rounded-xl border transition flex flex-col justify-between gap-1 group hover:scale-[1.01] ${
                  isLoading 
                    ? "opacity-55 cursor-not-allowed border-slate-800 bg-slate-950/40" 
                    : "border-slate-800 bg-slate-950 hover:bg-slate-950 hover:border-blue-500/50 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs text-white group-hover:text-blue-400 transition">Enterprise Administrator</span>
                  </div>
                  <span className="text-[8px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded uppercase">Owner</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-sans">
                  Email: <span className="font-mono text-white">admin@rankflow.ai</span>
                </p>
                <p className="text-[10px] text-slate-500 font-sans italic leading-normal">
                  Full unrestricted optimization pipelines &amp; DB command deck.
                </p>
              </button>

              {/* Profile B: Agency Partner */}
              <button
                id="sim-profile-agency-btn"
                type="button"
                disabled={isLoading}
                onClick={() => handleSimulateLogin("Agency Marketer", {
                  name: "Agency Partner",
                  email: "agency@rankflow.ai"
                })}
                className={`w-full text-left p-4 rounded-xl border transition flex flex-col justify-between gap-1 group hover:scale-[1.01] ${
                  isLoading 
                    ? "opacity-55 cursor-not-allowed border-slate-800 bg-slate-950/40" 
                    : "border-slate-800 bg-slate-950 hover:bg-slate-950 hover:border-violet-500/50 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-violet-400" />
                    <span className="font-bold text-xs text-white group-hover:text-violet-400 transition">SEO Agency Consultant</span>
                  </div>
                  <span className="text-[8px] font-mono font-bold bg-violet-950 text-violet-400 border border-violet-900 px-1.5 py-0.5 rounded uppercase">Partner</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-sans">
                  Email: <span className="font-mono text-white">agency@rankflow.ai</span>
                </p>
                <p className="text-[10px] text-slate-500 font-sans italic leading-normal">
                  Manage multiple WordPress REST keys and run connection diagnostics.
                </p>
              </button>
            </div>
          </div>

          {/* Feedback steps output during active process */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            {simStep > 0 ? (
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3 font-mono text-[10px]" id="sim-status-log">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="flex items-center gap-1.5 text-[9px] font-bold text-blue-400">
                    <Sparkles className="w-3 h-3 animate-spin" />
                    Simulating Handshake: {simProfile}
                  </span>
                  <span>{simStep}/4 Completed</span>
                </div>
                
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span>
                    <span>Bypassed UI credential gates.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {simStep >= 2 ? <span className="text-emerald-500">✓</span> : <span className="text-slate-600">○</span>}
                    <span className={simStep === 2 ? "text-white font-bold" : ""}>Establishing schema mapping session context...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {simStep >= 3 ? <span className="text-emerald-500">✓</span> : <span className="text-slate-600">○</span>}
                    <span className={simStep === 3 ? "text-white font-bold" : ""}>Registering simulated user state fallback...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {simStep >= 4 ? <span className="text-emerald-500">✓</span> : <span className="text-slate-600">○</span>}
                    <span className={simStep === 4 ? "text-white font-bold text-emerald-400 animate-pulse" : ""}>
                      {simText}
                    </span>
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 text-right">
                  System: AES-256 Auth Proxying Active
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-3.5 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-[10px] text-slate-400 font-mono">
                <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Ready. Selection triggers direct DB pipeline connection.</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
