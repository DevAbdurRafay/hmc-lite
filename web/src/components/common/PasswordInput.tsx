import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Check, X } from 'lucide-react';

export interface PasswordRule {
  id: string;
  label: string;
  valid: boolean;
}

export function evaluatePasswordRules(password: string): {
  isValid: boolean;
  rules: PasswordRule[];
} {
  const rules: PasswordRule[] = [
    {
      id: 'spec',
      label: 'Special character (!@#$%^&*...)',
      valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password),
    },
    {
      id: 'num',
      label: 'Number (0-9)',
      valid: /[0-9]/.test(password),
    },
    {
      id: 'upper',
      label: 'Uppercase letter (A-Z)',
      valid: /[A-Z]/.test(password),
    },
    {
      id: 'lower',
      label: 'Lowercase letter (a-z)',
      valid: /[a-z]/.test(password),
    },
    {
      id: 'len',
      label: 'Minimum 8 characters',
      valid: password.length >= 8,
    },
  ];

  return {
    isValid: rules.every((r) => r.valid),
    rules,
  };
}

interface PasswordInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  autoComplete?: string;
  showChecklist?: boolean;
  className?: string;
  inputClassName?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = 'Enter password...',
  label,
  required = true,
  autoComplete = 'current-password',
  showChecklist = false,
  className = '',
  inputClassName = '',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const { rules } = evaluatePasswordRules(value);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Input Field with Eye Icon */}
      <div className="relative">
        <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-white/[0.04] border border-white/15 rounded-xl pl-10 pr-11 py-2.5 sm:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-400"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4 text-sky-400" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Dynamic Green/Red Password Requirements Checklist - ONLY shown when input has value */}
      {showChecklist && value.length > 0 && (
        <div className="mt-2.5 p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Password Requirements Checklist
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center gap-2 text-xs transition-colors py-0.5 ${
                  rule.valid ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'
                }`}
              >
                {rule.valid ? (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                    <X className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
