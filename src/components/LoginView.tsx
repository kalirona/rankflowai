import React, { useState } from "react";
import { KeyRound, Mail, AlertTriangle } from "lucide-react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

  return (
    <div className="w-full max-w-md mx-auto" id="login-card-container">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 bg-blue-50 text-blue-600 rounded-2xl mb-4">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-3xl font-bold font-display text-gray-900 tracking-tight">Welcome back</h2>
          <p className="text-gray-500 mt-2 text-sm">Enter your credentials to manage your optimization pipelines</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 mb-6 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
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
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
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
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-medium text-sm rounded-xl tracking-wide transition shadow-lg shadow-blue-600/15"
          >
            {isLoading ? "Authenticating user..." : "Access Command Center"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-600">
            New to RankFlow AI?{" "}
            <button
              id="goto-register-button"
              type="button"
              onClick={onNavigateToRegister}
              className="text-blue-600 font-semibold hover:underline"
            >
              Start Free Trial
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
