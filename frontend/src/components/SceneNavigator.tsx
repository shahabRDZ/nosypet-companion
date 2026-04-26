/**
 * Compact scene navigator. Lets the user jump between rooms when no
 * action is taking the companion somewhere automatically.
 *
 * Pure UI: each button calls a navigator function on the Game.
 */
import type { ReactNode } from "react";

export interface SceneOption {
    key: string;
    icon: ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
}

interface Props {
    scenes: SceneOption[];
}

export function SceneNavigator({ scenes }: Props) {
    return (
        <nav className="scene-nav" aria-label="Scenes">
            {scenes.map((s) => (
                <button
                    key={s.key}
                    className={`scene-pill ${s.active ? "active" : ""}`}
                    onClick={s.onClick}
                    aria-label={s.label}
                    aria-current={s.active}
                >
                    <span className="scene-pill-icon" aria-hidden="true">{s.icon}</span>
                    <span className="scene-pill-label">{s.label}</span>
                </button>
            ))}
        </nav>
    );
}
