/**
 * Live companion state with visibility-aware polling.
 *
 * Polls `/api/companion/me/` every POLL_MS while the tab is visible.
 * Returns the latest server state plus action helpers that POST to
 * the API and merge the response into local state.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, api } from "../api/client";
import type { Companion } from "../types/companion";

const POLL_MS = 7000;

type Status = "loading" | "ready" | "error";

export interface LiveCompanion {
    state: Companion | null;
    status: Status;
    error: string | null;
    refresh: () => Promise<void>;
    feed: () => Promise<void>;
    play: () => Promise<void>;
    sleep: () => Promise<void>;
    pet: () => Promise<void>;
    wash: () => Promise<void>;
    heal: (kind?: "medicine" | "soup" | "vet") => Promise<void>;
    revive: () => Promise<void>;
    chat: (message: string) => Promise<{ reply: string; in_coma: boolean }>;
}

export function useLiveCompanion(): LiveCompanion {
    const [state, setState] = useState<Companion | null>(null);
    const [status, setStatus] = useState<Status>("loading");
    const [error, setError] = useState<string | null>(null);
    const timer = useRef<number | undefined>(undefined);

    const refresh = useCallback(async () => {
        if (document.hidden) return;
        try {
            const c = await api.me();
            setState(c);
            setStatus("ready");
            setError(null);
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : "Lost connection";
            setError(msg);
            setStatus("error");
        }
    }, []);

    useEffect(() => {
        refresh();
        timer.current = window.setInterval(refresh, POLL_MS);
        const onVisibility = () => {
            if (!document.hidden) refresh();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            if (timer.current !== undefined) window.clearInterval(timer.current);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [refresh]);

    const wrap = <Args extends unknown[]>(fn: (...a: Args) => Promise<Companion>) => {
        return async (...args: Args) => {
            try {
                const c = await fn(...args);
                setState(c);
            } catch (e) {
                if (e instanceof ApiError) setError(e.message);
            }
        };
    };

    const chat = useCallback(async (message: string) => {
        const reply = await api.chat(message);
        // Refresh state after a chat (memory/trait may have changed).
        refresh();
        return reply;
    }, [refresh]);

    return {
        state,
        status,
        error,
        refresh,
        feed:  wrap(api.feed),
        play:  wrap(api.play),
        sleep: wrap(api.sleep),
        pet:   wrap(api.pet),
        wash:  wrap(api.wash),
        heal:  wrap(api.heal),
        revive: wrap(api.revive),
        chat,
    };
}
