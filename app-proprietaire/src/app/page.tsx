"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthClient, deleteToken } from "@/lib/auth";
import { 
  AreaChart, Area, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import BottomNav from "@/components/BottomNav";
import ExecutiveCard from "@/components/ExecutiveCard";

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchStats();
  }, []);

  const handleLogout = () => {
    deleteToken();
    router.push("/auth/login");
  };

  const fetchStats = async () => {
    try {
      const api = getAuthClient();
      const resp = await api.get("/api/proprietaire/dashboard/");
      
      const data = resp.data;
      setStats(data);
      
      // Persister les infos clés
      if (data.bar_info) {
        localStorage.setItem("bar_name", data.bar_info.nom || "");
        if (data.bar_info.code_invitation) {
          localStorage.setItem("bar_code_invitation", data.bar_info.code_invitation);
        }
      }
    } catch (err: any) {
      console.error("Dashboard Stats Error:", err);
      if (err.response?.status === 401) {
        router.push("/auth/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Initialisation du Cockpit...</p>
      </div>
    );
  }

  const mainRevenue = stats?.revenue?.usd > 0 || stats?.revenue?.cdf === 0 
    ? { val: stats?.revenue?.usd || 0, sym: "$" }
    : { val: stats?.revenue?.cdf || 0, sym: "FC" };

  return (
    <div className="bg-[#f2f4f7] min-h-screen text-slate-900 font-sans pb-40 selection:bg-orange-500/20">
      {/* PREMIUM HEADER */}
      <header className="px-8 pt-12 pb-8 bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-600 p-0.5 shadow-lg shadow-orange-500/20 overflow-hidden ring-4 ring-white">
            {stats?.bar_info?.logo ? (
              <img src={stats.bar_info.logo} className="w-full h-full object-cover rounded-[0.9rem]" alt="Logo Bar" />
            ) : (
              <div className="w-full h-full flex items-center justify-center flex-col">
                 <span className="material-symbols-outlined text-white text-2xl">rocket_launch</span>
              </div>
            )}
          </div>
          <div>
            <span className="text-[10px] font-black tracking-[0.3em] text-orange-600 uppercase block mb-0.5">Vigie Executive</span>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900">
              {stats?.bar_info?.nom || "BarPilote"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/onboarding")} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all active:scale-90">
            <span className="material-symbols-outlined text-xl">tune</span>
          </button>
          <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all active:scale-90">
            <span className="material-symbols-outlined text-xl">power_settings_new</span>
          </button>
        </div>
      </header>

      <main className="px-8 mt-10 space-y-10 max-w-5xl mx-auto">
        {/* REVENUE INTEL */}
        <section className="space-y-6">
          <ExecutiveCard variant="white" className="relative group overflow-hidden border-none shadow-2xl shadow-slate-200">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full -mr-20 -mt-20 group-hover:bg-orange-500/10 transition-all duration-1000"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2 block">Performance Financière</span>
                <h2 className="text-6xl font-black tracking-tighter text-slate-900">
                  {mainRevenue.sym}{mainRevenue.val.toLocaleString()}
                </h2>
              </div>
              <div className="bg-green-500/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-green-500/10">
                <span className="material-symbols-outlined text-[14px] text-green-600 font-bold">trending_up</span>
                <span className="text-[11px] font-black text-green-600">+12%</span>
              </div>
            </div>

            {stats?.revenue?.usd > 0 && stats?.revenue?.cdf > 0 && (
              <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-8">+ {stats.revenue.cdf.toLocaleString()} FC (Ventes Locales)</p>
            )}

            {/* CHART */}
            <div className="h-44 w-full mt-4 -ml-4 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.hourly_data || []}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: '900', fontSize: '12px' }}
                      formatter={(value: any) => [`${value} ${mainRevenue.sym}`, 'Revenu']}
                      labelStyle={{ display: 'none' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={5} fillOpacity={1} fill="url(#colorRev)" animationDuration={2000} />
                    {stats?.hourly_data?.map((d: any, i: number) => d.isPic && (
                      <ReferenceLine key={i} x={d.time} stroke="#f97316" strokeDasharray="5 5" label={{ position: 'top', value: 'PIC', fill: '#f97316', fontSize: 10, fontWeight: '900' }} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
            </div>
            
            <div className="flex justify-between mt-6 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">
              <span>Ouverture</span>
              <span>Prime Time</span>
              <span className="text-orange-500">Live</span>
            </div>
          </ExecutiveCard>
        </section>

        {/* BEST SELLER & QUICK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ExecutiveCard variant="dark" className="relative group active:scale-[0.98] transition-all cursor-pointer shadow-2xl shadow-black/10">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-120 transition-transform duration-700">
               <span className="material-symbols-outlined text-[100px]">stars</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-8 block">Meilleure Vente</span>
            <h3 className="text-4xl font-black tracking-tighter mb-4 text-white uppercase">{stats?.best_seller?.name}</h3>
            <div className="flex items-end gap-3">
              <span className="text-6xl font-black tracking-tighter leading-none text-orange-500">{stats?.best_seller?.qty}</span>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1 leading-relaxed">Unités Vendues<br/>Ce Soir</p>
            </div>
          </ExecutiveCard>

          <ExecutiveCard 
            variant="white" 
            className="border-none shadow-xl shadow-slate-200/50 cursor-pointer hover:shadow-2xl transition-all active:scale-[0.98]"
            onClick={() => router.push("/orders")}
          >
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 block">Pulse de Session</span>
             <div className="space-y-8">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><span className="material-symbols-outlined text-lg">receipt_long</span></div>
                     <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Tickets Actifs</span>
                  </div>
                  <span className="text-xl font-black text-slate-900">{stats?.metrics?.active_orders}</span>
               </div>
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><span className="material-symbols-outlined text-lg">avg_time</span></div>
                     <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Attente Moy.</span>
                  </div>
                  <span className="text-xl font-black text-slate-900">{stats?.metrics?.wait_time}m</span>
               </div>
             </div>
          </ExecutiveCard>
        </div>

        {/* INVENTORY ALERTS */}
        <section className="space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Alertes Stock</h3>
              <button onClick={() => router.push("/inventory")} className="text-[10px] font-black uppercase tracking-widest text-orange-600 flex items-center gap-1">Voir Cave <span className="material-symbols-outlined text-sm">chevron_right</span></button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
              {stats?.inventory_summary.map((item: any) => (
                <div key={item.category} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-50 group hover:shadow-xl transition-all">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Logistique: {item.category}</span>
                    <span className={`text-[11px] font-black ${item.alert ? 'text-red-600' : 'text-slate-900'}`}>{item.level}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden mb-4 border border-slate-100 shadow-inner">
                    <div className={`h-full rounded-full transition-all duration-1000 ${item.alert ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${item.level}%` }}></div>
                  </div>
                  {item.alert ? (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 py-2 px-3 rounded-xl border border-red-100">
                      <span className="material-symbols-outlined text-sm animate-pulse">priority_high</span>
                      <span className="text-[9px] font-black uppercase tracking-widest">Réapprovisionnement Urgent</span>
                    </div>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-widest text-teal-600">Niveaux Optimaux</span>
                  )}
                </div>
              ))}
           </div>
        </section>
      </main>

      <BottomNav activePage="dashboard" />
    </div>
  );
}
