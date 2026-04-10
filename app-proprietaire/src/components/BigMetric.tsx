"use client";

import React from "react";

interface BigMetricProps {
  value: string | number;
  label: string;
  trend?: {
    value: string | number;
    isUp: boolean;
  };
  prefix?: string;
  suffix?: string;
  className?: string;
}

export default function BigMetric({
  value,
  label,
  trend,
  prefix = "",
  suffix = "",
  className = ""
}: BigMetricProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-6xl font-black tracking-tighter text-[#1a1c1d]">
          {prefix}{value}{suffix}
        </span>
        {trend && (
          <span className={`text-xs font-black flex items-center gap-0.5 ${trend.isUp ? 'text-green-600' : 'text-red-500'}`}>
            <span className="material-symbols-outlined text-sm">
              {trend.isUp ? 'trending_up' : 'trending_down'}
            </span>
            {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
