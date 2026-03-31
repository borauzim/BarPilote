"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthClient, getToken } from "@/lib/auth";

export default function PilotProfilePage() {
    const router = useRouter();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [postName, setPostName] = useState("");
    const [email, setEmail] = useState("");
    const [sexe, setSexe] = useState<"M" | "F">("M");
    const [phone, setPhone] = useState("");
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    React.useEffect(() => {
        const fetchProfile = async () => {
            const token = getToken();
            if (!token) {
                console.warn("No pilot-token found, redirecting to login...");
                router.push("/auth/login");
                return;
            }

            try {
                setIsLoading(true);
                const api = getAuthClient();
                const response = await api.get('/api/proprietaire/profile/me/');

                const data = response.data;
                console.log("Profil chargé:", data);
                setFirstName(data.prenom || "");
                setLastName(data.nom || "");
                setPostName(data.postnom || "");
                setEmail(data.user_email || "exécutif@barpilote.com");
                setPhone(data.telephone || "");
                if (data.sexe) setSexe(data.sexe);
            } catch (error: any) {
                console.error("Erreur lors de la récupération du profil:", error);
                if (error.response?.status === 401) {
                    setErrorMsg("Session expirée, veuillez vous reconnecter.");
                    setTimeout(() => router.push("/auth/login"), 2000);
                } else {
                    setErrorMsg("Impossible de charger vos données actuelles.");
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProfile = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const payload = {
                prenom: firstName,
                nom: lastName,
                postnom: postName,
                telephone: phone,
                sexe: sexe,
            };

            console.log("Syncing Profile with Pilot Engine...", payload);

            const token = getToken();
            if (!token) {
                throw new Error("Token d'authentification manquant. Reconnectez-vous.");
            }

            const api = getAuthClient();
            const response = await api.patch('/api/proprietaire/profile/me/', payload);
            console.log("✅ Profil mis à jour:", response.data);

            router.push("/onboarding");
        } catch (error: any) {
            console.error("Failed to save profile:", error);
            const msg = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || error.message || "Erreur lors de l'enregistrement.";
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col pt-16 pb-24 relative font-sans">
            <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-6 h-16 w-full">
                <button onClick={() => router.back()} className="text-slate-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-slate-100 active:scale-95 duration-200">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-base font-bold tracking-tight text-slate-800">
                    Profil de l'Exécutif BarPilote
                </h1>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 max-w-xl mx-auto w-full px-6">
                <section className="relative pt-12 pb-8 flex flex-col items-center">
                    <div className="relative group">
                        <div className="w-36 h-36 rounded-[2.5rem] bg-slate-100 overflow-hidden shadow-2xl shadow-slate-200 flex items-center justify-center border-4 border-white transition-transform duration-500 group-hover:rotate-2">
                            {profileImage ? (
                                <img src={profileImage} alt="Profile Preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-slate-300 text-6xl font-light">person</span>
                            )}
                        </div>
                        <label className="absolute -bottom-2 -right-2 w-12 h-12 bg-orange-600 text-white rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-all cursor-pointer hover:bg-orange-700 hover:rotate-12">
                            <span className="material-symbols-outlined">photo_camera</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                        </label>
                    </div>
                </section>

                {/* Info Card */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 space-y-8">
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Licence de Pilotage</h2>
                        <p className="text-xs font-bold text-orange-600 tracking-[0.2em] uppercase opacity-80">Badge de vérification</p>
                    </div>

                    <div className="space-y-6">
                        {errorMsg && (
                            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse">
                                <span className="material-symbols-outlined text-sm">error</span>
                                {errorMsg}
                            </div>
                        )}

                        {/* Email (Readonly) */}
                        <div className="relative">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Email (Récupéré via Google)
                            </label>
                            <input
                                value={email}
                                disabled
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 opacity-60 cursor-not-allowed"
                                type="email"
                            />
                            <div className="absolute right-4 top-[34px]">
                                <span className="material-symbols-outlined text-green-500 text-sm">verified</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Prénom */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    Prénom
                                </label>
                                <input
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:bg-white focus:border-orange-600 outline-none transition-all"
                                    placeholder="Marc"
                                    type="text"
                                />
                            </div>

                            {/* Nom */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    Nom
                                </label>
                                <input
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:bg-white focus:border-orange-600 outline-none transition-all"
                                    placeholder="Kongo"
                                    type="text"
                                />
                            </div>
                        </div>

                        {/* Postnom */}
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                Postnom
                            </label>
                            <input
                                value={postName}
                                onChange={(e) => setPostName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:bg-white focus:border-orange-600 outline-none transition-all"
                                placeholder="Mulamba"
                                type="text"
                            />
                        </div>

                        {/* Sexe Selection */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                Sexe
                            </label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setSexe("M")}
                                    className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${sexe === "M"
                                            ? "border-orange-600 bg-orange-50 text-orange-600"
                                            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-orange-200"
                                        }`}
                                >
                                    <span className="material-symbols-outlined">male</span>
                                    Masculin
                                </button>
                                <button
                                    onClick={() => setSexe("F")}
                                    className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${sexe === "F"
                                            ? "border-orange-600 bg-orange-50 text-orange-600"
                                            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-orange-200"
                                        }`}
                                >
                                    <span className="material-symbols-outlined">female</span>
                                    Féminin
                                </button>
                            </div>
                        </div>

                        {/* Téléphone */}
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                Numéro de téléphone
                            </label>
                            <div className="flex gap-2">
                                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 flex items-center font-bold text-slate-500 text-sm">
                                    +243
                                </div>
                                <input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:bg-white focus:border-orange-600 outline-none transition-all"
                                    placeholder="812 345 678"
                                    type="tel"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveProfile}
                        disabled={!firstName || !lastName || !phone || isLoading}
                        className="w-full citrus-gradient text-white font-black py-5 rounded-2xl shadow-xl shadow-orange-600/20 active:scale-[0.98] transition-all duration-200 uppercase tracking-tighter text-base disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span className="animate-spin material-symbols-outlined text-sm">sync</span>
                                Enregistrement...
                            </>
                        ) : "Valider mon Profil"}
                    </button>
                </div>

                <p className="mt-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                    SÉCURITÉ CHIFFRÉE • BARPILOTE OS
                </p>
            </main>
        </div>
    );
}
