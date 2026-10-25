import React, { useState, useEffect } from 'react';
import {
  Users, KeyRound, Plus, Shield, Search, CheckCircle2, XCircle,
  Copy, Check, X, AlertTriangle, Eye, EyeOff, Lock, Mail, User as UserIcon
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from '../components/common/GlassCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

interface UserAccount {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  full_name?: string;
  employee_id?: number;
  created_at?: string;
}

export const UserManagementPage: React.FC = () => {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Create HR Modal states
  const [showCreateHRModal, setShowCreateHRModal] = useState(false);
  const [hrFullName, setHrFullName] = useState('');
  const [hrEmail, setHrEmail] = useState('');
  const [hrPassword, setHrPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creatingHR, setCreatingHR] = useState(false);
  const [hrError, setHrError] = useState<string | null>(null);

  // Reset Password Modal states
  const [resetModalData, setResetModalData] = useState<{ email: string; tempPass: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Live password security checks
  const passHasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(hrPassword);
  const passHasNumber = /\d/.test(hrPassword);
  const passHasUpper = /[A-Z]/.test(hrPassword);
  const passHasLower = /[a-z]/.test(hrPassword);
  const passHasLength = hrPassword.length >= 8;
  const isPasswordValid = passHasSpecial && passHasNumber && passHasUpper && passHasLower && passHasLength;

  const emailClean = hrEmail.trim().toLowerCase();
  const isEmailValid = emailClean.includes('@') && emailClean.endsWith('.app') && emailClean.split('@')[0].trim().length > 0;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getUsers();
      setUsers(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || err?.message || 'Unable to load users list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateHR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid) {
      setHrError('Email address must contain "@" and end with .app (e.g. hr_specialist@acmetech.app)');
      return;
    }
    if (!isPasswordValid) {
      setHrError('Please meet all the password security requirements below.');
      return;
    }

    try {
      setCreatingHR(true);
      setHrError(null);
      await api.createHR({
        email: emailClean,
        password: hrPassword,
        full_name: hrFullName.trim() || 'HR Specialist'
      });
      setShowCreateHRModal(false);
      setHrFullName('');
      setHrEmail('');
      setHrPassword('');
      fetchUsers();
    } catch (err: any) {
      setHrError(err?.response?.data?.detail?.message || err?.message || 'Failed to create HR account.');
    } finally {
      setCreatingHR(false);
    }
  };

  const handleToggleActive = async (targetUser: UserAccount) => {
    try {
      setActionLoadingId(targetUser.id);
      if (targetUser.is_active) {
        if (!window.confirm(`Deactivate login for ${targetUser.email}? They will be immediately signed out.`)) return;
        await api.deactivateUser(targetUser.id);
      } else {
        await api.activateUser(targetUser.id);
      }
      fetchUsers();
    } catch (err: any) {
      alert(err?.response?.data?.detail?.message || 'Failed to update user status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetPassword = async (targetUser: UserAccount) => {
    if (!window.confirm(`Reset password for ${targetUser.email}? A temporary password will be generated and their current session will be terminated.`)) {
      return;
    }

    try {
      setActionLoadingId(targetUser.id);
      const res = await api.resetUserPassword(targetUser.id);
      setResetModalData({
        email: res.email,
        tempPass: res.temporary_password
      });
      setCopied(false);
      fetchUsers();
    } catch (err: any) {
      alert(err?.response?.data?.detail?.message || 'Failed to reset password.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = () => {
    if (resetModalData?.tempPass) {
      navigator.clipboard.writeText(resetModalData.tempPass);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role.toUpperCase() === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-['Montserrat']">
                User Logins & Access Control
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-['Montserrat']">
                Manage system credentials for Admin, HR Specialists, and Employees.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            setHrError(null);
            setShowCreateHRModal(true);
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/20 py-2.5 px-4 rounded-xl"
        >
          <Plus className="w-4 h-4" />
          <span>Create HR Login</span>
        </Button>
      </div>

      {/* Info Notice Banner */}
      <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-3.5">
        <Shield className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
        <div className="text-xs sm:text-sm text-slate-300 space-y-1">
          <p className="font-semibold text-sky-300">Role-Based Access & Security Rules:</p>
          <p className="text-slate-400">
            • <b>HR Specialists</b> are provisioned directly by the System Admin using this page.<br />
            • <b>Employee Logins</b> are automatically created when HR registers an employee in the Directory.<br />
            • You can deactivate any account to terminate access immediately, or reset credentials to issue a temporary password.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <GlassCard className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or email (e.g. hr@hmclite)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-all font-['Montserrat']"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Filter Role:</span>
          {['ALL', 'ADMIN', 'HR', 'EMPLOYEE'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                roleFilter === r
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Users Table */}
      <GlassCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
            <p className="text-xs font-mono">Loading user credentials...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
            <p>{error}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No matching login accounts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs text-slate-400 uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">User / Name</th>
                  <th className="py-3.5 px-4 font-semibold">Email Address</th>
                  <th className="py-3.5 px-4 font-semibold">System Role</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(filteredUsers || []).map((u) => {
                  const isSelf = currentAdmin?.id === u.id;
                  const isLoadingAction = actionLoadingId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                            u.role === 'HR' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                            'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {(u.full_name || u.role)[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-white block">
                              {u.full_name || (u.role === 'ADMIN' ? 'System Administrator' : 'Staff Member')}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] text-sky-400 font-mono tracking-wider">(Current Session)</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-xs text-slate-300">
                        {u.email}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            u.role === 'ADMIN' ? 'primary' :
                            u.role === 'HR' ? 'info' : 'success'
                          }
                        >
                          {u.role}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {u.is_active ? 'Active' : 'Deactivated'}
                          </span>

                          {u.must_change_password && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Temp Password
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResetPassword(u)}
                            disabled={isLoadingAction}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1"
                            title="Generate a temporary password and revoke active session"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                            <span>Reset Password</span>
                          </button>

                          {!isSelf && (
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={isLoadingAction}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                u.is_active
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* CREATE HR SPECIALIST MODAL */}
      {showCreateHRModal && (
        <Modal
          isOpen={showCreateHRModal}
          onClose={() => setShowCreateHRModal(false)}
          title="Create HR Specialist Account"
        >
          <form onSubmit={handleCreateHR} className="space-y-4">
            {hrError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{hrError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Full Name of HR Specialist
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Ayesha Khan (HR Lead)"
                  value={hrFullName}
                  onChange={(e) => setHrFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-['Montserrat']"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Email Address
                </label>
                <span className={`text-[11px] font-mono ${isEmailValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Must end with .app
                </span>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. ayesha.hr@acmetech.app"
                  value={hrEmail}
                  onChange={(e) => setHrEmail(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border text-sm text-white placeholder-slate-500 focus:outline-none font-['Montserrat'] ${
                    hrEmail && !isEmailValid ? 'border-amber-500/50' : 'border-white/10 focus:border-sky-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Initial Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter strong password..."
                  value={hrPassword}
                  onChange={(e) => setHrPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-['Montserrat']"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Checklist with dynamic green/red ticks - ONLY SHOWN WHEN USER HAS ENTERED TEXT */}
              {hrPassword.length > 0 && (
                <div className="mt-2.5 p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Password Requirements Checklist
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
                    <div className={`flex items-center gap-2 py-0.5 ${passHasSpecial ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}`}>
                      <span className={`flex items-center justify-center w-4 h-4 rounded-full border shrink-0 ${passHasSpecial ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                        {passHasSpecial ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span>Special character (!@#$%^&*)</span>
                    </div>
                    <div className={`flex items-center gap-2 py-0.5 ${passHasNumber ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}`}>
                      <span className={`flex items-center justify-center w-4 h-4 rounded-full border shrink-0 ${passHasNumber ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                        {passHasNumber ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span>Number (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-2 py-0.5 ${passHasUpper ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}`}>
                      <span className={`flex items-center justify-center w-4 h-4 rounded-full border shrink-0 ${passHasUpper ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                        {passHasUpper ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span>Uppercase (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-2 py-0.5 ${passHasLower ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}`}>
                      <span className={`flex items-center justify-center w-4 h-4 rounded-full border shrink-0 ${passHasLower ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                        {passHasLower ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span>Lowercase (a-z)</span>
                    </div>
                    <div className={`flex items-center gap-2 py-0.5 col-span-1 sm:col-span-2 ${passHasLength ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}`}>
                      <span className={`flex items-center justify-center w-4 h-4 rounded-full border shrink-0 ${passHasLength ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                        {passHasLength ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span>Minimum 8 characters</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreateHRModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingHR || !isEmailValid || !isPasswordValid}
                className="bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-medium px-5"
              >
                {creatingHR ? 'Creating Account...' : 'Create HR Account'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* TEMPORARY PASSWORD COPY MODAL */}
      {resetModalData && (
        <Modal
          isOpen={!!resetModalData}
          onClose={() => setResetModalData(null)}
          title="Password Reset Successful"
        >
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-300">
              The login credentials for <span className="text-sky-300 font-mono font-semibold">{resetModalData.email}</span> have been reset.
            </p>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-sky-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Temporary Password</span>
                <span className="text-lg font-mono font-bold text-sky-400 tracking-wider">
                  {resetModalData.tempPass}
                </span>
              </div>
              <button
                onClick={copyToClipboard}
                className="p-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 transition-all flex items-center gap-1.5 text-xs font-semibold"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              ⚠️ <b>Notice:</b> This temporary password will only be shown once. The user will be required to change their password immediately upon next login.
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={() => setResetModalData(null)}
                className="bg-sky-500 hover:bg-sky-400 text-white font-medium px-5"
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default UserManagementPage;
