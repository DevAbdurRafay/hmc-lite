import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode | React.ElementType;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No data yet",
  description = "No data yet — records appear as people use the app.",
  action,
  icon = Inbox,
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComponent = icon as React.ElementType;
    return <IconComponent className="w-12 h-12 text-slate-500/80 stroke-1" />;
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-white/10 light:border-slate-300">
      <div className="p-4 rounded-2xl bg-white/5 light:bg-slate-100 mb-4">
        {renderIcon()}
      </div>
      <h4 className="text-base font-semibold text-white light:text-slate-900 mb-1">
        {title}
      </h4>
      <p className="text-sm text-slate-400 light:text-slate-500 max-w-sm mb-5">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
