import { create } from "zustand";

import { api } from "../api/client";
import type { Companion, Session } from "../types/companion";

interface SessionState {
    session: Session | null;
    companion: Companion | null;
    bootstrapping: boolean;
    refresh: () => Promise<void>;
    setCompanion: (c: Companion | null) => void;
    logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
    session: null,
    companion: null,
    bootstrapping: true,

    refresh: async () => {
        // Always grab a CSRF cookie before any POST.
        await api.csrf();
        const session = await api.session();
        let companion: Companion | null = null;
        if (session.authenticated && session.has_companion) {
            try {
                companion = await api.me();
            } catch {
                companion = null;
            }
        }
        set({ session, companion, bootstrapping: false });
    },

    setCompanion: (c) => set({ companion: c }),

    logout: async () => {
        await api.logout();
        set({ session: { authenticated: false }, companion: null });
    },
}));
