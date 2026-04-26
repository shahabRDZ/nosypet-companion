/**
 * Install banner: appears when the browser fires `beforeinstallprompt`
 * (Android Chrome / Edge / Samsung Internet). For iOS, where the
 * event never fires, we show a one-time gentle hint with the right
 * instructions instead.
 */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KEY = "nosypet:install-dismissed:v1";

export function InstallPrompt() {
    const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
    const [iosHint, setIosHint] = useState(false);

    useEffect(() => {
        if (window.localStorage.getItem(KEY)) return;

        const handler = (e: Event) => {
            e.preventDefault();
            setEvt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener("beforeinstallprompt", handler);

        // iOS-Safari fallback: show the hint only on a real iPhone, not
        // when we are already running in a standalone PWA.
        const ua = navigator.userAgent;
        const isIos = /iPad|iPhone|iPod/.test(ua);
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as unknown as { standalone?: boolean }).standalone === true;
        if (isIos && !isStandalone) setIosHint(true);

        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    function dismiss() {
        window.localStorage.setItem(KEY, "1");
        setEvt(null);
        setIosHint(false);
    }

    async function install() {
        if (!evt) return;
        await evt.prompt();
        await evt.userChoice;
        dismiss();
    }

    if (!evt && !iosHint) return null;

    return (
        <div className="install-banner">
            <span>📱 Install NosyPet for the best experience</span>
            {evt && <button className="btn" onClick={install}>Install</button>}
            {iosHint && (
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                    Tap Share <span style={{ fontFamily: "monospace" }}>↑</span> then "Add to Home Screen"
                </span>
            )}
            <button className="btn-ghost btn" onClick={dismiss} aria-label="Dismiss">×</button>
        </div>
    );
}
