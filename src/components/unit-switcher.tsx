import { Building2, ChevronDown, Check, Globe2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUnitContext } from "@/hooks/use-unit-context";
import type { Profile } from "@/hooks/use-profile";

export function UnitSwitcher({ profile }: { profile: Profile }) {
  const { selectedUnitId, setSelectedUnitId, units, selectedUnit, isLoading, isError, errorMessage } = useUnitContext();

  // Only owners can switch context
  if (profile.role !== "owner") return null;

  const label = selectedUnit ? selectedUnit.name : "Visão Geral";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 max-w-[180px]"
        aria-label="Selecionar unidade"
      >
        {selectedUnit ? (
          <Building2 size={14} className="text-[color:var(--franqos-blue)] shrink-0" />
        ) : (
          <Globe2 size={14} className="text-[color:var(--franqos-blue)] shrink-0" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          Contexto ativo
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setSelectedUnitId(null)} className="gap-2">
          <Globe2 size={14} />
          <span className="flex-1">Visão Geral (Todas as Unidades)</span>
          {selectedUnitId === null && <Check size={14} />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isLoading && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            Carregando...
          </DropdownMenuItem>
        )}
        {!isLoading && units.length === 0 && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            Nenhuma unidade cadastrada
          </DropdownMenuItem>
        )}
        {isError && (
          <DropdownMenuItem disabled className="text-xs text-red-600">
            {errorMessage ?? "Erro ao carregar unidades"}
          </DropdownMenuItem>
        )}
        {units.map((u) => (
          <DropdownMenuItem key={u.id} onSelect={() => setSelectedUnitId(u.id)} className="gap-2">
            <Building2 size={14} />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{u.name}</div>
              {(u.city || u.state) && (
                <div className="text-[10px] text-muted-foreground truncate">
                  {[u.city, u.state].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            {selectedUnitId === u.id && <Check size={14} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
