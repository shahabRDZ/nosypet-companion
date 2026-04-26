/**
 * Floating action dock that sits at the bottom of the canvas.
 * Glassmorphic pill with circular icon buttons. Shows a label tooltip
 * on hover; press to fire the action.
 */
import type { ReactNode } from "react";

export interface Action {
    key: string;
    icon: ReactNode;
    label: string;
    onClick: () => void;
    hidden?: boolean;
    disabled?: boolean;
    accent?: string;
}

interface Props {
    actions: Action[];
}

export function ActionDock({ actions }: Props) {
    const visible = actions.filter(a => !a.hidden);
    return (
        <nav className="action-dock" aria-label="Companion actions">
            {visible.map((a) => (
                <button
                    key={a.key}
                    className="dock-button"
                    style={a.accent ? { ["--accent" as string]: a.accent } : undefined}
                    onClick={a.onClick}
                    disabled={a.disabled}
                    aria-label={a.label}
                    title={a.label}
                >
                    <span className="dock-icon" aria-hidden="true">{a.icon}</span>
                    <span className="dock-label">{a.label}</span>
                </button>
            ))}
        </nav>
    );
}
