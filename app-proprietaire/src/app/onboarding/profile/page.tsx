"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function PilotProfilePage() {
    const router = useRouter();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [postName, setPostName] = useState("");
    const [phone, setPhone] = useState("");
    const [profileImage, setProfileImage] = useState<string | null>(null);

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

    const handleSaveProfile = () => {
        // API Call pour sauvegarder le profile
        console.log("Saving Pilot Profile:", { firstName, lastName, postName, phone, profileImage: !!profileImage });
        // Redirection vers "Identité du Bar"
        router.push("/onboarding");
    };

    return (
        <div className="bg-surface text-on-surface min-h-screen flex flex-col pt-16 pb-24 relative">
            <header className="fixed top-0 w-full z-50 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm dark:shadow-none font-sans antialiased text-slate-900 dark:text-slate-100 flex items-center justify-between px-6 h-16 w-full">
                <button onClick={() => router.back()} className="hover:opacity-80 transition-opacity active:scale-95 duration-200">
                    <span className="material-symbols-outlined text-on-surface" data-icon="close">
                        close
                    </span>
                </button>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    Profil de l'Exécutif
                </h1>
                <button
                    onClick={handleSaveProfile}
                    disabled={!firstName || !lastName}
                    className="text-orange-600 dark:text-orange-500 font-bold hover:opacity-80 transition-opacity active:scale-95 duration-200 disabled:opacity-50"
                >
                    Enregistrer
                </button>
            </header>

            <main className="flex-1 max-w-2xl mx-auto w-full">
                <section className="relative px-8 pt-12 pb-8 flex flex-col items-center">
                    <div className="relative group">
                        <div className="w-32 h-32 rounded-full bg-surface-container-highest overflow-hidden shadow-[0_10px_30px_rgba(26,28,29,0.08)] flex items-center justify-center border-4 border-surface-container-lowest relative">
                            {profileImage ? (
                                <img src={profileImage} alt="Profile Preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-on-surface-variant text-5xl">person</span>
                            )}
                        </div>
                        <label className="absolute bottom-0 right-0 w-10 h-10 bg-primary-container text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer">
                            <span className="material-symbols-outlined text-sm" data-icon="photo_camera">
                                photo_camera
                            </span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                        </label>
                    </div>
                    <div className="mt-8 text-center space-y-2">
                        <span className="text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
                            CONFIGURATION DE L'EXÉCUTIF
                        </span>
                        <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">
                            Complétez votre Licence
                        </h2>
                        <p className="text-sm text-on-surface-variant font-medium max-w-[280px] mx-auto opacity-70">
                            Définissez votre identité de gestionnaire pour piloter votre établissement avec précision.
                        </p>
                    </div>
                </section>

                {/* Form Section */}
                <section className="px-8 mt-4 space-y-10">
                    {/* Prénom */}
                    <div className="relative group">
                        <label className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-1 group-focus-within:text-primary transition-colors">
                            Prénom
                        </label>
                        <input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full bg-transparent border-0 border-b-2 border-surface-variant focus:border-orange-600 focus:ring-0 px-0 py-2 text-base font-semibold text-on-surface placeholder:text-on-surface-variant/30 outline-none transition-colors"
                            placeholder="Entrez votre prénom (ex: Marc-Antoine)"
                            type="text"
                        />
                    </div>

                    {/* Nom */}
                    <div className="relative group">
                        <label className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-1 group-focus-within:text-primary transition-colors">
                            Nom
                        </label>
                        <input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full bg-transparent border-0 border-b-2 border-surface-variant focus:border-orange-600 focus:ring-0 px-0 py-2 text-base font-semibold text-on-surface placeholder:text-on-surface-variant/30 outline-none transition-colors"
                            placeholder="Entrez votre nom"
                            type="text"
                        />
                    </div>

                    {/* Postnom */}
                    <div className="relative group">
                        <label className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-1 group-focus-within:text-primary transition-colors">
                            Postnom (Optionnel)
                        </label>
                        <input
                            value={postName}
                            onChange={(e) => setPostName(e.target.value)}
                            className="w-full bg-transparent border-0 border-b-2 border-surface-variant focus:border-orange-600 focus:ring-0 px-0 py-2 text-base font-semibold text-on-surface placeholder:text-on-surface-variant/30 outline-none transition-colors"
                            placeholder="Entrez votre postnom"
                            type="text"
                        />
                    </div>

                    {/* Numéro de téléphone */}
                    <div className="relative group">
                        <label className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-1 group-focus-within:text-primary transition-colors">
                            Numéro de téléphone
                        </label>
                        <div className="flex items-center">
                            <span className="text-on-surface font-semibold mr-2">+243</span>
                            <input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-transparent border-0 border-b-2 border-surface-variant focus:border-orange-600 focus:ring-0 px-0 py-2 text-base font-semibold text-on-surface placeholder:text-on-surface-variant/30 outline-none transition-colors"
                                placeholder="81 234 56 78"
                                type="tel"
                            />
                        </div>
                    </div>
                </section>

                {/* Signature Branding Moment (Asymmetric Layout Item) */}
                <div className="mt-16 px-8 flex justify-end">
                    <div className="bg-surface-container p-6 rounded-2xl max-w-[200px] shadow-sm">
                        <span className="material-symbols-outlined text-orange-600 mb-2" data-icon="verified_user">
                            verified_user
                        </span>
                        <p className="text-[11px] font-medium leading-relaxed text-on-surface-variant">
                            Vos données de profil sont cryptées selon des protocoles de sécurité de niveau exécutif.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
