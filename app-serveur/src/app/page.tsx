"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { getApiUrl } from "@/lib/apiConfig";

export default function WelcomePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuthAndRedirect = async () => {
            const token = getToken();
            
            if (!token) {
                // Non connecté, rediriger vers login
                router.push("/auth/login");
                return;
            }

            try {
                // Récupérer le profil pour déterminer le rôle
                const apiUrl = getApiUrl();
                const response = await fetch(`${apiUrl}/api/proprietaire/profiles/me/`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const profile = await response.json();
                    
                    // Redirection selon le rôle
                    switch (profile.role) {
                        case 'PROPRIETAIRE':
                            // TODO: Créer un dashboard propriétaire
                            router.push('/dashboard/proprietaire');
                            break;
                        case 'SERVEUR':
                            router.push('/dashboard');
                            break;
                        case 'EVENEMENT':
                            // TODO: Créer un dashboard événement
                            router.push('/dashboard/evenement');
                            break;
                        default:
                            console.warn("Rôle non reconnu:", profile.role);
                            router.push('/dashboard');
                            break;
                    }
                } else {
                    // Token invalide
                    router.push("/auth/login");
                }
            } catch (error) {
                console.error("Erreur vérification auth:", error);
                router.push("/auth/login");
            } finally {
                setIsLoading(false);
            }
        };

        checkAuthAndRedirect();
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0c0d0d] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg mb-6 mx-auto">
                        BP
                    </div>
                    <h1 className="text-2xl font-black text-white mb-2">BarPilote</h1>
                    <p className="text-zinc-400 mb-8">Redirection en cours...</p>
                    <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto"></div>
                </div>
            </div>
        );
    }

    return null; // La redirection se fait dans useEffect
}
