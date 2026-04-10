"use client";

import React from "react";

interface DateFilterProps {
  currentValue: number;
  onChange: (days: number) => void;
}

export default function DateFilter({ currentValue, onChange }: DateFilterProps) {
  const options = [
    { label: "Aujourd'hui", value: 1 },
    { label: "7 jours", value: 7 },
    { label: "30 jours", value: 30 },
    { label: "90 jours", value: 90 },
  ];

  return (
    <div className="flex bg-slate-100 p-1 rounded-2xl w-full max-w-md mx-auto">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 ${
            currentValue === option.value
              ? "bg-white text-[#FF5E00] shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
