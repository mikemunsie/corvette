import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

export function SetupPage() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [setupCode, setSetupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const adding = Boolean(me?.authenticated && me.hasPasskey);

  async function registerPasskey() {
    setBusy(true);
    setError(null);
    try {
      const optionsResponse = await fetch("/api/auth/register/options", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setupCode }),
      });
      const pending = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(pending.error ?? "Could not start passkey setup.");
      const credential = await startRegistration({ optionsJSON: pending.options });
      const verify = await fetch("/api/auth/register/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: pending.challengeId, response: credential }),
      });
      if (!verify.ok) throw new Error("The passkey was not saved.");
      await refresh();
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <h1 className="chrome display text-3xl">{adding ? "Add a passkey" : "First passkey"}</h1>
      <p className="mt-3 text-white/75">
        {adding
          ? "You are signed in. Add the phone, or another device, without the setup code."
          : "The setup code keeps a stranger from claiming the public site. A passkey made on localhost does not sign in on the live site."}
      </p>
      <form
        className="panel mt-6 space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void registerPasskey();
        }}
      >
        {adding ? null : (
          <label className="block text-sm text-white/70">
            Setup code
            <input
              className="mt-1 w-full border border-cyan/40 bg-black/40 px-3 py-2"
              value={setupCode}
              onChange={(event) => setSetupCode(event.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Waiting for passkey" : "Create passkey"}
        </Button>
        {error ? <p className="text-hot">{error}</p> : null}
        <Link className="display block text-xs text-cyan" to="/">
          Back
        </Link>
      </form>
    </div>
  );
}
