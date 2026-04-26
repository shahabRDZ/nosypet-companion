/**
 * Thin fetch wrapper that talks to the Django API.
 *
 * - Reads CSRF token from the `csrftoken` cookie set by /api/auth/csrf/.
 * - Always sends credentials so the session cookie travels both ways.
 * - Throws an `ApiError` on non-2xx so callers can branch cleanly.
 */
import type {
    Certificate,
    ChatReply,
    Companion,
    MemoryEntry,
    Session,
} from "../types/companion";

const BASE = "/api";

export class ApiError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status: number) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const headers: Record<string, string> = {
        Accept: "application/json",
        ...((options.headers as Record<string, string>) ?? {}),
    };
    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }
    const csrf = getCookie("csrftoken");
    if (csrf && options.method && options.method !== "GET") {
        headers["X-CSRFToken"] = csrf;
    }

    const res = await fetch(`${BASE}${path}`, {
        credentials: "include",
        ...options,
        headers,
    });

    let payload: unknown = null;
    try {
        payload = await res.json();
    } catch {
        // empty body is OK for some endpoints
    }

    if (!res.ok) {
        const p = (payload ?? {}) as { error?: string; message?: string };
        throw new ApiError(
            p.message ?? `Request failed (${res.status})`,
            p.error ?? "unknown",
            res.status,
        );
    }
    return payload as T;
}

export const api = {
    // Auth
    csrf: () => request<{ csrf_token: string }>("/auth/csrf/"),
    session: () => request<Session>("/auth/session/"),
    signup: (body: { username: string; password: string; email?: string }) =>
        request<Session>("/auth/signup/", { method: "POST", body: JSON.stringify(body) }),
    login: (body: { username: string; password: string }) =>
        request<Session>("/auth/login/", { method: "POST", body: JSON.stringify(body) }),
    logout: () =>
        request<{ authenticated: false }>("/auth/logout/", { method: "POST" }),

    // Companion
    hatch: (body: { name: string; pledge_signature: string }) =>
        request<Companion>("/companion/hatch/", { method: "POST", body: JSON.stringify(body) }),
    me: () => request<Companion>("/companion/me/"),
    certificate: () => request<Certificate>("/companion/certificate/"),
    rename: (body: { name: string }) =>
        request<Companion>("/companion/rename/", { method: "POST", body: JSON.stringify(body) }),

    // Actions
    feed:  () => request<Companion>("/companion/feed/",  { method: "POST" }),
    play:  () => request<Companion>("/companion/play/",  { method: "POST" }),
    sleep: () => request<Companion>("/companion/sleep/", { method: "POST" }),
    pet:   () => request<Companion>("/companion/pet/",   { method: "POST" }),
    wash:  () => request<Companion>("/companion/wash/",  { method: "POST" }),
    heal:  (kind: "medicine" | "soup" | "vet" = "medicine") =>
        request<Companion>("/companion/heal/", { method: "POST", body: JSON.stringify({ kind }) }),
    revive: () => request<Companion>("/companion/revive/", { method: "POST" }),

    // Chat & memories
    chat: (message: string) =>
        request<ChatReply>("/companion/chat/", { method: "POST", body: JSON.stringify({ message }) }),
    memories: () => request<{ memories: MemoryEntry[] }>("/companion/memories/"),

    verify: (uniqueCode: string) =>
        request<{ verified: boolean }>(`/verify/${encodeURIComponent(uniqueCode)}/`),
};
