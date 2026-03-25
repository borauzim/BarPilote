"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingIdentityPage() {
    const router = useRouter();
    const [barName, setBarName] = useState("");
    const [barAddress, setBarAddress] = useState("");
    const [barLogo, setBarLogo] = useState<string | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBarLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEstablishBar = () => {
        // Appel API à créer plus tard pour sauvegarder l'identité
        console.log("Saving Bar Identity:", { barName, barAddress, logo: !!barLogo });
        // Redirection vers le Dashboard
        router.push("/");
    };

    return (
        <div className="min-h-screen bg-background text-on-surface">
            {/* TopAppBar */}
            <header className="bg-surface/80 backdrop-blur-md fixed top-0 w-full z-50 shadow-[0_10px_30px_rgba(26,28,29,0.04)]">
                <div className="flex justify-between items-center w-full px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="text-orange-600 hover:bg-slate-200/50 transition-all p-2 rounded-full active:scale-95 duration-200 ease-in-out"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h1 className="text-slate-900 font-semibold tracking-tight text-xl">
                            Identité du Bar
                        </h1>
                    </div>
                    <div className="text-xl font-black text-orange-600 tracking-tighter">
                        Aero-Identity
                    </div>
                    <button className="text-slate-400 hover:bg-slate-200/50 transition-all p-2 rounded-full active:scale-95 duration-200 ease-in-out">
                        <span className="material-symbols-outlined">more_vert</span>
                    </button>
                </div>
            </header>

            <main className="pt-24 pb-12 px-4 max-w-2xl mx-auto min-h-screen">
                {/* Content Canvas */}
                <div className="bg-surface-container-lowest rounded-xl executive-shadow overflow-hidden">
                    <div className="p-8 space-y-10">
                        {/* Bar Logo/Photo Selection */}
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-full bg-surface-container flex items-center justify-center border-4 border-surface-container-lowest executive-shadow transition-transform active:scale-95 duration-200 overflow-hidden relative">
                                    {barLogo ? (
                                        <img src={barLogo} alt="Bar Logo Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-on-surface-variant text-4xl">
                                            camera_alt
                                        </span>
                                    )}
                                </div>
                                <label className="absolute bottom-0 right-0 bg-primary-container text-white p-2 rounded-full cursor-pointer shadow-lg active:scale-90 transition-transform">
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                    <input className="hidden" type="file" accept="image/*" onChange={handleImageChange} />
                                </label>
                            </div>
                            <div className="text-center">
                                <p className="text-on-surface font-semibold">Bar Logo/Photo</p>
                                <p className="text-on-surface-variant text-xs uppercase tracking-widest mt-1">
                                    Établissez votre marque
                                </p>
                            </div>
                        </div>

                        {/* Identity Form */}
                        <div className="space-y-6">
                            {/* Nom du Bar */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-1">
                                    Nom du Bar
                                </label>
                                <div className="relative group">
                                    <input
                                        value={barName}
                                        onChange={(e) => setBarName(e.target.value)}
                                        className="w-full bg-surface-container-low border-none rounded-lg px-4 py-4 focus:ring-2 focus:ring-primary-container focus:bg-white transition-all duration-300 outline-none text-on-surface"
                                        placeholder="Entrez le nom de l'établissement"
                                        type="text"
                                    />
                                </div>
                            </div>

                            {/* Adresse du Bar */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-1">
                                    Adresse du Bar
                                </label>
                                <div className="relative group">
                                    <input
                                        value={barAddress}
                                        onChange={(e) => setBarAddress(e.target.value)}
                                        className="w-full bg-surface-container-low border-none rounded-lg px-4 py-4 pr-12 focus:ring-2 focus:ring-primary-container focus:bg-white transition-all duration-300 outline-none text-on-surface"
                                        placeholder="Adresse précise à Kinshasa"
                                        type="text"
                                    />
                                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary-container transition-colors">
                                        <span className="material-symbols-outlined">my_location</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Map Snippet */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                                    Localisation Kinshasa
                                </label>
                                <span className="text-[10px] text-primary font-bold">
                                    CARTE ACTIVE
                                </span>
                            </div>
                            <div className="w-full h-48 rounded-lg overflow-hidden bg-surface-container relative">
                                <img
                                    className="w-full h-full object-cover opacity-80 grayscale-[20%]"
                                    alt="Modern satellite map view of Kinshasa city streets"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDbwbJ2BKQkeTAfvLnloQVEJbX5JOKvE2yEa_9vZyrjmKkHJjreg-IiSHR3MxxivBTenmKZ7lNvZGdYjN9AlcFqtbm1Y7_MDeuyx8LRXckTrA7zCMwNmjwIjSzNI1TCQRHarTUqZBd_g-VIbs7F06CKbux8oYre8SSELAYAYXBAsBFb3nSyiX8t_9hYnd67Ku8xi15ioHgGXHnIW4rd0sZw2niGdZVCuDFVsr1RzFlNewUCLnq9JQbPMlYXd6bIR9iccnz66TAGPUqJ"
                                />
                                {/* Map Pointer Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="relative">
                                        <span
                                            className="material-symbols-outlined text-orange-600 text-4xl drop-shadow-lg"
                                            style={{ fontVariationSettings: "'FILL' 1" }}
                                        >
                                            location_on
                                        </span>
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/20 rounded-full blur-[2px]"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="pt-4">
                            <button
                                onClick={handleEstablishBar}
                                disabled={!barName || !barAddress}
                                className="w-full citrus-gradient text-white font-bold py-5 rounded-full executive-shadow active:scale-95 transition-all duration-200 tracking-tight text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Établir le Bar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footnote / Help */}
                <p className="mt-8 text-center text-on-surface-variant text-sm px-6">
                    Ces informations seront utilisées pour configurer votre cockpit de gestion{" "}
                    <span className="text-orange-600 font-semibold">Aero-Identity</span>.
                </p>
            </main>
        </div>
    );
}
