import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { GarageState } from "./types";

type GarageContextValue = {
  garage: GarageState | null;
  error: string | null;
  save: (next: GarageState) => Promise<void>;
};

const GarageContext = createContext<GarageContextValue | null>(null);

export function GarageProvider({ children }: { children: ReactNode }) {
  const [garage, setGarage] = useState<GarageState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/garage", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("The garage did not load.");
        setGarage((await response.json()) as GarageState);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  async function save(next: GarageState) {
    setGarage(next);
    const response = await fetch("/api/garage", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "The garage did not save.");
      return;
    }
    setError(null);
    setGarage((await response.json()) as GarageState);
  }

  return <GarageContext.Provider value={{ garage, error, save }}>{children}</GarageContext.Provider>;
}

export function useGarage() {
  const value = useContext(GarageContext);
  if (!value) throw new Error("Garage is missing");
  return value;
}
