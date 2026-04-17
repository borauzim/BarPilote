"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { getToken } from "@/lib/auth";

export default function SelectRolePage() {
    const router = useRouter();
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const roles = [
        {
            id: "SERVEUR",
            title: "Serveur ou Protocole",
            desc: "Service aux clients et gestion des commandes aux tables.",
            icon: "person_celebrate",
            color: "citrus-gradient"
        },
        {
            id: "PROPRIETAIRE",
            title: "Propriétaire d'établissement",
            desc: "Gestionnaire complet (accès restreint via cette app).",
            icon: "business_center",
            color: "bg-slate-800"
        },
        {
            id: "EVENEMENT",
            title: "Organisateur d'événement",
            desc: "Organisation de soirées ou bars éphémères.",
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
                    router.push("/auth/login");
                    return;
                }

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
                await axios.patch(`${apiUrl}/api/proprietaire/profile/me/`, {
                    role: selectedRole
                }, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                if (selectedRole === "SERVEUR") {
                    router.push("/auth/scan");
                } else {
                    // Proprietors or other roles might need redirection to the owner app or profile
                    router.push("/dashboard");
                }
            } catch (error) {
                console.error("Erreur sauvegarde rôle:", error);
                router.push("/dashboard");
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary opacity-[0.03] rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-xl space-y-12 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="text-center space-y-4">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em]">
                        Configuration du Poste
                    </span>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                        Quel est votre <br/><span className="text-orange-600">Rôle</span> ?
                    </h1>
                    <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                        Identifiez votre fonction pour adapter vos outils opérationnels.
                    </p>
                </div>

                <div className="grid gap-4">
                    {roles.map((role) => (
                        <button
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            className={`group relative flex items-center p-6 rounded-[2rem] border-2 transition-all duration-300 text-left active:scale-[0.98] ${selectedRole === role.id
                                    ? "border-orange-600 bg-white shadow-xl shadow-orange-600/10"
                                    : "border-slate-200 bg-white hover:border-orange-200 shadow-sm"
                                }`}
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mr-6 transition-transform group-hover:scale-110 ${selectedRole === role.id ? "citrus-gradient text-white shadow-lg shadow-orange-600/20" : "bg-slate-100 text-slate-400"
                                }`}>
                                <span className="material-symbols-outlined text-2xl">{role.icon}</span>
                            </div>
                            <div className="flex-1">
                                <h3 className={`text-lg font-black ${selectedRole === role.id ? "text-orange-600" : "text-slate-800"}`}>
                                    {role.title}
                                </h3>
                                <p className="text-slate-400 text-sm font-semibold leading-snug">
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
                    disabled={!isMounted || !selectedRole || isLoading}
                    suppressHydrationWarning={true}
                    className="w-full citrus-gradient text-white h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary-container/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    {isLoading ? (
                        <span className="material-symbols-outlined animate-spin font-bold">sync</span>
                    ) : (
                        <>
                            Confirmer mon Poste
                            <span className="material-symbols-outlined">east</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
