import { useState, type FormEvent } from "react";
import { API_URL } from "./env";

type RegistrationProps = {
    onSuccess: () => void;
};

function Registration({ onSuccess }: RegistrationProps) {
    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const token = new URLSearchParams(window.location.search).get("token");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (!token) {
            setError("Invitation token is missing.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_URL}/api/auth/register`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        displayName,
                        email,
                        password,
                        token,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Registration failed.");
            }

            setSuccess("Account created successfully!");

            onSuccess();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <h1>Invalid invitation</h1>
                    <p>This registration link is missing its invitation token.</p>
                </div>
            </div>
        );
    }

    return (
        <main className="auth-container">
            <form className="auth-card" onSubmit={handleSubmit}>
                <div className="auth-brand">
                    <div className="brand-icon">C</div>
                    <span>ChatApp</span>
                </div>

                <h1>Create your account</h1>
                <p className="auth-description">
                    Join ChatApp and start your private conversations.
                </p>

                <label htmlFor="displayName">Display name</label>
                <input
                    id="displayName"
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    minLength={2}
                    maxLength={50}
                    required
                />

                <label htmlFor="email">Email address</label>
                <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                />

                <label htmlFor="password">Password</label>
                <input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    maxLength={128}
                    required
                />

                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Enter your password again"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                />

                {error && <div className="auth-error">{error}</div>}
                {success && <div className="auth-success">{success}</div>}

                <button
                    type="submit"
                    className="auth-submit"
                    disabled={loading}
                >
                    {loading ? "Creating account..." : "Create account"}
                </button>

                <p className="auth-footer">
                    Private conversations. Just between you and them.
                </p>
            </form>
        </main>
    );
}

export default Registration;