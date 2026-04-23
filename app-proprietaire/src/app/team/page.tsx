"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getAuthClient } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import ExecutiveCard from "@/components/ExecutiveCard";

export default function TeamPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const api = getAuthClient();
      const resp = await api.get("/api/proprietaire/staff/");
      setData(resp.data);
    } catch (err) {
      console.error("Erreur chargement staff:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Trouver le "Top Performer" du jour
  const topPerformerId = useMemo(() => {
    if (!data?.staff || data.staff.length === 0) return null;
    return [...data.staff].sort((a, b) => b.sales_impact - a.sales_impact)[0].id;
  }, [data]);

  if (!isMounted) return null;

  return (
    <div className="bg-[#f2f4f7] min-h-screen pb-40 font-sans selection:bg-orange-500/20">
      {/* Dynamic Header */}
      <header className="px-8 pt-12 pb-8 bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-slate-100 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-600">
               Live Operations
            </span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Votre Équipe</h1>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined text-xl">sync</span>
        </button>
      </header>

      <main className="px-8 mt-8 space-y-8 max-w-5xl mx-auto">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-orange-500 rounded-full animate-spin"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Déploiement du Staff Deck...</span>
          </div>
        ) : (
          <>
            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {data?.staff?.length === 0 ? (
                <div className="col-span-full py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center gap-4 text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-200">group_off</span>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aucun membre d&apos;équipage actif</p>
                </div>
              ) : data?.staff?.map((server: any) => {
                const isTop = server.id === topPerformerId && server.sales_impact > 0;
                return (
                  <ExecutiveCard 
                    key={server.id} 
                    variant="white" 
                    className={`relative overflow-hidden group border-2 transition-all ${isTop ? 'border-orange-500/30' : 'border-transparent'}`}
                  >
                    {isTop && (
                      <div className="absolute -right-12 -top-12 w-32 h-32 bg-orange-500/10 rounded-full flex items-end justify-center pb-4 rotate-45">
                        <span className="material-symbols-outlined text-orange-600 -rotate-45" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100 shadow-inner group-hover:scale-105 transition-transform">
                            {server.photo_profil ? (
                              <img src={server.photo_profil} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-slate-200 text-3xl">account_circle</span>
                            )}
                          </div>
                          <span className={`absolute -bottom-1 -right-1 w-5 h-5 border-4 border-white rounded-full ${
                            server.status === 'ACTIVE' ? 'bg-green-500' : 
                            server.status === 'BREAK' ? 'bg-orange-500' : 'bg-slate-300'
                          }`}></span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-black text-slate-900 leading-none">{server.name}</h3>
                            {isTop && <span className="text-[10px] font-black text-orange-600 italic tracking-tighter">Top Gun</span>}
                          </div>
                          <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mt-1 block">{server.role}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-slate-50/50 rounded-3xl p-5 border border-slate-100/50">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Tables Actives</span>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{server.tables_count}</p>
                      </div>
                      <div className="bg-[#FF5E00]/5 rounded-3xl p-5 border border-orange-500/10">
                        <span className="text-[9px] font-black uppercase tracking-widest text-orange-600/50 block mb-1">Impact Ventes</span>
                        <p className="text-3xl font-black text-orange-600 tracking-tighter">${server.sales_impact.toFixed(0)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100">
                        <span className="material-symbols-outlined text-[14px] text-slate-400">timer</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Service: {server.active_time}</span>
                      </div>
                      <button className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-300 hover:text-orange-600 transition-all">
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                      </button>
                    </div>
                  </ExecutiveCard>
                );
              })}
            </div>

            {/* Global Performance Section */}
            <section className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-10 w-40 h-40 bg-orange-500/10 blur-[80px] rounded-full group-hover:bg-orange-500/20 transition-all duration-700"></div>
                
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-10 flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  Metriques de la Flotte
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3">Chiffre d&apos;Affaires / Heure</span>
                        <div className="flex items-baseline gap-3">
                            <span className="text-5xl font-black tracking-tighter">${data?.global_stats?.avg_sales_per_hour}</span>
                            <div className="flex items-center gap-1 text-green-400">
                              <span className="material-symbols-outlined text-sm">trending_up</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">+14%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col justify-end">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Capacité de Service</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#FF5E00]">{data?.global_stats?.occupancy_rate}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="bg-gradient-to-r from-orange-600 to-orange-400 h-full rounded-full transition-all duration-1000" 
                              style={{ width: `${data?.global_stats?.occupancy_rate}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </section>
          </>
        )}
      </main>

      <BottomNav activePage="team" />
    </div>
  );
}
