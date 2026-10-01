import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

export function LoginPage() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const optionsResponse = await fetch("/api/auth/login/options", {
        method: "POST",
        credentials: "include",
      });
      const pending = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(pending.error ?? "No passkey yet.");
      const assertion = await startAuthentication({ optionsJSON: pending.options });
      const verify = await fetch("/api/auth/login/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: pending.challengeId, response: assertion }),
      });
      if (!verify.ok) throw new Error("That passkey was not accepted.");
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

      <div className="panel mt-8 space-y-4 p-6">
        {me?.hasPasskey ? (
          <Button onClick={signIn} disabled={busy}>
            {busy ? "Waiting for passkey" : "Sign in with passkey"}
          </Button>
        ) : (
          <p className="text-white/80">This browser does not have a passkey for the car yet.</p>
        )}
        {error ? <p className="text-hot">{error}</p> : null}
        <Link className="display block text-xs text-cyan" to="/setup">
          Create a passkey
        </Link>
      </div>
    </div>
  );
}
