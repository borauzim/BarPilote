"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";

export default function ScanPage() {
    const router = useRouter();
    const [cameraActive, setCameraActive] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        // Initialiser le scanner uniquement côté client
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const startScanner = async () => {
            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                    },
                    (decodedText) => {
                        handleScanSuccess(decodedText);
                    },
                    () => {
                        // Erreurs de détection silencieuses
                    }
                );
                setCameraActive(true);
            } catch (err) {
                console.error("Erreur démarrage scanner:", err);
            }
        };

        startScanner();

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch((e) => console.log("Stop error", e));
            }
        };
    }, []);

    const handleScanSuccess = (text: string) => {
        const proceedToJoin = (decodedText: string) => {
            let code = decodedText;
            if (decodedText.includes("/join/")) {
                code = decodedText.split("/join/")[1].split("/")[0].split("?")[0];
            }
            router.push(`/join/${code}`);
        };

        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
                proceedToJoin(text);
            }).catch(err => {
                console.error(err);
                proceedToJoin(text); // On continue quand même
            });
        } else {
            proceedToJoin(text);
        }
    };

    return (
        <div className="bg-black min-h-screen flex flex-col font-sans text-white overflow-hidden relative">
            {!cameraActive && (
                <div className="absolute inset-0 z-0 bg-zinc-900 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <span className="material-symbols-outlined text-6xl text-zinc-700 animate-pulse">videocam</span>
                        <p className="text-zinc-500 font-bold tracking-tighter text-sm uppercase">Initialisation de l'OEIL Vigie...</p>
                    </div>
                </div>
            )}

            <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-zinc-900/40 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all font-bold"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                    <h1 className="text-xl font-black tracking-tighter uppercase">BarPilote <span className="text-orange-500 underline decoration-2 underline-offset-4">Vigie</span></h1>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 mb-3">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                        <span className="text-[10px] font-black tracking-[0.2em] text-orange-500 uppercase">Immigration Staff</span>
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter">Affiliation du Bar</h2>
                </div>

                <div className="relative">
                    <div id="reader" className="w-[300px] h-[300px] overflow-hidden rounded-[40px] bg-black border border-white/10 shadow-2xl"></div>
                    <div className="absolute inset-0 pointer-events-none z-20">
                        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-orange-500 rounded-tl-[2rem]"></div>
                        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-orange-500 rounded-tr-[2rem]"></div>
                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-orange-500 rounded-bl-[2rem]"></div>
                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-orange-500 rounded-br-[2rem]"></div>
                        <div className="absolute top-1/2 left-4 right-4 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent shadow-[0_0_15px_rgba(255,94,0,0.8)] opacity-60 scan-animation"></div>
                    </div>
                </div>

                <div className="mt-12 text-center max-w-xs">
                    <p className="text-zinc-400 text-sm font-semibold leading-relaxed">
                        Scannez le code QR du Bar pour lier votre compte à l'établissement.
                    </p>
                    
                    <div className="mt-8 flex items-center justify-center gap-8">
                        <button className="flex flex-col items-center gap-2 group">
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all hover:bg-white/10">
                                <span className="material-symbols-outlined text-zinc-400 group-hover:text-white">flashlight_on</span>
                            </div>
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Torche</span>
                        </button>
                        <div className="h-8 w-px bg-zinc-800"></div>
                        <button 
                            onClick={() => {
                                const input = document.getElementById('qr-input-file') as HTMLInputElement;
                                if (input) input.click();
                            }}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all hover:bg-white/10">
                                <span className="material-symbols-outlined text-zinc-400 group-hover:text-white">image</span>
                            </div>
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Galerie</span>
                        </button>
                        <input 
                            id="qr-input-file"
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file && scannerRef.current) {
                                    try {
                                        // On arrête la caméra temporairement pour scanner le fichier
                                        if (scannerRef.current.isScanning) {
                                            await scannerRef.current.stop();
                                            setCameraActive(false);
                                        }
                                        
                                        const result = await scannerRef.current.scanFile(file, true);
                                        handleScanSuccess(result);
                                    } catch (err) {
                                        console.error("Erreur scan fichier:", err);
                                        alert("Aucun QR code valide n'a été trouvé sur cette photo.");
                                        // On relance la caméra si le scan de fichier échoue
                                        window.location.reload(); 
                                    } finally {
                                        e.target.value = ""; // Reset pour permettre de re-sélectionner le même fichier
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            </main>

            <div className="fixed bottom-10 left-0 w-full flex justify-center z-50">
                <button className="bg-white text-black px-8 py-4 rounded-full font-black text-sm flex items-center gap-3 shadow-2xl active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-orange-600">help_center</span>
                    BESOIN D'AIDE ?
                </button>
            </div>

            <style jsx>{`
                .scan-animation {
                    animation: scan 2s linear infinite;
                }
                @keyframes scan {
                    0% { top: 10%; }
                    100% { top: 90%; }
                }
                :global(#reader video) {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                }
                :global(#reader__dashboard) {
                    display: none !important;
                }
                :global(#reader) {
                    border: none !important;
                }
            `}</style>
        </div>
    );
}
