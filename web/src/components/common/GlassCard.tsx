import React from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'card' | 'panel';
  hoverLift?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'card',
  hoverLift = false,
  ...props
}) => {
  const baseClass = variant === 'panel' ? 'glass-panel' : 'glass-card';
  const hoverClass = hoverLift ? 'transition-all duration-300 hover:-translate-y-1 hover:shadow-glass-glow' : '';

  return (
    <div
      className={`${baseClass} p-5 sm:p-6 ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
