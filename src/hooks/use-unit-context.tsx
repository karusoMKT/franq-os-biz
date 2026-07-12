import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

export type UnitOption = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

type UnitContextValue = {
  selectedUnitId: string | null; // null = Visão Geral
  setSelectedUnitId: (id: string | null) => void;
  units: UnitOption[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  selectedUnit: UnitOption | null;
};

const UnitContext = createContext<UnitContextValue | null>(null);

const STORAGE_KEY = "franqos:selected-unit-id";

export function UnitContextProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const companyId = profile?.company_id ?? null;
  const canLoadCompanyUnits = profile?.role === "owner" && !!companyId;

  const [selectedUnitId, setSelectedUnitIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && v !== "null" ? v : null;
  });

  const setSelectedUnitId = (id: string | null) => {
    setSelectedUnitIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const { data: units, isLoading, isError, error } = useQuery({
    enabled: canLoadCompanyUnits,
    queryKey: ["company-units", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id,name,city,state")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as UnitOption[];
    },
    refetchOnWindowFocus: false,
  });

  // For non-owners, lock context to their unit
  useEffect(() => {
    if (profile?.role !== "owner" && profile?.unit_id && selectedUnitId !== profile.unit_id) {
      setSelectedUnitIdState(profile.unit_id);
    }
  }, [profile?.role, profile?.unit_id, selectedUnitId]);

  // If selected unit no longer exists, reset
  useEffect(() => {
    if (!units || !selectedUnitId) return;
    if (!units.some((u) => u.id === selectedUnitId)) setSelectedUnitId(null);
  }, [units, selectedUnitId]);

  const value = useMemo<UnitContextValue>(() => {
    const list = units ?? [];
    return {
      selectedUnitId,
      setSelectedUnitId,
      units: list,
      isLoading: canLoadCompanyUnits ? isLoading : false,
      isError,
      errorMessage: error instanceof Error ? error.message : null,
      selectedUnit: list.find((u) => u.id === selectedUnitId) ?? null,
    };
  }, [selectedUnitId, units, canLoadCompanyUnits, isLoading, isError, error]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

export function useUnitContext() {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error("useUnitContext must be used inside UnitContextProvider");
  return ctx;
}
