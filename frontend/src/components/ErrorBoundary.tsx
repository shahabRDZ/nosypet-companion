import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, message: "" };

    static getDerivedStateFromError(err: Error): State {
        return { hasError: true, message: err.message || "Something broke." };
    }

    componentDidCatch(err: Error): void {
        console.error("ErrorBoundary:", err);
    }

    render() {
        if (this.state.hasError) {
            return (
                <main className="shell">
                    <section className="card center" style={{ maxWidth: 420, margin: "3rem auto" }}>
                        <div style={{ fontSize: "3rem" }}>😵</div>
                        <h1>Something broke</h1>
                        <p className="muted" style={{ marginBottom: "1rem" }}>{this.state.message}</p>
                        <button className="btn" onClick={() => window.location.reload()}>Reload</button>
                    </section>
                </main>
            );
        }
        return this.props.children;
    }
}
