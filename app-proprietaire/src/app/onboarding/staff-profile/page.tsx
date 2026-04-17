"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { getAuthClient, getToken } from "@/lib/auth";

export default function StaffOnboardingPage() {
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        nom: "",
        postnom: "",
        prenom: "",
        sexe: "M",
        telephone: ""
    });
    const [barInfo, setBarInfo] = useState({ nom: "", gerant: "" });
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setIsMounted(true);
        // Check if logged in and fetch bar info
        const token = getToken();
        if (!token) {
            router.push("/auth/login");
        } else {
            fetchInitialData();
        }
    }, [router]);

    const fetchInitialData = async () => {
        try {
            const api = getAuthClient();
            const profileResp = await api.get("/api/proprietaire/profile/me/");
            const profileData = profileResp.data;
            setBarInfo({
                nom: profileData.bar_nom || "Établissement inconnu",
                gerant: profileData.gerant_nom || "Gérant BarPilote"
            });
            // Pré-remplir les champs si déjà existants
            setFormData({
                nom: profileData.nom || "",
                postnom: profileData.postnom || "",
                prenom: profileData.prenom || "",
                sexe: profileData.sexe || "M",
                telephone: profileData.telephone || ""
            });
        } catch (error) {
            console.error("Erreur initialisation :", error);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const data = new FormData();
        data.append("nom", formData.nom);
        data.append("postnom", formData.postnom);
        data.append("prenom", formData.prenom);
        data.append("sexe", formData.sexe);
        data.append("telephone", formData.telephone);
        if (photo) {
            data.append("photo_profil", photo);
        }

        try {
            const api = getAuthClient();
            // On récupère le profil actuel pour avoir son ID
            const profileResp = await api.get("/api/proprietaire/profiles/me/");
            const profileId = profileResp.data.id;
            
            // Mise à jour du profil (on utilise PATCH pour ne pas écraser les autres infos)
            await api.patch(`/api/proprietaire/profiles/${profileId}/`, data, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            // Succès ! Direction le dashboard
            router.push("/dashboard");
        } catch (error) {
            console.error("Erreur lors de la mise à jour du profil :", error);
            alert("Une erreur est survenue lors de l'enregistrement de votre profil.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-[#0c0d0d] text-white font-sans p-6 pb-12 overflow-x-hidden">
            <header className="max-w-md mx-auto py-8">
                <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-px bg-orange-500/50"></span>
                    <span className="text-[10px] font-black tracking-[0.3em] text-orange-500 uppercase">Étape Finale</span>
                </div>
                <h1 className="text-4xl font-black tracking-tighter leading-none">
                    VOTRE PROFIL <br/>
                    <span className="text-orange-500 italic uppercase">Sommelier Digital</span>
                </h1>
                <p className="mt-4 text-zinc-500 text-sm font-medium leading-relaxed">
                    Complétez votre identité pour être reconnu par vos collègues et le propriétaire.
                </p>

                {/* Bandeau Établissement */}
                <div className="mt-6 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-orange-500">storefront</span>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Établissement</p>
                            <p className="text-sm font-bold text-white">{barInfo.nom || "Chargement..."}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Gérant</p>
                        <p className="text-xs font-semibold text-orange-500">{barInfo.gerant || "..."}</p>
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-10">
                
                {/* Photo Upload Section */}
                <div className="flex flex-col items-center gap-6 py-4">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="relative w-40 h-40 group cursor-pointer"
                    >
                        <div className={`absolute inset-0 rounded-full border-2 border-dashed ${photoPreview ? 'border-orange-500/50' : 'border-white/10'} group-hover:border-orange-500 transition-colors`}></div>
                        <div className="absolute inset-3 rounded-full overflow-hidden bg-white/5 flex items-center justify-center border border-white/5 shadow-2xl">
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center text-zinc-600 gap-2">
                                    <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Ajouter Photo</span>
                                </div>
                            )}
                        </div>
                        {/* Glow effect if photo exists */}
                        {photoPreview && <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl -z-10 animate-pulse"></div>}
                        
                        <div className="absolute bottom-2 right-2 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg border-4 border-[#0c0d0d] group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-sm font-bold">edit</span>
                        </div>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handlePhotoChange} 
                        accept="image/*"
                    />
                </div>

                {/* Identity Bento Grid */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-4">
                        <div className="group relative">
                            <label className="absolute left-5 top-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest transition-all group-focus-within:text-orange-500">Prénom</label>
                            <input 
                                required
                                type="text" 
                                value={formData.prenom}
                                onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 pt-8 pb-4 text-sm font-bold focus:bg-white/10 focus:border-orange-500/50 outline-none transition-all"
                                placeholder="ex: Jean-Marc"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="group relative">
                                <label className="absolute left-5 top-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nom</label>
                                <input 
                                    required
                                    type="text" 
                                    value={formData.nom}
                                    onChange={(e) => setFormData({...formData, nom: e.target.value})}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 pt-8 pb-4 text-sm font-bold outline-none transition-all"
                                />
                            </div>
                            <div className="group relative">
                                <label className="absolute left-5 top-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Postnom</label>
                                <input 
                                    type="text" 
                                    value={formData.postnom}
                                    onChange={(e) => setFormData({...formData, postnom: e.target.value})}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 pt-8 pb-4 text-sm font-bold outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sexe Selection */}
                    <div className="pt-4 space-y-4">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Sexe</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, sexe: "M"})}
                                className={`py-4 rounded-2xl border flex items-center justify-center gap-3 transition-all ${formData.sexe === 'M' ? 'bg-orange-500/10 border-orange-500 text-orange-500 shadow-lg shadow-orange-500/10' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'}`}
                            >
                                <span className="material-symbols-outlined">male</span>
                                <span className="text-xs font-black uppercase tracking-widest">Masculin</span>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, sexe: "F"})}
                                className={`py-4 rounded-2xl border flex items-center justify-center gap-3 transition-all ${formData.sexe === 'F' ? 'bg-orange-500/10 border-orange-500 text-orange-500 shadow-lg shadow-orange-500/10' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'}`}
                            >
                                <span className="material-symbols-outlined">female</span>
                                <span className="text-xs font-black uppercase tracking-widest">Féminin</span>
                            </button>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="pt-4 space-y-4">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Contact WhatsApp</p>
                        <div className="group relative">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 text-zinc-500">
                                <span className="material-symbols-outlined text-xl">call</span>
                                <span className="text-xs font-bold border-r border-white/10 pr-3">+243</span>
                            </div>
                            <input 
                                required
                                type="tel" 
                                value={formData.telephone}
                                onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-24 pr-5 py-5 text-sm font-bold focus:border-orange-500/50 outline-none transition-all"
                                placeholder="81 234 56 78"
                            />
                        </div>
                        <p className="text-[9px] text-zinc-600 font-medium px-2 italic">
                            * Ce numéro sera utilisé pour vous envoyer vos rapports de service et instructions.
                        </p>
                    </div>
                </div>

                {/* Submit Action */}
                <div className="pt-10">
                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full citrus-gradient text-white py-6 rounded-[32px] font-black text-sm shadow-2xl shadow-orange-500/20 active:scale-95 hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                    >
                        {isLoading ? (
                            <span className="material-symbols-outlined animate-spin">sync</span>
                        ) : (
                            <>
                                FINALISER MON PROFIL
                                <span className="material-symbols-outlined">verified_user</span>
                            </>
                        )}
                    </button>
                    <p className="mt-6 text-center text-zinc-600 text-[10px] font-bold uppercase tracking-widest">BarPilote Security Interface — Protocol 2.4.1</p>
                </div>
            </form>

            <style jsx>{`
                .citrus-gradient {
                    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                }
            `}</style>
        </div>
    );
}
