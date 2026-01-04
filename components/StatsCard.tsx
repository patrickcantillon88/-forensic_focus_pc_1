
import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ label, value, icon, trend, color = 'blue' }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 min-w-0">
      <div className={`p-2 rounded-lg shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] md:text-[10px] uppercase font-bold tracking-wider text-slate-400 leading-tight">
          {label}
        </p>
        <h3 className="text-base md:text-lg font-bold text-slate-900 leading-tight truncate">{value}</h3>
        {trend && (
          <p className="text-[9px] md:text-[10px] font-medium text-green-600 truncate leading-tight mt-0.5">
            {trend}
          </p>
        )}
      </div>
    </div>
  );
};
