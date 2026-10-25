import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' | 'primary' | 'secondary';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
  };

  const variantClasses = {
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    info: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
    purple: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    neutral: 'bg-slate-700/30 text-slate-300 border border-slate-600/40',
    primary: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
    secondary: 'bg-slate-700/30 text-slate-300 border border-slate-600/40',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full backdrop-blur-md ${sizeClasses[size]} ${variantClasses[variant] || variantClasses.neutral} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
      {children}
    </span>
  );
};

export default Badge;
