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
            const profileResp = await api.get("/api/proprietaire/profiles/me/");
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

            // Succès ! Redirection vers le Dashboard
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
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 pb-12 overflow-x-hidden">
            <header className="max-w-md mx-auto py-8">
                <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-px bg-orange-600/50"></span>
                    <span className="text-[10px] font-black tracking-[0.3em] text-orange-600 uppercase">Étape Finale</span>
                </div>
                <h1 className="text-4xl font-black tracking-tighter leading-none text-slate-900">
                    VOTRE PROFIL <br/>
                    <span className="text-orange-600 italic uppercase">Sommelier Digital</span>
                </h1>
                <p className="mt-4 text-slate-500 text-sm font-medium leading-relaxed">
                    Complétez votre identité pour être reconnu par vos collègues et le propriétaire.
                </p>

                {/* Bandeau Établissement */}
                <div className="mt-6 p-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-orange-600">storefront</span>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Établissement</p>
                            <p className="text-sm font-bold text-slate-900">{barInfo.nom || "Chargement..."}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gérant</p>
                        <p className="text-xs font-semibold text-orange-600">{barInfo.gerant || "..."}</p>
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
                        <div className={`absolute inset-0 rounded-full border-2 border-dashed ${photoPreview ? 'border-orange-500/50' : 'border-slate-300'} group-hover:border-orange-500 transition-colors`}></div>
                        <div className="absolute inset-3 rounded-full overflow-hidden bg-white flex items-center justify-center border border-slate-200 shadow-xl">
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center text-slate-400 gap-2">
                                    <span className="material-symbols-outlined text-4xl group-hover:text-orange-500 transition-colors">add_a_photo</span>
                                    <span className="text-[10px] font-black uppercase tracking-tighter group-hover:text-orange-500 transition-colors">Ajouter Photo</span>
                                </div>
                            )}
                        </div>
                        {/* Glow effect if photo exists */}
                        {photoPreview && <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl -z-10 animate-pulse"></div>}
                        
                        <div className="absolute bottom-2 right-2 w-10 h-10 citrus-gradient text-white rounded-full flex items-center justify-center shadow-lg border-4 border-slate-50 group-hover:scale-110 transition-transform">
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
                            <label className="absolute left-5 top-4 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all group-focus-within:text-orange-600">Prénom</label>
                            <input 
                                required
                                type="text" 
                                value={formData.prenom}
                                onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-5 pt-8 pb-4 text-sm font-bold focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm text-slate-900 placeholder-slate-300"
                                placeholder="ex: Jean-Marc"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="group relative">
                                <label className="absolute left-5 top-4 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all group-focus-within:text-orange-600">Nom</label>
                                <input 
                                    required
                                    type="text" 
                                    value={formData.nom}
                                    onChange={(e) => setFormData({...formData, nom: e.target.value})}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 pt-8 pb-4 text-sm font-bold focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm text-slate-900"
                                />
                            </div>
                            <div className="group relative">
                                <label className="absolute left-5 top-4 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all group-focus-within:text-orange-600">Postnom</label>
                                <input 
                                    type="text" 
                                    value={formData.postnom}
                                    onChange={(e) => setFormData({...formData, postnom: e.target.value})}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 pt-8 pb-4 text-sm font-bold focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm text-slate-900"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sexe Selection */}
                    <div className="pt-4 space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexe</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, sexe: "M"})}
                                className={`py-4 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all ${formData.sexe === 'M' ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-lg shadow-orange-500/10' : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200 hover:text-orange-600 shadow-sm'}`}
                            >
                                <span className="material-symbols-outlined">male</span>
                                <span className="text-xs font-black uppercase tracking-widest">Masculin</span>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, sexe: "F"})}
                                className={`py-4 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all ${formData.sexe === 'F' ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-lg shadow-orange-500/10' : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200 hover:text-orange-600 shadow-sm'}`}
                            >
                                <span className="material-symbols-outlined">female</span>
                                <span className="text-xs font-black uppercase tracking-widest">Féminin</span>
                            </button>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="pt-4 space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact WhatsApp</p>
                        <div className="group relative">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 text-slate-400">
                                <span className="material-symbols-outlined text-xl">call</span>
                                <span className="text-xs font-bold border-r border-slate-200 pr-3">+243</span>
                            </div>
                            <input 
                                required
                                type="tel" 
                                value={formData.telephone}
                                onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-2xl pl-24 pr-5 py-5 text-sm font-bold focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm text-slate-900 placeholder-slate-300"
                                placeholder="81 234 56 78"
                            />
                        </div>
                        <p className="text-[9px] text-slate-500 font-medium px-2 italic">
                            * Ce numéro sera utilisé pour vous envoyer vos rapports de service et instructions.
                        </p>
                    </div>
                </div>

                {/* Submit Action */}
                <div className="pt-10">
                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full citrus-gradient text-white py-6 rounded-[32px] font-black text-sm shadow-2xl shadow-orange-500/20 active:scale-95 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
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
                    <p className="mt-6 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">BarPilote Security Interface — Protocol 2.4.1</p>
                </div>
            </form>
        </div>
    );
}
