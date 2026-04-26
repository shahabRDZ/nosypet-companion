/**
 * Revive ritual: ask the owner to long-press the heart 60 times in
 * 5 minutes. Each long-press fills the meter. When full, we call
 * /revive/ on the backend.
 */
import { useEffect, useRef, useState } from "react";

const TARGET = 60;
const WINDOW_MS = 5 * 60 * 1000;

interface Props {
    onComplete: () => Promise<void>;
}

export function ComaOverlay({ onComplete }: Props) {
    const [count, setCount] = useState(0);
    const startedAt = useRef<number | null>(null);
    const pressTimer = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (count === 0) return;
        if (startedAt.current === null) startedAt.current = Date.now();
        if (count >= TARGET) {
            void onComplete();
        }
        const reset = window.setTimeout(() => {
            // If they stop, slowly drain progress.
            setCount((c) => Math.max(0, c - 1));
        }, 8000);
        return () => window.clearTimeout(reset);
    }, [count, onComplete]);

    useEffect(() => {
        if (startedAt.current === null) return;
        const remaining = WINDOW_MS - (Date.now() - startedAt.current);
        if (remaining <= 0) {
            setCount(0);
            startedAt.current = null;
        }
    }, [count]);

    function start() {
        pressTimer.current = window.setTimeout(() => {
            setCount((c) => c + 1);
            pressTimer.current = undefined;
        }, 350);
    }
    function cancel() {
        if (pressTimer.current !== undefined) {
            window.clearTimeout(pressTimer.current);
            pressTimer.current = undefined;
        }
    }

    const pct = Math.round((count / TARGET) * 100);

    return (
        <div className="coma-overlay">
            <div className="coma-card">
                <h2>Your companion is unconscious.</h2>
                <p className="muted">
                    Long-press the heart 60 times within 5 minutes to bring them back. Some
                    memories may fade.
                </p>
                <button
                    className="coma-heart"
                    onPointerDown={start}
                    onPointerUp={cancel}
                    onPointerLeave={cancel}
                    aria-label="Long-press to revive"
                >
                    💗
                </button>
                <div className="coma-bar"><span style={{ width: `${pct}%` }} /></div>
                <p className="muted" style={{ fontSize: "0.85rem" }}>{count} / {TARGET}</p>
            </div>
        </div>
    );
}
