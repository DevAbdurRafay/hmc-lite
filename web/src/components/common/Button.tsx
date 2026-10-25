import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  icon?: React.ReactNode | React.ElementType;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const isCurrentlyLoading = isLoading || loading;

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg min-h-[36px]',
    md: 'px-4 py-2.5 text-sm rounded-xl min-h-[44px]',
    lg: 'px-6 py-3 text-base rounded-xl min-h-[48px]',
  };

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-medium shadow-lg shadow-sky-500/25 border border-sky-400/30',
    secondary:
      'bg-slate-800/80 hover:bg-slate-700/80 text-slate-100 font-medium border border-slate-700 shadow-sm light:bg-slate-200 light:text-slate-800 light:hover:bg-slate-300',
    danger:
      'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-medium shadow-lg shadow-red-500/20 border border-rose-400/30',
    ghost:
      'bg-transparent hover:bg-white/10 text-slate-300 hover:text-white light:text-slate-600 light:hover:bg-slate-100',
    glass:
      'bg-white/10 hover:bg-white/15 text-white backdrop-blur-md border border-white/20 shadow-glass light:bg-black/5 light:text-slate-800 light:hover:bg-black/10',
    outline:
      'bg-transparent hover:bg-slate-800/50 text-slate-200 border border-slate-700 hover:border-slate-500 light:text-slate-700 light:border-slate-300',
    success:
      'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/20 border border-emerald-400/30',
  };

  const renderIcon = () => {
    if (isCurrentlyLoading) {
      return <Loader2 className="w-4 h-4 animate-spin text-current" />;
    }
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as React.ElementType;
    return <IconComponent className="w-4 h-4 text-current" />;
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant] || variantClasses.primary} ${className}`}
      disabled={disabled || isCurrentlyLoading}
      {...props}
    >
      {renderIcon()}
      {children}
    </button>
  );
};

export default Button;
