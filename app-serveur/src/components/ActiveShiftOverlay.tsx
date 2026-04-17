"use client";

import React from "react";

interface ActiveShiftOverlayProps {
    workerName: string;
    startTime: string;
    barName: string;
    onClose: () => void;
}

export default function ActiveShiftOverlay({ workerName, startTime, barName, onClose }: ActiveShiftOverlayProps) {
    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0a0b] text-white font-sans flex flex-col items-center justify-center overflow-hidden">
            {/* Background Decorative Textures */}
            <div className="absolute inset-0 pointer-events-none -z-20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-[#0a0a0b] to-black"></div>
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-neutral-800/20 blur-[120px] rounded-full"></div>
            </div>

            {/* Background Content Imagery (Placeholder logic for the bar atmosphere) */}
            <div className="absolute inset-0 opacity-[0.03] -z-10 mix-blend-overlay">
                <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2070&auto=format&fit=crop')] bg-cover grayscale" />
            </div>

            {/* Main Content */}
            <main className="relative flex flex-col items-center justify-center w-full max-w-lg px-8 text-center animate-in fade-in zoom-in duration-700">
                {/* Haptic Glow Icon Section */}
                <div className="relative mb-12">
                    <div className="absolute inset-0 rounded-full haptic-glow animate-pulse"></div>
                    <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-neutral-900 border border-neutral-800 shadow-2xl">
                        <span className="material-symbols-outlined text-green-500 !text-6xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                            check_circle
                        </span>
                    </div>
                    <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/5 blur-[80px] rounded-full"></div>
                </div>

                {/* Feedback Typography */}
                <div className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                        Bienvenue, {workerName}
                    </h1>
                    <p className="text-xl md:text-2xl font-medium text-neutral-400">
                        Service commencé à {startTime}
                    </p>
                </div>

                {/* Status Details */}
                <div className="mt-12 grid grid-cols-2 gap-4 w-full opacity-80">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                        <span className="block text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1 font-black">Poste</span>
                        <span className="text-sm font-bold tracking-tight">{barName}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                        <span className="block text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1 font-black">Statut</span>
                        <span className="text-sm font-bold flex items-center justify-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                            En Service
                        </span>
                    </div>
                </div>
            </main>

            {/* Floating Action Button */}
            <div className="fixed bottom-12 left-0 w-full px-8 flex justify-center z-50">
                <button 
                    onClick={onClose}
                    className="citrus-gradient w-full max-w-sm py-5 rounded-full shadow-2xl shadow-orange-950/40 flex items-center justify-center gap-3 active:scale-95 transition-all duration-300 border border-white/10 group overflow-hidden"
                >
                    <span className="font-black text-lg tracking-tight uppercase">Aller à la Vigie</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform" style={{ fontVariationSettings: "'wght' 600" }}>
                        arrow_forward
                    </span>
                </button>
            </div>
        </div>
    );
}
