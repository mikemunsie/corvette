import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

export function LoginPage() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [setupCode, setSetupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setupCode }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Setup code is wrong.");
      }
      await refresh();
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <p className="display text-[10px] tracking-[0.35em] text-magenta">MIKES 1988</p>
      <h1 className="chrome display mt-2 text-4xl">CORVETTE</h1>

      <form
        className="panel mt-8 space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn();
        }}
      >
        <p className="text-white/75">Enter the setup code to open the garage.</p>
        <label className="block text-sm text-white/70">
          Setup code
          <input
            className="mt-1 min-h-12 w-full border border-cyan/40 bg-black/40 px-3 text-base"
            type="password"
            value={setupCode}
            onChange={(event) => setSetupCode(event.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </label>
        <Button type="submit" disabled={busy || !setupCode}>
          {busy ? "Opening" : "Open garage"}
        </Button>
        {error ? <p className="text-hot">{error}</p> : null}
      </form>
    </div>
  );
}
