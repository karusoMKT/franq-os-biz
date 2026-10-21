import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function usePayableUnits(companyId: string | null) {
  return useQuery({
    queryKey: ["payable-units", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) throw new Error("Perfil sem empresa vinculada");
      const { data, error } = await supabase.from("units").select("id,name").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function PayableUnitSelect({ id, value, onChange, query }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  query: ReturnType<typeof usePayableUnits>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Unidade *</Label>
      <Select value={value} onValueChange={onChange} disabled={query.isPending || query.isError} required>
        <SelectTrigger id={id} aria-required="true"><SelectValue placeholder={query.isPending ? "Carregando unidades..." : "Selecione a unidade"} /></SelectTrigger>
        <SelectContent>{(query.data ?? []).map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>)}</SelectContent>
      </Select>
      {query.isError && <p className="text-sm text-destructive">Não foi possível carregar as unidades.</p>}
      {!query.isPending && !query.isError && !query.data?.length && <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>}
    </div>
  );
}