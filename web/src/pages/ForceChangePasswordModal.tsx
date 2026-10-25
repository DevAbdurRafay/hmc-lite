import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Check, X, Eye, EyeOff, Lock } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';

export const ForceChangePasswordModal: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Eye toggle states for each password field
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!user || !user.must_change_password) return null;

  // Live password security checks
  const passwordChecks = [
    { id: 'spec', label: 'Special character (!@#$%^&*...)', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(newPassword) },
    { id: 'num', label: 'Number (0-9)', valid: /[0-9]/.test(newPassword) },
    { id: 'upper', label: 'Uppercase letter (A-Z)', valid: /[A-Z]/.test(newPassword) },
    { id: 'lower', label: 'Lowercase letter (a-z)', valid: /[a-z]/.test(newPassword) },
    { id: 'len', label: 'Minimum 8 characters', valid: newPassword.length >= 8 },
  ];
  const isPasswordValid = passwordChecks.every((c) => c.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      setError('Please fulfill all password security requirements in the checklist below.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {}} // Cannot be dismissed without changing password!
      title="Change Temporary Password"
      subtitle="For security, you must set a new permanent password on your first sign-in."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Temporary Password Field with Eye Icon */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Temporary Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full glass-input pl-10 pr-11 py-2.5 text-sm"
              placeholder="Enter temporary password provided by HR"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
            >
              {showCurrentPassword ? (
                <EyeOff className="w-4 h-4 text-sky-400" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* New Password Field with Eye Icon */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type={showNewPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full glass-input pl-10 pr-11 py-2.5 text-sm"
              placeholder="Create a strong password"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
            >
              {showNewPassword ? (
                <EyeOff className="w-4 h-4 text-sky-400" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Password Requirements Checklist with dynamic green/red */}
          <div className="mt-2.5 p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Password Requirements Checklist
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isPasswordValid
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {isPasswordValid ? 'All Met' : 'Incomplete'}
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
        </div>

        {/* Confirm Password Field with Eye Icon */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full glass-input pl-10 pr-11 py-2.5 text-sm"
              placeholder="Re-type new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4 text-sky-400" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {/* Match indicator */}
          {confirmPassword.length > 0 && (
            <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${
              newPassword === confirmPassword ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {newPassword === confirmPassword ? (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                  <Check className="w-2.5 h-2.5" />
                </span>
              ) : (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 shrink-0">
                  <X className="w-2.5 h-2.5" />
                </span>
              )}
              <span>{newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}</span>
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          isLoading={isLoading}
          icon={<KeyRound className="w-4 h-4" />}
        >
          Save Permanent Password & Continue
        </Button>
      </form>
    </Modal>
  );
};
