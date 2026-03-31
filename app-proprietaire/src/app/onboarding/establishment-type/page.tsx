"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function EstablishmentTypePage() {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const types = [
        { id: "BAR", label: "Bar", icon: "sports_bar", desc: "Bar classique, service au comptoir et aux tables." },
        { id: "LOUNGE", label: "Lounge Bar", icon: "chair", desc: "Ambiance tamisée, fauteuils confortables et cocktails." },
        { id: "CLUB", label: "Boîte de Nuit", icon: "celebration", desc: "Musique forte, piste de danse et service bouteilles." },
        { id: "BISTRO", label: "Bistro / Resto", icon: "restaurant", desc: "Établissement mixte avec service de restauration." },
        { id: "TERRASSE", label: "Terrasse", icon: "wb_sunny", desc: "Espace extérieur avec service de boissons." },
        { id: "PUB", label: "Pub", icon: "local_pub", desc: "Style anglo-saxon, bières pression et convivialité." },
        { id: "EVENT", label: "Éphémère / Évènement", icon: "festival", desc: "Bar temporaire pour un festival ou une fête." },
    ];

    const handleContinue = () => {
        if (selectedType) {
            // On stocke le type dans le localStorage pour l'utiliser lors de la création finale du bar
            localStorage.setItem("selected_establishment_type", selectedType);
            // Redirection vers le profil
            router.push("/onboarding/profile");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
            <div className="w-full max-w-2xl space-y-12">
                <div className="text-center space-y-4">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em]">
                        Configuration du Cockpit
                    </span>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                        Quel type <span className="text-orange-600 underline decoration-indigo-500/30 underline-offset-8">d'établissement</span> ?
                    </h1>
                    <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                        Cette sélection personnalisera vos outils de gestion et vos statistiques.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {types.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setSelectedType(t.id)}
                            className={`group relative flex items-center p-5 rounded-3xl border-2 transition-all duration-300 text-left active:scale-[0.98] ${selectedType === t.id
                                    ? "border-orange-600 bg-white shadow-xl shadow-orange-600/10"
                                    : "border-slate-200 bg-white hover:border-orange-200"
                                }`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 transition-transform group-hover:scale-110 ${selectedType === t.id ? "citrus-gradient text-white" : "bg-slate-100 text-slate-400"
                                }`}>
                                <span className="material-symbols-outlined text-xl">{t.icon}</span>
                            </div>
                            <div className="flex-1">
                                <h3 className={`text-sm font-bold ${selectedType === t.id ? "text-orange-600" : "text-slate-800"}`}>
                                    {t.label}
                                </h3>
                                <p className="text-slate-400 text-[11px] font-medium leading-snug">
                                    {t.desc}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleContinue}
                    disabled={!selectedType}
                    className="w-full citrus-gradient text-white font-bold py-5 rounded-full shadow-2xl shadow-orange-600/20 active:scale-95 transition-all duration-200 uppercase tracking-tighter text-lg disabled:opacity-30 flex items-center justify-center gap-3"
                >
                    Continuer vers mon Profil
                    <span className="material-symbols-outlined">east</span>
                </button>
            </div>
        </div>
    );
}
