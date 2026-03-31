"use client";

import React from "react";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { setToken } from "@/lib/auth";

// Le composant d'interface pur qui gère le bouton et les requêtes
function LoginContent() {
    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            console.log("Google Access Token:", tokenResponse.access_token);
            try {
                // Envoi du token à Django (dj-rest-auth)
                const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/`, {
                    access_token: tokenResponse.access_token,
                });
                console.log("Réponse complète du Pilot Engine:", JSON.stringify(response.data));
                
                // dj-rest-auth avec USE_JWT=True renvoie { access, refresh, user }
                const token = response.data.access || response.data.access_token || response.data.key;
                console.log("Token extrait:", token ? token.substring(0, 30) + "..." : "AUCUN TOKEN !");
                
                if (token) {
                    setToken(token);
                    console.log("Token sauvegardé dans les cookies ✅");
                } else {
                    console.error("❌ Aucun token trouvé dans la réponse Django !", response.data);
                    alert("Erreur d'authentification : aucun token reçu du serveur.");
                    return;
                }
                // Redirection vers la sélection de rôle
                window.location.href = "/auth/select-role";
            } catch (error) {
                console.error("Erreur de connexion Django:", error);
            }
        },
        onError: (errorResponse) => console.log("Google Login Failed", errorResponse),
    });

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] citrus-gradient opacity-[0.05] rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-tertiary opacity-[0.03] rounded-full blur-3xl"></div>

            <div className="w-full max-w-md bg-surface-container-lowest rounded-[24px] p-10 executive-shadow relative z-10 text-center">
                {/* Logo and Welcome */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 mb-4 flex items-center justify-center">
                        <div
                            className="w-full h-full bg-orange-600 drop-shadow-md"
                            style={{
                                WebkitMaskImage: 'url(/logobarpilote.png)',
                                WebkitMaskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskImage: 'url(/logobarpilote.png)',
                                maskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                maskPosition: 'center',
                            }}
                        />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-on-surface mb-2">
                        Cockpit BarPilote
                    </h1>
                    <p className="text-on-surface-variant/70 text-sm font-medium">
                        Connectez-vous pour piloter votre établissement.
                    </p>
                </div>

                {/* Google Auth Button */}
                <button
                    onClick={() => login()}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-surface-container-high text-on-surface hover:bg-surface-container hover:shadow-sm transition-all duration-200 font-semibold py-3.5 px-4 rounded-xl active:scale-95"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4" />
                        <path d="M12.2401 24.0008C15.4766 24.0008 18.2059 22.9382 20.1945 21.1039L16.3276 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.2401 24.0008Z" fill="#34A853" />
                        <path d="M5.50253 14.3003C5.00318 12.8099 5.00318 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z" fill="#FBBC05" />
                        <path d="M12.2401 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.2401 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.2401 4.74966Z" fill="#EA4335" />
                    </svg>
                    Continuer avec Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                    <div className="h-[1px] bg-surface-container flex-1"></div>
                    <span className="text-xs font-semibold text-on-surface-variant/50 uppercase tracking-widest">
                        Accès Pilote
                    </span>
                    <div className="h-[1px] bg-surface-container flex-1"></div>
                </div>

                <p className="text-xs text-on-surface-variant/60">
                    En vous connectant, vous acceptez les{" "}
                    <a href="#" className="font-semibold text-orange-600 hover:text-orange-500 underline">
                        Conditions T&C
                    </a>{" "}
                    de BarPilote.
                </p>
            </div>
        </div>
    );
}

// Wrapper avec le Provider Google
export default function LoginPage() {
    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
            <LoginContent />
        </GoogleOAuthProvider>
    );
}
