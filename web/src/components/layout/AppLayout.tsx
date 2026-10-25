import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarCheck, Clock,
  FileText, ShieldAlert, Megaphone, Sparkles,
  Menu, X, Building2, ChevronRight, KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Header } from './Header';
import { AIChatDrawer } from '../ai/AIChatDrawer';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const location = useLocation();

  if (!user) return null;

  const role = user.role?.toUpperCase();

  // Define navigation links based on role
  const adminNav = [
    { label: 'Executive Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'User Logins & HR', path: '/users', icon: KeyRound },
    { label: 'Organization Setup', path: '/org-setup', icon: Building2 },
    { label: 'Employees Directory', path: '/employees', icon: Users },
    { label: 'Attendance Board', path: '/attendance', icon: CalendarCheck },
    { label: 'Leave Requests', path: '/leaves', icon: Clock },
    { label: 'Monthly Payroll', path: '/payroll', icon: FileText },
    { label: 'Announcements', path: '/announcements', icon: Megaphone },
    { label: 'Audit Trail', path: '/audit', icon: ShieldAlert },
  ];

  const hrNav = [
    { label: 'HR Operations', path: '/hr', icon: LayoutDashboard },
    { label: 'Employee Registry & CSV', path: '/employees', icon: Users },
    { label: 'Attendance & Corrections', path: '/attendance', icon: CalendarCheck },
    { label: 'Leave Approvals', path: '/leaves', icon: Clock },
    { label: 'Payroll Drafts', path: '/payroll', icon: FileText },
    { label: 'Announcements', path: '/announcements', icon: Megaphone },
  ];

  const empNav = [
    { label: 'Personal Workspace', path: '/employee', icon: LayoutDashboard },
    { label: 'My Attendance Calendar', path: '/my-attendance', icon: CalendarCheck },
    { label: 'My Leaves & Quotas', path: '/my-leaves', icon: Clock },
    { label: 'My Payslips', path: '/my-payslips', icon: FileText },
    { label: 'Company Announcements', path: '/announcements', icon: Megaphone },
  ];

  const navItems = role === 'ADMIN' ? adminNav : role === 'HR' ? hrNav : empNav;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (hidden on mobile/tablet) */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-white/10 backdrop-blur-xl bg-slate-950/40 light:bg-white/50 p-4 transition-all">
          <div className="flex-1 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 light:text-slate-600 light:hover:text-slate-900 light:hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          {/* Quick AI Prompt Pill in Sidebar */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-sky-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300">AI Operations Assistant</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">Ask policy questions, analyze attendance, or draft leave.</p>
            <button
              onClick={() => setAiChatOpen(true)}
              className="w-full py-1.5 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs font-medium border border-purple-500/30 flex items-center justify-between"
            >
              <span>Open Assistant</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* Mobile / Tablet Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-[80vw] h-full glass-panel p-5 z-10 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                  <span className="font-bold text-base text-white">Menu Navigation</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                          isActive
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAiChatOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-sm font-medium border border-purple-500/30 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Ask AI Assistant</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          {/* Mobile menu trigger bar (< lg) */}
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card text-xs text-slate-300 font-medium min-h-[44px]"
            >
              <Menu className="w-4 h-4" />
              <span>Menu</span>
            </button>
            <button
              onClick={() => setAiChatOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-xs text-purple-300 font-medium min-h-[44px]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Chat</span>
            </button>
          </div>

          <Outlet />
        </main>
      </div>

      {/* Floating AI Button (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setAiChatOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 text-white font-medium shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
        >
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          <span className="hidden sm:inline text-sm font-semibold tracking-wide">Ask Assistant</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-300" />
          </span>
        </button>
      </div>

      {/* Slide-over AI Assistant Panel */}
      <AIChatDrawer isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
    </div>
  );
};
