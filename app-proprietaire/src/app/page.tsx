"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, deleteToken } from "@/lib/auth";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import BottomNav from "@/components/BottomNav";

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
    const token = getToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const resp = await fetch(`${apiUrl}/api/proprietaire/dashboard/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setStats(data);
        // Persister les infos pour les pages QR et configuration
        if (data.bar_info) {
          localStorage.setItem("bar_name", data.bar_info.nom || "");
          if (data.bar_info.code_invitation) {
            localStorage.setItem("bar_code_invitation", data.bar_info.code_invitation);
          }
        }
      }
    } catch (err) {
      console.error("Dashboard Stats Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse text-sm uppercase tracking-widest">Initialisation du Cockpit...</p>
      </div>
    );
  }

  // Chiffre d'affaires principal (On affiche USD s'il y en a, sinon CDF)
  const mainRevenue = stats?.revenue?.usd > 0 || stats?.revenue?.cdf === 0 
    ? { val: stats?.revenue?.usd || 0, sym: "$" }
    : { val: stats?.revenue?.cdf || 0, sym: "FC" };


  return (
    <div className="bg-[#f8f9fa] min-h-screen text-[#1a1c1d] font-sans pb-32">
      {/* DYNAMIC HEADER */}
      <header className="px-6 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-orange-500 overflow-hidden shadow-sm flex items-center justify-center bg-white">
            {stats?.bar_info?.logo ? (
              <img
                src={stats.bar_info.logo}
                alt={stats.bar_info.nom}
                className="w-full h-full object-cover"
              />
            ) : (
              <div 
                className="w-6 h-6 bg-[#FF5E00]"
                style={{
                  WebkitMaskImage: 'url(/logobarpilote.png)', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
                  maskImage: 'url(/logobarpilote.png)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center'
                }}
              />
            )}
          </div>
          <span className="text-xl font-black tracking-tight text-[#FF5E00]">
            {stats?.bar_info?.nom || "BarPilote"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => router.push("/onboarding")}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">settings</span>
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-orange-600 transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">logout</span>
          </button>
        </div>
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
          <h2 className="text-5xl font-black tracking-tighter mb-4">
            {mainRevenue.sym}{mainRevenue.val.toLocaleString()}
          </h2>
          
          {stats?.revenue?.usd > 0 && stats?.revenue?.cdf > 0 && (
            <p className="text-xs font-bold text-slate-400 mb-4">+ {stats.revenue.cdf.toLocaleString()} FC (Ventes locales)</p>
          )}

          {/* PANIER MOYEN INFO */}
          <div className="flex justify-center mb-8">
            <div className="bg-[#FF5E00] text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg relative group">
              PANIER MOYEN: {mainRevenue.sym}{stats?.metrics?.avg_basket.toLocaleString()}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-6 bg-[#FF5E00]/30 border-dashed border-l"></div>
            </div>
          </div>

          {/* CHART VISUAL (INTERACTIVE RECHARTS) */}
          <div className="h-40 w-full mt-4 -ml-4">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={stats?.hourly_data || []}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF5E00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF5E00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  hide 
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`${value.toLocaleString()} ${mainRevenue.sym}`, 'Revenu']}
                  labelStyle={{ display: 'none' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#FF5E00" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  animationDuration={1500}
                />
                
                {/* Reference point for the Peak */}
                {stats?.hourly_data?.map((d: any, i: number) => d.isPic && (
                  <ReferenceLine 
                    key={i}
                    x={d.time} 
                    stroke="#FF5E00" 
                    strokeDasharray="3 3"
                    label={{ position: 'top', value: 'PIC', fill: '#FF5E00', fontSize: 10, fontWeight: 'bold' }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            )}
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
          <h3 className="text-3xl font-black tracking-tight mb-4">{stats?.best_seller?.name}</h3>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-black tracking-tighter leading-none">{stats?.best_seller?.qty}</span>
            <p className="text-[11px] font-bold uppercase tracking-tight leading-4 opacity-80 mb-1">Unités Vendues<br />Aujourd&apos;hui</p>
          </div>
        </section>

        {/* SESSION STATS ROW */}
        <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-50">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6 px-1">Performance de la Session</h4>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined">receipt_long</span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Tickets Actifs</span>
              </div>
              <span className="text-lg font-black">{stats?.metrics?.active_orders || 0} Tables</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined">hourglass_empty</span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Temps de Service</span>
              </div>
              <span className="text-lg font-black">{stats?.metrics?.wait_time || 0} min</span>
            </div>
          </div>
        </section>

        {/* INVENTORY ALERTS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
          {stats?.inventory_summary.map((item: any) => (
            <div key={item.category} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-50">
              <div className="flex justify-between items-center mb-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Inventaire {item.category}</p>
                <span className={`text-xs font-black ${item.alert ? 'text-red-500' : 'text-slate-800'}`}>{item.level}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${item.alert ? 'bg-red-500' : 'bg-[#FF5E00]'}`}
                  style={{ width: `${item.level}%` }}
                ></div>
              </div>
              {item.alert && (
                <div className="flex items-center gap-1.5 text-red-500">
                   <span className="material-symbols-outlined text-sm">warning</span>
                   <span className="text-[10px] font-bold uppercase tracking-wider">Alerte Stock Faible</span>
                </div>
              )}
              {!item.alert && (
                 <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Niveaux sains</p>
              )}
            </div>
          ))}
        </section>


      </main>

      {/* BOTTOM NAV */}
      <BottomNav activePage="dashboard" />
    </div>
  );
}
