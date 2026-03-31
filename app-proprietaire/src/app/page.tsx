"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="bg-[#f8f9fa] min-h-screen text-[#1a1c1d] font-sans pb-32">
      {/* NEW HEADER - MATCHING MOCKUP */}
      <header className="px-6 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-orange-500 overflow-hidden shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=100"
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-xl font-black tracking-tight text-[#FF5E00]">BarPilote</span>
        </div>
        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-2xl">settings</span>
        </button>
      </header>

      <main className="px-6 mt-10 space-y-6">
        {/* TITLE & LIVE TAG */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Aperçu en temps réel</p>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight mb-4 text-[#1a1c1d]">
            Analytique des Ventes
          </h1>
          <div className="inline-flex items-center gap-2 bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
            <span className="w-2 h-2 bg-[#FF5E00] rounded-full animate-pulse"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Session en Direct</span>
          </div>
        </section>

        {/* MAIN REVENUE CARD */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.03)] border border-slate-50 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Revenu Net</span>
            <div className="text-right">
              <div className="flex items-center gap-1 text-[#FF5E00] font-black">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span className="text-lg">+12.4%</span>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-300">vs hier soir</p>
            </div>
          </div>
          <h2 className="text-5xl font-black tracking-tighter mb-4">$4,820.50</h2>

          {/* PIC CALLOUT */}
          <div className="flex justify-center mb-8">
            <div className="bg-[#FF5E00] text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg relative group">
              Pic: $1,240 (23h)
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-6 bg-[#FF5E00]/30"></div>
            </div>
          </div>

          {/* CHART VISUAL (SVG) */}
          <div className="h-32 w-full mt-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
              <path
                d="M0 35 Q 20 32, 40 30 T 55 15 T 70 20 T 100 25"
                fill="none"
                stroke="#FF5E00"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="55" cy="15" r="3" fill="#FF5E00" className="animate-pulse" />
            </svg>
          </div>

          {/* TIME LABELS */}
          <div className="flex justify-between mt-4 text-[9px] font-bold uppercase tracking-widest text-slate-300 px-2">
            <span>6 PM</span>
            <span>8 PM</span>
            <span>10 PM</span>
            <span className="text-[#FF5E00]">PIC</span>
            <span>12 AM</span>
            <span>2 AM</span>
          </div>
        </section>

        {/* BEST SELLER CARD */}
        <section className="bg-[#FF5E00] rounded-[2rem] p-8 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden group active:scale-[0.98] transition-all">
          <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[120px] absolute -right-4 -bottom-4 rotate-12">liquor</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Meilleure Vente</p>
          <h3 className="text-3xl font-black tracking-tight mb-4">Heineken</h3>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-black tracking-tighter leading-none">45</span>
            <p className="text-[11px] font-bold uppercase tracking-tight leading-4 opacity-80 mb-1">Unités Vendues<br />Aujourd&apos;hui</p>
          </div>
        </section>

        {/* PERFORMANCE SESSION CARD */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-50">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-6">Performance de la Session</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                  <span className="material-symbols-outlined">groups</span>
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fréquentation</span>
              </div>
              <span className="text-sm font-black">342 Clients</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                  <span className="material-symbols-outlined">payments</span>
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Panier Moyen</span>
              </div>
              <span className="text-sm font-black">$14.10</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                  <span className="material-symbols-outlined">hourglass_top</span>
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Attente Max</span>
              </div>
              <span className="text-sm font-black">4.2 min</span>
            </div>
          </div>
          <button className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest mt-8 hover:bg-slate-200 transition-colors">
            View Detailed Log
          </button>
        </section>

        {/* INVENTORY / PROGRESS SECTIONS */}
        <div className="space-y-4">
          {/* BIERES */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-50">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-4">Inventaire Bières</p>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold">Blondes</span>
              <span className="text-xs font-black text-[#FF5E00]">12%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-[#FF5E00] rounded-full w-[12%]"></div>
            </div>
            <p className="text-[10px] font-bold text-red-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">warning</span>
              Alerte Stock Faible
            </p>
          </div>

          {/* SPIRITUEUX */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-50">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-4">Stock Spiritueux</p>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold">Bourbon</span>
              <span className="text-xs font-black">88%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-[#FF5E00] rounded-full w-[88%]"></div>
            </div>
            <p className="text-[10px] font-bold text-emerald-600">Niveaux sains</p>
          </div>

          {/* RENDEMENT COCKTAILS */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-50">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-4">Rendement Cocktails</p>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold">Efficacité</span>
              <span className="text-xs font-black">94%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-[#FF5E00] rounded-full w-[94%] shadow-[0_0_10px_rgba(255,94,0,0.3)]"></div>
            </div>
            <p className="text-[10px] font-bold text-slate-400">+2% par rapport à la base</p>
          </div>

          {/* PERTES */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-50">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-4">Suivi des Pertes</p>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold">% Perte</span>
              <span className="text-xs font-black">0.8%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-[#FF5E00] rounded-full w-[10%] opacity-40"></div>
            </div>
            <p className="text-[10px] font-bold text-slate-400">Coulage minimal</p>
          </div>
        </div>
      </main>

      {/* BOTTOM NAV - MATCHING MOCKUP */}
      <nav className="fixed bottom-0 left-0 w-full bg-white flex justify-around items-center px-4 pb-10 pt-4 rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.04)] z-50">
        <button
          onClick={() => router.push("/")}
          className="flex flex-col items-center justify-center p-2 opacity-30 active:scale-90 transition-all"
        >
          <span className="material-symbols-outlined text-2xl">grid_view</span>
          <span className="text-[8px] font-black uppercase tracking-widest mt-1">Tableau</span>
        </button>
        <button
          onClick={() => router.push("/inventory")}
          className="flex flex-col items-center justify-center p-2 opacity-30 active:scale-90 transition-all"
        >
          <span className="material-symbols-outlined text-2xl">liquor</span>
          <span className="text-[8px] font-black uppercase tracking-widest mt-1">Stocks</span>
        </button>
        <button
          className="flex flex-col items-center justify-center p-2 opacity-30 active:scale-90 transition-all"
        >
          <span className="material-symbols-outlined text-2xl">groups</span>
          <span className="text-[8px] font-black uppercase tracking-widest mt-1">Équipe</span>
        </button>
        <button
          className="flex flex-col items-center justify-center p-2 active:scale-90 transition-all bg-orange-50 text-[#FF5E00] rounded-2xl px-6"
        >
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart_4_bars</span>
          <span className="text-[8px] font-black uppercase tracking-widest mt-1">Rapports</span>
        </button>
      </nav>
    </div>
  );
}
