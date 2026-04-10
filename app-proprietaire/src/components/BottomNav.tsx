"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface BottomNavProps {
  activePage: "dashboard" | "inventory" | "tables" | "team" | "reports";
}

export default function BottomNav({ activePage }: BottomNavProps) {
  const router = useRouter();

  const navItems = [
    { id: "dashboard", label: "Tableau", icon: "grid_view", path: "/" },
    { id: "inventory", label: "Stocks", icon: "liquor", path: "/inventory" },
    { id: "tables", label: "Tables", icon: "table_restaurant", path: "/tables" },
    { id: "team", label: "Équipe", icon: "groups", path: "/team" },
    { id: "reports", label: "Rapports", icon: "bar_chart_4_bars", path: "/reports" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white flex justify-around items-center px-4 pb-10 pt-4 rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.04)] z-50">
      {navItems.map((item) => {
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => item.path !== "#" && router.push(item.path)}
            className={`flex flex-col items-center justify-center p-2 transition-all active:scale-90 ${
              isActive 
                ? "bg-orange-50 text-[#FF5E00] rounded-2xl px-6" 
                : "opacity-30 text-[#1a1c1d]"
            }`}
          >
            <span 
              className="material-symbols-outlined text-2xl"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {item.icon}
            </span>
            <span className="text-[8px] font-black uppercase tracking-widest mt-1">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
