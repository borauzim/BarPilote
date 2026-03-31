"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthClient, getToken } from "@/lib/auth";

export default function SelectRolePage() {
    const router = useRouter();
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const roles = [
        {
            id: "PROPRIETAIRE",
            title: "Propriétaire d'un établissement",
            desc: "Gestionnaire complet de l'établissement et des finances.",
            icon: "business_center",
            color: " citrus-gradient "
        },
        {
            id: "SERVEUR",
            title: "Serveur ou Protocole",
            desc: "Service aux clients et gestion des commandes aux tables.",
            icon: "person",
            color: "bg-slate-800"
        },
        {
            id: "EVENEMENT",
            title: "Organisateur d'événement",
            desc: "Organisation de soirées, festivals ou bars éphémères.",
            icon: "festival",
            color: "bg-slate-800"
        }
    ];

    const handleContinue = async () => {
        if (selectedRole) {
            setIsLoading(true);
            try {
                const token = getToken();
                if (!token) {
                    console.error("Pas de token, redirection login");
                    router.push("/auth/login");
                    return;
                }

                const api = getAuthClient();
                await api.patch('/api/proprietaire/profile/me/', {
                    role: selectedRole
                });
                console.log("Rôle sauvegardé:", selectedRole);
                
                if (selectedRole === "PROPRIETAIRE") {
                    router.push("/onboarding/establishment-type");
                } else {
                    router.push("/onboarding/profile");
                }
            } catch (error) {
                console.error("Erreur sauvegarde rôle:", error);
                if (selectedRole === "PROPRIETAIRE") {
                    router.push("/onboarding/establishment-type");
                } else {
                    router.push("/onboarding/profile");
                }
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
            <div className="w-full max-w-xl space-y-12">
                <div className="text-center space-y-4">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em]">
                        Configuration du Poste
                    </span>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                        Quel est votre <span className="text-orange-600 underline decoration-indigo-500/30 underline-offset-8">Rôle</span> ?
                    </h1>
                    <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                        Personnalisez votre cockpit en fonction de vos responsabilités opérationnelles.
                    </p>
                </div>

                <div className="grid gap-4">
                    {roles.map((role) => (
                        <button
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            className={`group relative flex items-center p-6 rounded-3xl border-2 transition-all duration-300 text-left active:scale-[0.98] ${selectedRole === role.id
                                    ? "border-orange-600 bg-white shadow-xl shadow-orange-600/10"
                                    : "border-slate-200 bg-white hover:border-orange-200"
                                }`}
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mr-6 transition-transform group-hover:scale-110 ${selectedRole === role.id ? "citrus-gradient text-white" : "bg-slate-100 text-slate-400"
                                }`}>
                                <span className="material-symbols-outlined text-2xl">{role.icon}</span>
                            </div>
                            <div className="flex-1">
                                <h3 className={`text-lg font-bold ${selectedRole === role.id ? "text-orange-600" : "text-slate-800"}`}>
                                    {role.title}
                                </h3>
                                <p className="text-slate-400 text-sm font-medium leading-snug">
                                    {role.desc}
                                </p>
                            </div>
                            {selectedRole === role.id && (
                                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                    <span className="material-symbols-outlined text-orange-600">check_circle</span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleContinue}
                    disabled={!selectedRole}
                    className="w-full citrus-gradient text-white font-bold py-5 rounded-full shadow-2xl shadow-orange-600/20 active:scale-95 transition-all duration-200 uppercase tracking-tighter text-lg disabled:opacity-30 flex items-center justify-center gap-3"
                >
                    Continuer vers le Profil
                    <span className="material-symbols-outlined">east</span>
                </button>
            </div>
        </div>
    );
}
