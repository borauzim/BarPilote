"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary opacity-[0.03] rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary opacity-[0.02] rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-sm space-y-12 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                {/* Logo & Branding */}
                <div className="space-y-4">
                    <div className="flex flex-col items-center">
                        <div 
                            className="w-20 h-20 bg-primary-container mb-4"
                            style={{
                                WebkitMaskImage: 'url(/logobarpilote.png)',
                                WebkitMaskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskImage: 'url(/logobarpilote.png)',
                                maskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                maskPosition: 'center'
                            }}
                        />
                        <h1 className="text-4xl font-black tracking-tighter text-on-surface">
                            BarPilote
                        </h1>
                        <div className="mt-2 px-3 py-1 bg-orange-50 rounded-full">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-container">
                                Cockpit Serveur
                            </p>
                        </div>
                    </div>
                </div>

                {/* Hero Content */}
                <div className="space-y-3">
                    <h2 className="text-xl font-bold text-on-surface leading-tight px-4">
                        L&apos;excellence du service, <br/>pilotez avec précision.
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed px-6">
                        Gérez vos tables, prenez les commandes et suivez votre performance en temps réel.
                    </p>
                </div>

                {/* Actions */}
                <div className="space-y-4 px-4">
                    <button 
                        onClick={() => router.push("/dashboard")}
                        className="w-full citrus-gradient text-white h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary-container/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        Ouvrir mon Dashboard
                        <span className="material-symbols-outlined">rocket_launch</span>
                    </button>
                    
                    <div className="pt-4 flex flex-col items-center gap-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nouvelle recrue ?</p>
                        <p className="text-xs text-slate-500 font-medium">Scannez votre badge pour rejoindre un bar.</p>
                    </div>
                </div>

                {/* Footer Metadata */}
                <footer className="pt-8">
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em]">
                        Executive Sommelier v1.0
                    </p>
                </footer>
            </div>
        </div>
    );
}
