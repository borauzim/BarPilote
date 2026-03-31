"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuthClient, getToken } from "@/lib/auth";
import Script from "next/script";

export default function OnboardingIdentityPage() {
    const router = useRouter();
    const [barName, setBarName] = useState("");
    const [barAddress, setBarAddress] = useState("");
    const [locationData, setLocationData] = useState({
        placeId: "",
        lat: -4.4419, // Kinshasa par défaut
        lng: 15.2663,
    });
    const [barLogo, setBarLogo] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const markerRef = useRef<any>(null);
    const autocompleteRef = useRef<any>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

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

    const detectLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const pos = { lat, lng };

                    setLocationData((prev) => ({ ...prev, lat, lng }));

                    if (mapRef.current && markerRef.current) {
                        mapRef.current.setCenter(pos);
                        mapRef.current.setZoom(17);
                        markerRef.current.setPosition(pos);
                    }

                    // Tentative de géocodage inverse pour l'adresse
                    if (window.google) {
                        const geocoder = new window.google.maps.Geocoder();
                        geocoder.geocode({ location: pos }, (results: any, status: any) => {
                            if (status === "OK" && results[0]) {
                                setBarAddress(results[0].formatted_address);
                            }
                        });
                    }
                },
                (error) => {
                    console.error("Erreur de géolocalisation:", error);
                }
            );
        }
    };

    const initAutocomplete = () => {
        if (!inputRef.current || !mapContainerRef.current || !window.google) return;

        // Initialisation de la carte
        mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
            center: { lat: locationData.lat, lng: locationData.lng },
            zoom: 15,
            disableDefaultUI: true,
            styles: [
                { "featureType": "water", "elementType": "all", "stylers": [{ "color": "#fb923c" }, { "visibility": "on" }] }
                // ... (styles simplifiés pour la démo, on peut garder l'original si besoin)
            ]
        });

        markerRef.current = new window.google.maps.Marker({
            position: { lat: locationData.lat, lng: locationData.lng },
            map: mapRef.current,
            icon: {
                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                fillColor: "#ea580c",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#ffffff",
                scale: 1.5,
                anchor: new window.google.maps.Point(12, 22),
            }
        });

        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: "cd" },
            fields: ["address_components", "geometry", "icon", "name", "place_id", "formatted_address"],
            types: ["establishment", "geocode"],
        });

        autocompleteRef.current.addListener("place_changed", () => {
            const place = autocompleteRef.current?.getPlace();
            if (place && place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const pos = { lat, lng };

                setBarAddress(place.formatted_address || "");
                setLocationData({ placeId: place.place_id || "", lat, lng });

                if (mapRef.current && markerRef.current) {
                    mapRef.current.setCenter(pos); mapRef.current.setZoom(17);
                    markerRef.current.setPosition(pos);
                }
                if (place.name && !barName) setBarName(place.name);
            }
        });

        // Auto-détection dès que Google Maps est prêt
        detectLocation();
    };

    useEffect(() => {
        // Détecter la position au chargement si possible
        if (window.google) {
            detectLocation();
        }
    }, []);

    const handleEstablishBar = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const token = getToken();
            if (!token) {
                throw new Error("Session expirée. Veuillez vous reconnecter.");
            }

            // Récupération automatique du type choisi à l'étape précédente
            const savedType = localStorage.getItem("selected_establishment_type") || "BAR";
            
            const payload = {
                nom: barName,
                adresse: barAddress,
                google_place_id: locationData.placeId,
                latitude: locationData.lat,
                longitude: locationData.lng,
                type_etablissement: savedType
            };

            console.log("Syncing Bar Identity with Pilot Engine...", payload);

            const api = getAuthClient();
            const response = await api.post('/api/proprietaire/bars/', payload);

            console.log("✅ Bar créé avec succès:", response.data);
            
            // Sauvegarder les infos du bar pour la page QR
            localStorage.setItem("created_bar", JSON.stringify({
                id: response.data.id,
                nom: response.data.nom,
                code_invitation: response.data.code_invitation,
                type_etablissement: response.data.type_etablissement,
            }));
            
            router.push("/onboarding/establishment-qr");
        } catch (error: any) {
            console.error("Failed to sync bar identity:", error);
            const detail = error.response?.data;
            let msg = "Erreur de création de l'établissement.";
            if (typeof detail === 'string') msg = detail;
            else if (detail?.detail) msg = detail.detail;
            else if (detail?.nom) msg = 'Nom: ' + detail.nom.join(', ');
            else if (error.message) msg = error.message;
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-on-surface">
            <Script
                src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
                onLoad={initAutocomplete}
            />
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
                                <label className="absolute bottom-0 right-0 bg-orange-600 text-white p-2 rounded-full cursor-pointer shadow-lg active:scale-90 transition-transform">
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                    <input className="hidden" type="file" accept="image/*" onChange={handleImageChange} />
                                </label>
                            </div>
                            <div className="text-center">
                                <p className="text-on-surface font-semibold text-lg">Logo ou photo de l'établissement</p>
                                <p className="text-on-surface-variant text-xs uppercase tracking-widest mt-1 opacity-60">
                                    Établissez votre marque
                                </p>
                            </div>
                        </div>

                        {/* Le choix du type a été déplacé à l'étape précédente */}

                        {/* Identity Form */}
                        <div className="space-y-6">
                            {/* Nom du Bar */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-1">
                                    Nom de l'établissement
                                </label>
                                <div className="relative group">
                                    <input
                                        value={barName}
                                        onChange={(e) => setBarName(e.target.value)}
                                        className="w-full bg-surface-container-low border-none rounded-lg px-4 py-4 focus:ring-2 focus:ring-orange-200 focus:bg-white transition-all duration-300 outline-none text-on-surface font-bold"
                                        placeholder="Entrez le nom de l'établissement"
                                        type="text"
                                    />
                                </div>
                            </div>

                            {/* Adresse du Bar */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-1">
                                    Adresse du Bar (Auto-complétion Google)
                                </label>
                                <div className="relative group">
                                    <input
                                        ref={inputRef}
                                        value={barAddress}
                                        onChange={(e) => setBarAddress(e.target.value)}
                                        className="w-full bg-surface-container-low border-none rounded-lg px-4 py-4 pr-12 focus:ring-2 focus:ring-orange-200 focus:bg-white transition-all duration-300 outline-none text-on-surface"
                                        placeholder="Recherchez l'adresse précise..."
                                        type="text"
                                    />
                                    <button 
                                        onClick={detectLocation}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-600 hover:text-orange-700 transition-colors p-1"
                                    >
                                        <span className="material-symbols-outlined">my_location</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Map Snippet */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                                    Localisation Radar
                                </label>
                                <span className="text-[10px] text-orange-600 font-bold tracking-tighter">
                                    CARTE DYNAMIQUE ACTIVE
                                </span>
                            </div>
                            <div
                                ref={mapContainerRef}
                                className="w-full h-48 rounded-lg overflow-hidden bg-surface-container executive-shadow transition-all duration-500"
                            >
                                {/* Google Map will render here */}
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="pt-4 space-y-4">
                            {errorMsg && (
                                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-[10px] font-bold flex items-center gap-2 animate-pulse">
                                    <span className="material-symbols-outlined text-xs">error</span>
                                    {errorMsg}
                                </div>
                            )}

                            <button
                                onClick={handleEstablishBar}
                                disabled={!barName || !barAddress || isLoading}
                                className="w-full citrus-gradient text-white font-bold py-5 rounded-full executive-shadow active:scale-95 transition-all duration-200 tracking-tight text-lg disabled:opacity-50 disabled:cursor-not-allowed uppercase flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <span className="animate-spin material-symbols-outlined text-sm">sync</span>
                                        Établissement...
                                    </>
                                ) : "Établir le Cockpit"}
                            </button>
                        </div>
                    </div>
                </div>

                <p className="mt-8 text-center text-on-surface-variant text-xs opacity-60">
                    Propulsé par <span className="text-orange-600 font-bold uppercase tracking-tighter">BarPilote Intelligence</span>
                </p>
            </main>
        </div>
    );
}
