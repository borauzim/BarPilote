"use client";

import React, { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import ExecutiveCard from "@/components/ExecutiveCard";
import BigMetric from "@/components/BigMetric";
import DateFilter from "@/components/DateFilter";
import { 
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function ReportsPage() {
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
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            const resp = await fetch(`${apiUrl}/api/proprietaire/reports/?days=${days}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setStats(data);
            }
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    if (!isMounted) return null;

    return (
        <div className="bg-[#f8f9fa] min-h-screen pb-40">
            {/* Header / Date Selector */}
            <header className="px-6 pt-10 pb-6 bg-white shadow-sm space-y-6">
                <div className="flex justify-between items-end">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF5E00] mb-1 block">Analyses Exécutives</span>
                        <h1 className="text-3xl font-black text-[#1a1c1d]">Rapports</h1>
                    </div>
                </div>
                <DateFilter currentValue={days} onChange={setDays} />
            </header>

            <main className="px-6 mt-6 space-y-6 transition-all duration-500">
                {isLoading ? (
                    <div className="py-20 text-center animate-pulse">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Synchronisation avec le cockpit...</span>
                    </div>
                ) : (
                    <>
                        {/* MAIN PERFORMANCE CHART */}
                        <ExecutiveCard subtitle="Analyse de Rentabilité" variant="white">
                            <BigMetric 
                                value={stats?.metrics?.net_margin || 0} 
                                label="Marge Nette de la Période" 
                                suffix="%" 
                                trend={{ value: 4.2, isUp: true }}
                            />
                            
                            <div className="h-48 w-full mt-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats?.weekly_trend}>
                                        <defs>
                                            <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="100%">
                                                <stop offset="5%" stopColor="#FF5E00" stopOpacity={0.15}/>
                                                <stop offset="95%" stopColor="#FF5E00" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <Tooltip 
                                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase'}}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="margin" 
                                            stroke="#FF5E00" 
                                            strokeWidth={4} 
                                            fillOpacity={1} 
                                            fill="url(#colorMargin)" 
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </ExecutiveCard>

                        {/* EXECUTIVE SUMMARY / AI INSIGHTS */}
                        <ExecutiveCard title="Résumé Exécutif" subtitle="Cockpit Intelligence" variant="dark">
                            <p className="text-xl font-medium leading-relaxed opacity-90 italic">
                                "{stats?.executive_summary}"
                            </p>
                            
                            <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/10">
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">COGS Reduc</p>
                                    <p className="text-lg font-black">{stats?.metrics?.cogs_reduction}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Perte</p>
                                    <p className="text-lg font-black">{stats?.metrics?.waste_factor}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Efficiency</p>
                                    <p className="text-lg font-black">{stats?.metrics?.labor_efficiency}</p>
                                </div>
                            </div>
                        </ExecutiveCard>

                        {/* CATEGORY LIST */}
                        <ExecutiveCard title="Performance par Catégorie" subtitle="Audit de Vente" variant="white">
                            <div className="space-y-6">
                                {stats?.category_breakdown?.map((cat: any) => (
                                    <div key={cat.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-[#FF5E00] transition-all">
                                                <span className="material-symbols-outlined">
                                                    {cat.category.toLowerCase().includes('cocktail') ? 'local_bar' : 'liquor'}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-[#1a1c1d]">{cat.category}</p>
                                                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                    {cat.isHighVolume ? 'Volume Élevé' : 'Croissance Stable'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-[#1a1c1d]">${cat.revenue}</p>
                                            <p className={`text-[10px] font-black ${cat.margin > 40 ? 'text-green-600' : 'text-[#FF5E00]'}`}>
                                                {cat.margin}% Marge
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ExecutiveCard>
                    </>
                )}
            </main>

            <BottomNav activePage="reports" />
        </div>
    );
}
