import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type OccurrenceLike = { id: string; company_id?: string | null };

export function useDeleteOccurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (occ: OccurrenceLike) => {
      if (!occ.company_id) throw new Error("Ocorrência sem empresa vinculada");
      const { data, error } = await supabase
        .from("occurrences")
        .delete()
        .eq("id", occ.id)
        .eq("company_id", occ.company_id)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Não foi possível remover esta ocorrência");
      return data;
    },
    onSuccess: () => {
      toast.success("Ocorrência removida.");
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao remover ocorrência."),
  });
}

export function OccurrenceDeleteButton({ occurrence }: { occurrence: OccurrenceLike }) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteOccurrence();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Remover ocorrência"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={14} />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja remover esta ocorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate(occurrence, { onSuccess: () => setOpen(false) });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
