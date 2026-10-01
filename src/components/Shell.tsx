import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/lib/session";
import { Button } from "./ui/button";

export function Shell({ children }: { children: ReactNode }) {
  const { me, refresh } = useSession();
  const navigate = useNavigate();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await refresh();
    navigate("/");
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="display text-[10px] tracking-[0.3em] text-magenta">1988 CONVERTIBLE</p>
          <h1 className="chrome display text-3xl sm:text-5xl">CORVETTE</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-3">
          {me?.localOpen ? null : (
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          )}
          <img
            src="/corvette-emblem.png"
            alt="Corvette emblem"
            width={505}
            height={390}
            className="h-12 w-auto drop-shadow-[0_0_14px_rgba(61,255,245,0.45)] sm:h-16"
          />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
