import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Save, Building2, Calendar, DollarSign, Tag, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/use-profile";
import { PayableUnitSelect, usePayableUnits } from "@/components/payable-unit-select";
import { requirePayableUnit } from "@/lib/payable-unit";

const CATEGORIES = [
  "Operacional",
  "Fornecedores",
  "Serviços",
  "Infraestrutura",
  "Pessoal",
  "Impostos",
  "Marketing",
  "Outros",
];

type FormState = {
  unit_id: string;
  supplier_name: string;
  amount: string;
  due_date: string;
  category: string;
  notes: string;
  already_paid: boolean;
};

const EMPTY_FORM: FormState = {
  unit_id: "",
  supplier_name: "",
  amount: "",
  due_date: "",
  category: "",
  notes: "",
  already_paid: false,
};

export function ManualPayableButton({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const qc = useQueryClient();
  const unitsQuery = usePayableUnits(profile.company_id);

  const reset = () => setForm(EMPTY_FORM);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile.company_id) throw new Error("Perfil sem empresa vinculada");
      const unitId = requirePayableUnit(form.unit_id, unitsQuery.data ?? []);
      if (!form.supplier_name.trim()) throw new Error("Informe a descrição / fornecedor");
      const amountNum = Number(form.amount.replace(",", "."));
      if (!isFinite(amountNum) || amountNum <= 0) throw new Error("Valor inválido");
      if (!form.due_date) throw new Error("Informe a data de vencimento");

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("accounts_payable").insert({
        company_id: profile.company_id,
        unit_id: unitId,
        supplier_name: form.supplier_name.trim(),
        amount: amountNum,
        due_date: form.due_date,
        category: form.category || null,
        notes: form.notes.trim() || null,
        status: form.already_paid ? "paid" : "pending",
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta cadastrada com sucesso!");
      qc.invalidateQueries({ queryKey: ["accounts_payable"] });
      qc.invalidateQueries({ queryKey: ["available-months"] });
      setOpen(false);
      reset();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full h-11 px-3 text-sm"
      >
        <Plus size={18} />
        Nova Conta a Pagar
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova conta a pagar</DialogTitle>
            <DialogDescription>
              Cadastre a conta manualmente, sem escanear boleto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <PayableUnitSelect id="mp-unit" value={form.unit_id} onChange={(unit_id) => setForm((f) => ({ ...f, unit_id }))} query={unitsQuery} />
            <div className="space-y-1.5">
              <Label htmlFor="mp-supplier" className="flex items-center gap-1.5">
                <Building2 size={14} /> Descrição / Fornecedor
              </Label>
              <Input
                id="mp-supplier"
                value={form.supplier_name}
                onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                placeholder="Ex: Aluguel, Conta de Luz"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mp-amount" className="flex items-center gap-1.5">
                <DollarSign size={14} /> Valor (R$)
              </Label>
              <Input
                id="mp-amount"
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mp-due" className="flex items-center gap-1.5">
                <Calendar size={14} /> Data de Vencimento
              </Label>
              <Input
                id="mp-due"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Tag size={14} /> Categoria
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mp-notes" className="flex items-center gap-1.5">
                <FileText size={14} /> Observações / Código de Barras (opcional)
              </Label>
              <Textarea
                id="mp-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Anotações ou código de barras do boleto"
                maxLength={1000}
                rows={3}
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.already_paid}
                onChange={(e) => setForm((f) => ({ ...f, already_paid: e.target.checked }))}
                className="h-4 w-4"
              />
              Já foi paga
            </label>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || unitsQuery.isPending || unitsQuery.isError}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
