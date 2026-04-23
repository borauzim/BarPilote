"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

interface AuthGuardProps {
    children: React.ReactNode;
    redirectTo?: string;
}

// Fonction de redirection selon le rôle
const redirectToDashboard = (role: string, router: any) => {
    console.log("Redirection selon le rôle:", role);
    
    switch (role) {
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
            console.warn("Rôle non reconnu:", role);
            router.push('/dashboard');
            break;
    }
};

export default function AuthGuard({ children, redirectTo = "/auth/login" }: AuthGuardProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = getToken();
                
                if (token) {
                    // Vérifier si le token est valide et récupérer le profil
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                    const response = await fetch(`${apiUrl}/api/proprietaire/profiles/me/`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    if (response.ok) {
                        const profile = await response.json();
                        setIsAuthenticated(true);
                        
                        // Redirection intelligente selon le rôle et la page actuelle
                        if (window.location.pathname.includes('/auth/')) {
                            // Rediriger vers le bon dashboard selon le rôle
                            redirectToDashboard(profile.role, router);
                        }
                    } else {
                        // Token invalide, supprimer et rediriger
                        setIsAuthenticated(false);
                        if (!window.location.pathname.includes('/auth/')) {
                            router.push(redirectTo);
                        }
                    }
                } else {
                    setIsAuthenticated(false);
                    // Si on n'est pas sur une page d'auth, rediriger vers login
                    if (!window.location.pathname.includes('/auth/')) {
                        router.push(redirectTo);
                    }
                }
            } catch (error) {
                console.error("Erreur vérification auth:", error);
                setIsAuthenticated(false);
                if (!window.location.pathname.includes('/auth/')) {
                    router.push(redirectTo);
                }
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, [router, redirectTo]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0c0d0d] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    // Si on est sur une page d'auth et qu'on est déjà authentifié, le composant gère la redirection
    // Si on est sur une page protégée et qu'on n'est pas authentifié, le composant gère la redirection
    return <>{children}</>;
}
