import React, { useState, useEffect } from 'react';
import { Sun, Moon, Bell, LogOut, User as UserIcon, Shield, CheckCheck, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';
import { Notification } from '../../types';
import { apiFetch } from '../../services/api';

export const Header: React.FC = () => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      try {
        const notifs = await apiFetch<Notification[]>('/comms/notifications');
        setNotifications(notifs);
      } catch {
        // Silent failure for polling
      }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    try {
      for (const n of notifications.filter(n => !n.is_read)) {
        await apiFetch(`/comms/notifications/${n.id}/read`, { method: 'PATCH' });
      }
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      //
    }
  };

  const roleColors = {
    ADMIN: 'purple',
    HR: 'info',
    EMPLOYEE: 'success',
  } as const;

  return (
    <header className="sticky top-0 z-40 w-full h-16 border-b border-white/10 backdrop-blur-xl bg-slate-950/60 light:bg-white/80 light:border-slate-200 transition-colors">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Branding & Role */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-bold text-sm tracking-wider">
            HL
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white light:text-slate-900">
                HCM Lite
              </span>
              {user && (
                <Badge variant={roleColors[user.role] || 'neutral'} size="sm">
                  {user.role}
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-slate-400 light:text-slate-500 hidden sm:inline">
              Enterprise People Operations
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 light:text-slate-600 light:hover:text-slate-900 light:hover:bg-slate-100 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 light:text-slate-600 light:hover:text-slate-900 light:hover:bg-slate-100 transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-panel p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 light:border-slate-200">
                  <h4 className="font-semibold text-sm text-white light:text-slate-900">Notifications</h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No notifications yet.</p>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl text-xs transition-colors ${
                          n.is_read
                            ? 'bg-white/5 light:bg-slate-50 text-slate-400'
                            : 'bg-sky-500/10 text-slate-200 border border-sky-500/20'
                        }`}
                      >
                        <p className="font-semibold text-white light:text-slate-900 mb-0.5">{n.title}</p>
                        <p className="text-slate-300 light:text-slate-600">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Avatar with Hover Email Badge & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10 light:border-slate-200">
            <div className="relative group">
              <button
                type="button"
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-purple-500/20 hover:from-sky-500/30 hover:to-purple-500/30 text-sky-300 light:text-slate-800 light:bg-slate-100 flex items-center justify-center text-xs font-bold border border-white/15 light:border-slate-300 shadow-sm transition-all focus:outline-none"
                title="Account Details"
              >
                <UserIcon className="w-4 h-4 text-sky-400 light:text-sky-600" />
              </button>

              {/* Hover Tooltip Card showing Registered Email */}
              <div className="absolute right-0 top-full mt-2 w-72 p-3.5 glass-panel light:bg-white light:border-slate-300 shadow-2xl rounded-2xl opacity-0 translate-y-1 invisible group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                <div className="flex items-center gap-3 pb-2.5 mb-2.5 border-b border-white/10 light:border-slate-200">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {user?.employee_name ? user.employee_name.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-xs text-white light:text-slate-900 truncate">
                      {user?.employee_name || 'System User'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={roleColors[user?.role || 'EMPLOYEE'] || 'neutral'} size="sm">
                        {user?.role || 'EMPLOYEE'}
                      </Badge>
                      <span className="text-[10px] text-emerald-400 light:text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 light:text-slate-500 font-semibold uppercase tracking-wider block">
                    Registered Email
                  </span>
                  <div className="p-2 rounded-xl bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-sky-400 light:text-sky-600 shrink-0" />
                    <span className="text-xs font-mono font-medium text-sky-200 light:text-slate-800 break-all select-all">
                      {user?.email || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
