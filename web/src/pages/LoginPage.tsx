import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  Building2,
  Eye,
  EyeOff,
  Check,
  X,
  Fingerprint,
  BarChart3,
  Bot,
  Zap,
} from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { FallingLightAnimation } from '../components/common/FallingLightAnimation';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'setup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupSuccessMessage, setSetupSuccessMessage] = useState<string | null>(null);

  // Setup form fields - start completely clean
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  useEffect(() => {
    // Check if initial setup is required
    apiFetch<{ setup_required: boolean }>('/auth/status')
      .then((data) => {
        if (data.setup_required) {
          setSetupRequired(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      login(response.access_token, {
        id: response.user_id,
        email: response.email,
        role: response.role,
        is_active: true,
        must_change_password: response.must_change_password,
        employee_id: response.employee_id,
        employee_name: response.employee_name,
      });

      // Role routing
      const r = response.role?.toUpperCase();
      if (r === 'ADMIN') {
        navigate('/admin');
      } else if (r === 'HR') {
        navigate('/hr');
      } else {
        navigate('/employee');
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      const errCode = err.code || err.detail?.code || '';
      if (errCode === 'USER_NOT_FOUND' || errMsg.toLowerCase().includes('no account found')) {
        setError('No account found with this email address.');
      } else if (errCode === 'ACCOUNT_DEACTIVATED' || errMsg.toLowerCase().includes('deactivated')) {
        setError('Your employee account has been deactivated. You cannot access this portal. Please contact Human Resources.');
      } else if (errCode === 'INVALID_CREDENTIALS' || errMsg.toLowerCase().includes('invalid') || err.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(errMsg || 'Invalid email or password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Validation checks for admin email: must contain '@' and end with '.app'
  const cleanAdminEmail = adminEmail.trim().toLowerCase();
  const hasAtSymbol = cleanAdminEmail.includes('@');
  const emailParts = cleanAdminEmail.split('@');
  const hasPrefix = hasAtSymbol && emailParts[0].trim().length > 0;
  const endsWithApp = cleanAdminEmail.endsWith('.app') && hasAtSymbol && (emailParts[1]?.length || 0) >= 4 && emailParts[1].endsWith('.app');
  const isEmailValid = hasPrefix && endsWithApp;

  const passwordChecks = [
    { id: 'spec', label: 'Special character (!@#$%^&*...)', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(adminPassword) },
    { id: 'num', label: 'Number (0-9)', valid: /[0-9]/.test(adminPassword) },
    { id: 'upper', label: 'Uppercase letter (A-Z)', valid: /[A-Z]/.test(adminPassword) },
    { id: 'lower', label: 'Lowercase letter (a-z)', valid: /[a-z]/.test(adminPassword) },
    { id: 'len', label: 'Minimum 8 characters', valid: adminPassword.length >= 8 },
  ];
  const isPasswordValid = passwordChecks.every((c) => c.valid);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEmailValid) {
      setError('Admin email must contain "@" and end with ".app" (e.g. admin@acmetech.app).');
      return;
    }

    if (!isPasswordValid) {
      setError('Please fulfill all password security requirements in the checklist.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        company_name: companyName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        admin_name: adminName.trim(),
      };

      await apiFetch<any>('/auth/setup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Show prominent success notification and redirect user to Sign In tab
      setSetupSuccessMessage('Administrator Account Initialized Successfully! Please sign in with your master credentials to enter the workspace.');
      setEmail(adminEmail.trim());
      setPassword('');
      setAdminPassword('');
      setSetupRequired(false);
      setActiveTab('signin');
    } catch (err: any) {
      setError(err.message || 'First-run setup could not be completed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-[#090d16] text-slate-100 font-sans overflow-hidden select-none">
      {/* Gentle Falling Light Animation (Top to Bottom Continuous) */}
      <FallingLightAnimation density={38} speedMultiplier={1} />

      {/* Subtle tech background grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* ================= LEFT HALF: IMMERSIVE BRANDING & SHOWCASE ================= */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 overflow-hidden border-r border-white/10 bg-gradient-to-br from-[#0b0f1c] via-[#0d1526] to-[#07090f] z-10">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[520px] h-[520px] rounded-full bg-sky-500/15 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[520px] h-[520px] rounded-full bg-indigo-600/15 blur-[140px] pointer-events-none" />

        {/* Top Brand Bar */}
        <div className="relative z-10 flex items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-600 text-white font-black text-xl shadow-lg shadow-sky-500/30">
              HL
            </div>
            <div>
              <span className="text-xl font-black text-white tracking-tight">
                HCM Lite
              </span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-400/30 uppercase tracking-widest">
                v2.0 Enterprise
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-mono bg-sky-500/10 px-3 py-1.5 rounded-full border border-sky-500/30">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            Saylani Edition
          </div>
        </div>

        {/* Center Hero Content - Positioned consistently higher up for both Sign In and Setup */}
        <div className="relative z-10 mt-4 xl:mt-6 mb-auto py-2 space-y-6 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-slate-300">
              Saylani Hackathon 2026 • Zaitoon Ashraf IT Park
            </span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight">
            Next-Gen Workforce Intelligence & Human Capital.
          </h1>

          <p className="text-sm xl:text-base text-slate-400 leading-relaxed">
            Empower your organization with real-time biometric geofencing, zero-variance statutory payroll calculation, and interactive Plotly visual analytics.
          </p>

          {/* Feature Showcase Pills */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center gap-3 hover:border-sky-500/30 transition-all hover:bg-white/[0.06]">
              <span className="p-2 rounded-lg bg-sky-500/15 text-sky-400">
                <BarChart3 className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">Plotly Analytics</h4>
                <p className="text-[11px] text-slate-400">Live dynamic visualizations</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center gap-3 hover:border-emerald-500/30 transition-all hover:bg-white/[0.06]">
              <span className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
                <Fingerprint className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">Geofenced Punch</h4>
                <p className="text-[11px] text-slate-400">Haversine GPS & Camera Face</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center gap-3 hover:border-indigo-500/30 transition-all hover:bg-white/[0.06]">
              <span className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400">
                <Bot className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">AI Assistant</h4>
                <p className="text-[11px] text-slate-400">Groq & Gemini + Roman Urdu</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center gap-3 hover:border-purple-500/30 transition-all hover:bg-white/[0.06]">
              <span className="p-2 rounded-lg bg-purple-500/15 text-purple-400">
                <Shield className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">Zero-Dummy Data</h4>
                <p className="text-[11px] text-slate-400">100% verified real database</p>
              </div>
            </div>
          </div>

          {/* Floating Metric Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/15 via-indigo-500/15 to-purple-500/10 border border-white/15 backdrop-blur-xl shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">Enterprise Security Grade</div>
                <div className="text-sm font-bold text-white">Bcrypt 72-Byte Truncation + JWT HS256</div>
              </div>
            </div>
            <span className="text-xs text-sky-300 font-mono font-semibold">Active</span>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between border-t border-white/10 pt-4 mt-2">
          <span>HCM Lite Platform • Saylani AI Hackathon</span>
          <span>Asia/Karachi (PKT) UTC+5</span>
        </div>
      </div>

      {/* ================= RIGHT HALF: SPLIT FORM PANEL ================= */}
      <div className="relative flex flex-col justify-start lg:justify-center items-center p-6 sm:p-10 lg:p-12 xl:p-16 overflow-y-auto z-10">
        <div className="w-full max-w-md space-y-6 relative z-10 py-6">
          {/* Mobile Header Branding (visible only on mobile/tablet) */}
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-600 text-white font-black text-xl shadow-lg shadow-sky-500/20 mb-2">
              HL
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">HCM Lite</h2>
            <p className="text-xs text-slate-400">Next-Gen AI Human Capital Management</p>
          </div>

          {/* Form Header */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {activeTab === 'signin' ? 'Welcome Back' : 'Initialize Enterprise'}
            </h2>
            <p className="text-sm text-slate-400 mt-1.5">
              {activeTab === 'signin'
                ? 'Sign in with your enterprise credentials to access your personalized workspace.'
                : 'First-run detected. Set up your company profile and primary Administrator account.'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex p-1 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'signin'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('setup');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'setup'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>First-Run Setup</span>
              {setupRequired && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
          </div>

          {/* Setup Alert Banner if needed */}
          {setupRequired && activeTab === 'signin' && (
            <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Empty database detected.</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('setup')}
                className="font-bold underline text-sky-300 hover:text-white ml-2"
              >
                Setup Admin
              </button>
            </div>
          )}

          {/* ================= FORM 1: SIGN IN ================= */}
          {activeTab === 'signin' && (
            <GlassCard variant="panel" className="p-6 sm:p-8 shadow-2xl border-white/15">
              <form onSubmit={handleLogin} className="space-y-5">
                {setupSuccessMessage && (
                  <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white mb-0.5">Setup Initialized Successfully</div>
                      <span>{setupSuccessMessage}</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold animate-in shake">
                    {error}
                  </div>
                )}

                {/* Email Field */}
                <div>
                  <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Official Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      id="login-email"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="e.g. admin@hcmlite.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/15 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Password Field with Functional Eye Icon Toggle */}
                <div>
                  <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/15 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-3 py-3.5 text-sm font-bold shadow-lg shadow-sky-500/25"
                  isLoading={isLoading}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Sign In to Workspace
                </Button>
              </form>

              {/* RBAC Scope Pills */}
              <div className="mt-6 pt-5 border-t border-white/10 text-center">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block mb-2">
                  Unified Access Portal
                </span>
                <div className="flex justify-center gap-2 text-[11px]">
                  <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium">
                    Admin
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium">
                    HR Specialist
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                    Employee
                  </span>
                </div>
              </div>
            </GlassCard>
          )}

          {/* ================= FORM 2: FIRST-RUN SETUP ================= */}
          {activeTab === 'setup' && (
            <GlassCard variant="panel" className="p-6 sm:p-8 shadow-2xl border-white/15">
              <form onSubmit={handleSetup} className="space-y-4">
                {error && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold animate-in shake">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="setup-company" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Company Name
                  </label>
                  <input
                    id="setup-company"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="e.g. Acme Corporation"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label htmlFor="setup-admin-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Administrator Full Name
                  </label>
                  <input
                    id="setup-admin-name"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="e.g. System Administrator"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label htmlFor="setup-admin-email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Admin Email Address
                  </label>
                  <input
                    id="setup-admin-email"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="e.g. admin@acmetech.app"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />

                  {/* Email Requirement Checklist - only shown if user typed something */}
                  {adminEmail.length > 0 && (
                    <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5 animate-in fade-in duration-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Email Requirement
                      </div>
                      <div className="flex flex-col gap-1 text-xs">
                        <div className={`flex items-center gap-2 ${hasPrefix ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}`}>
                          {hasPrefix ? (
                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                              <X className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                          <span>Contains username with <span className="font-mono font-semibold text-white">@</span></span>
                        </div>
                        <div className={`flex items-center gap-2 ${endsWithApp ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}`}>
                          {endsWithApp ? (
                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                              <X className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                          <span>Ends with <span className="font-mono font-semibold text-white">.app</span> (e.g. admin@acmetech.app)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="setup-admin-password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Set Master Password
                  </label>
                  <div className="relative">
                    <input
                      id="setup-admin-password"
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      placeholder="Create master password..."
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/15 rounded-xl pl-4 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      {showAdminPassword ? (
                        <EyeOff className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Password Checklist with dynamic Green/Red - ONLY SHOWN WHEN USER HAS ENTERED TEXT */}
                  {adminPassword.length > 0 && (
                    <div className="mt-2.5 p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Password Requirements Checklist
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {passwordChecks.map((chk) => (
                          <div
                            key={chk.id}
                            className={`flex items-center gap-2 text-xs transition-colors py-0.5 ${
                              chk.valid ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'
                            }`}
                          >
                            {chk.valid ? (
                              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                                <X className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                            <span>{chk.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-3 py-3.5 text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                  isLoading={isLoading}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  Initialize Enterprise
                </Button>
              </form>
            </GlassCard>
          )}

          {/* Security Assurance */}
          <div className="text-center pt-2">
            <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              Zero-Dummy Guarantee • ISO-compliant Role-Based Access Control
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
