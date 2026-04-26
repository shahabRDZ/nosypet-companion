import { type FormEvent, useState } from "react";

interface Props {
    onSend: (msg: string) => Promise<{ reply: string; in_coma: boolean }>;
    onReply: (text: string) => void;
    disabled?: boolean;
}

export function ChatBox({ onSend, onReply, disabled }: Props) {
    const [value, setValue] = useState("");
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const message = value.trim();
        if (!message || busy) return;
        setBusy(true);
        setValue("");
        try {
            const r = await onSend(message);
            onReply(r.reply);
        } catch {
            onReply("...");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="chat-box">
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Say something..."
                maxLength={300}
                disabled={disabled || busy}
                aria-label="Talk to your companion"
            />
            <button type="submit" className="btn" disabled={disabled || busy || !value.trim()}>
                {busy ? "..." : "Send"}
            </button>
        </form>
    );
}
