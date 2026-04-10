"use client";

import React from "react";

interface ExecutiveCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  variant?: "white" | "dark" | "glass";
  onClick?: () => void;
}

export default function ExecutiveCard({ 
  children, 
  title, 
  subtitle, 
  className = "",
  variant = "white",
  onClick
}: ExecutiveCardProps) {
  
  const baseStyles = "rounded-[2rem] p-8 transition-all duration-300";
  
  const variants = {
    white: "bg-white shadow-[0_10px_30px_rgba(26,28,29,0.04)] border border-slate-50",
    dark: "bg-[#1a1c1d] text-white shadow-xl shadow-black/10",
    glass: "bg-white/40 backdrop-blur-xl border border-white/20 shadow-lg"
  };

  return (
    <div 
      className={`${baseStyles} ${variants[variant]} ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {(title || subtitle) && (
        <div className="mb-6">
          {subtitle && (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">
              {subtitle}
            </span>
          )}
          {title && (
            <h3 className={`text-lg font-black ${variant === 'dark' ? 'text-white' : 'text-[#1a1c1d]'}`}>
              {title}
            </h3>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
