"use client";

import React, { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import ExecutiveCard from "@/components/ExecutiveCard";
import BigMetric from "@/components/BigMetric";

export default function TeamPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    const token = getToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    try {
      const resp = await fetch(`${apiUrl}/api/proprietaire/staff/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const d = await resp.json();
        setData(d);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="bg-[#f8f9fa] min-h-screen pb-40">
      <header className="px-6 pt-10 pb-6 bg-white shadow-sm flex justify-between items-end">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF5E00] mb-1 block">
            Live Operations
          </span>
          <h1 className="text-3xl font-black text-[#1a1c1d]">Équipe</h1>
        </div>
        <button className="bg-gradient-to-br from-[#FF5E00] to-[#A63B00] text-white px-6 py-2.5 rounded-full font-bold text-[10px] shadow-lg shadow-orange-500/20 active:scale-95 transition-transform uppercase tracking-widest">
            Assign Shift
        </button>
      </header>

      <main className="px-6 mt-6 space-y-6">
        {isLoading ? (
            <div className="py-20 text-center animate-pulse">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Déploiement du Staff Deck...</span>
            </div>
        ) : (
          <>
            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data?.staff?.map((server: any) => (
                <ExecutiveCard key={server.id} variant="white" className="relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-50">
                            {server.photo ? (
                                <img src={server.photo} className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-slate-300">person</span>
                            )}
                        </div>
                        <span className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${
                            server.status === 'ACTIVE' ? 'bg-green-500' : 
                            server.status === 'BREAK' ? 'bg-orange-500' : 'bg-slate-300'
                        }`}></span>
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[#1a1c1d] leading-none mb-1">{server.name}</h3>
                        <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{server.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tables</span>
                        <p className="text-2xl font-black text-[#1a1c1d]">{server.tables_count}</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ventes</span>
                        <p className="text-2xl font-black text-[#FF5E00]">${server.sales_impact}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active {server.active_time}</span>
                    </div>
                    <button className="text-[10px] font-black uppercase tracking-widest text-[#FF5E00] hover:underline">
                      Détails
                    </button>
                  </div>
                </ExecutiveCard>
              ))}
            </div>

            {/* Global Performance Section */}
            <section className="bg-[#1a1c1d] rounded-[2rem] p-8 text-white shadow-xl">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-8">Performance Globale</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Ventes Moyennes / Heure</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black">${data?.global_stats?.avg_sales_per_hour}</span>
                            <span className="text-xs font-black text-[#FF5E00]">High Volume</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Taux d'Occupation</span>
                        <div className="w-full bg-white/10 h-2 rounded-full mt-3 overflow-hidden">
                            <div className="bg-[#FF5E00] h-full rounded-full" style={{ width: `${data?.global_stats?.occupancy_rate}%` }}></div>
                        </div>
                        <p className="text-[10px] font-black mt-2 text-white/60 tracking-widest uppercase">{data?.global_stats?.occupancy_rate}% de Capacité</p>
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
