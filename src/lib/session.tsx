import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Me = { authenticated: boolean; localOpen?: boolean };

const SessionContext = createContext<{
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
} | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const response = await fetch("/api/auth/me", { credentials: "include" });
    if (!response.ok) {
      setMe({ authenticated: false });
      return;
    }
    setMe((await response.json()) as Me);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  return (
    <SessionContext.Provider value={{ me, loading, refresh }}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session is missing");
  return value;
}
