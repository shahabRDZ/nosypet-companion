/**
 * Listens for `nosypet:toast` window events and renders the latest
 * message as a transient banner. Lives once at the App root.
 */
import { useEffect, useState } from "react";

interface Toast {
    id: number;
    text: string;
}

export function ToastHost() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        let counter = 0;
        const handler = (e: Event) => {
            const text = (e as CustomEvent<string>).detail;
            if (!text) return;
            const id = ++counter;
            setToasts((t) => [...t, { id, text }]);
            window.setTimeout(() => {
                setToasts((t) => t.filter((toast) => toast.id !== id));
            }, 2400);
        };
        window.addEventListener("nosypet:toast", handler as EventListener);
        return () => window.removeEventListener("nosypet:toast", handler as EventListener);
    }, []);

    if (toasts.length === 0) return null;
    return (
        <div className="toast-stack" role="status" aria-live="polite">
            {toasts.map((t) => (
                <div key={t.id} className="toast-line">{t.text}</div>
            ))}
        </div>
    );
}
