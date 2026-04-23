"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthClient } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import ExecutiveCard from "@/components/ExecutiveCard";
import BigMetric from "@/components/BigMetric";
import DateFilter from "@/components/DateFilter";
import { 
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function ReportsPage() {
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [days, setDays] = useState(30);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isMounted) {
            fetchReport();
        }
    }, [days, isMounted]);

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const api = getAuthClient();
            const resp = await api.get(`/api/proprietaire/reports/?days=${days}`);
            setStats(resp.data);
        } catch (err: any) { 
            console.error(err); 
            if (err.response?.status === 401) router.push("/auth/login");
        } finally { setIsLoading(false); }
    };

    if (!isMounted) return null;

    return (
        <div className="bg-[#f2f4f7] min-h-screen pb-40 font-sans selection:bg-orange-500/20">
            {/* AUDIT HEADER */}
            <header className="px-8 pt-12 pb-8 bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-100 space-y-8">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 mb-1 text-orange-600">
                           <span className="material-symbols-outlined text-sm">analytics</span>
                           <span className="text-[10px] font-black uppercase tracking-[0.3em]">Intelligence Analytique</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Rapports d&apos;Audit</h1>
                    </div>
                </div>
                <DateFilter currentValue={days} onChange={setDays} />
            </header>

            <main className="px-8 mt-10 space-y-10 max-w-5xl mx-auto">
                {isLoading ? (
                    <div className="py-24 flex flex-col items-center justify-center space-y-4">
                        <div className="w-10 h-10 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Compilation des insights financiers...</span>
                    </div>
                ) : (
                    <>
                        {/* PROFITABILITY CHART */}
                        <ExecutiveCard variant="white" className="shadow-2xl shadow-slate-200 border-none relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 blur-[60px] rounded-full"></div>
                            
                            <div className="relative z-10">
                                <BigMetric 
                                    value={stats?.metrics?.net_margin || 0} 
                                    label="Marge Nette de la Période" 
                                    suffix="%" 
                                    trend={{ value: 4.2, isUp: true }}
                                />
                                
                                <div className="h-56 w-full mt-10 -ml-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats?.weekly_trend || []}>
                                            <defs>
                                                <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.15}/>
                                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <Tooltip 
                                                contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase'}}
                                                formatter={(value: any) => [`${value}%`, 'Marge Net']}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="margin" 
                                                stroke="#f97316" 
                                                strokeWidth={5} 
                                                fillOpacity={1} 
                                                fill="url(#colorMargin)" 
                                                animationDuration={2000}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between mt-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-300">
                                    <span>Début Période</span>
                                    <span>Évolution</span>
                                    <span className="text-orange-600">Audit Final</span>
                                </div>
                            </div>
                        </ExecutiveCard>

                        {/* EXECUTIVE SUMMARY / AI INSIGHTS */}
                        <ExecutiveCard variant="dark" className="shadow-2xl shadow-black/10">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-orange-500">
                                    <span className="material-symbols-outlined text-lg animate-pulse">psychology</span>
                                </div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Résumé Stratégique</h3>
                            </div>
                            
                            <p className="text-2xl font-black text-white leading-snug tracking-tight mb-10 selection:bg-orange-500/20">
                                &ldquo;{stats?.executive_summary || "Analyse en cours..."}&rdquo;
                            </p>
                            
                            <div className="grid grid-cols-3 gap-8 pt-10 border-t border-white/5">
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">Réduc COGS</p>
                                    <p className="text-xl font-black text-orange-500">{stats?.metrics?.cogs_reduction || "---"}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">Waste Factor</p>
                                    <p className="text-xl font-black text-white">{stats?.metrics?.waste_factor || "---"}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">Efficience</p>
                                    <p className="text-xl font-black text-white">{stats?.metrics?.labor_efficiency || "---"}</p>
                                </div>
                            </div>
                        </ExecutiveCard>

                        {/* CATEGORY AUDIT */}
                        <section className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Performance par Catégorie</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {stats?.category_breakdown?.map((cat: any) => (
                                    <ExecutiveCard key={cat.category} variant="white" className="p-6 border-none shadow-sm hover:shadow-xl transition-all group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-all duration-500">
                                                    <span className="material-symbols-outlined text-2xl">
                                                        {cat.category.toLowerCase().includes('cocktail') ? 'local_bar' : 'liquor'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{cat.category}</p>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">
                                                        {cat.isHighVolume ? 'Volume Critique' : 'Volume Modéré'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-slate-900">${cat.revenue?.toLocaleString()}</p>
                                                <p className={`text-[10px] font-black tracking-widest uppercase mt-1 ${cat.margin > 40 ? 'text-teal-600' : 'text-orange-600'}`}>
                                                    {cat.margin}% Marge
                                                </p>
                                            </div>
                                        </div>
                                    </ExecutiveCard>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </main>

            <BottomNav activePage="reports" />
        </div>
    );
}
