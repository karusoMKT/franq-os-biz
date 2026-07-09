import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, FolderCheck, IceCream, Coffee, UtensilsCrossed, Sandwich, MoreHorizontal, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loading } from "@/components/loading";
import { PROFILE_QUERY_KEY, profileQueryOptions, useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configurar - FranqOS" }] }),
  component: OnboardingPage,
});

type Step = "segment" | "units" | "importing" | "done";

const SEGMENTS = [
  { id: "Sorveteria", label: "Sorveteria", icon: IceCream, color: "text-pink-500" },
  { id: "Açaiteria", label: "Açaiteria", icon: IceCream, color: "text-purple-500" },
  { id: "Cafeteria", label: "Cafeteria", icon: Coffee, color: "text-amber-700" },
  { id: "Lanchonete / Fast Food", label: "Lanchonete / Fast Food", icon: Sandwich, color: "text-orange-500" },
  { id: "Restaurante", label: "Restaurante", icon: UtensilsCrossed, color: "text-red-500" },
  { id: "Outro segmento", label: "Outro segmento", icon: MoreHorizontal, color: "text-slate-500" },
];

const UNIT_COUNT_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

interface UnitDraft {
  name: string;
  state: string; // sigla UF
  city: string;
}

interface IbgeState {
  id: number;
  sigla: string;
  nome: string;
}
interface IbgeCity {
  id: number;
  nome: string;
}

async function fetchStates(): Promise<IbgeState[]> {
  const r = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
  if (!r.ok) throw new Error("Falha ao carregar estados");
  return r.json();
}
async function fetchCities(uf: string): Promise<IbgeCity[]> {
  const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
  if (!r.ok) throw new Error("Falha ao carregar cidades");
  return r.json();
}

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, loading: profileLoading } = useProfile();
  const [step, setStep] = useState<Step>("segment");

  const [segment, setSegment] = useState<string>("Sorveteria");
  const [unitCount, setUnitCount] = useState<number>(1);
  const [units, setUnits] = useState<UnitDraft[]>([{ name: "", state: "", city: "" }]);
  const [importProgress, setImportProgress] = useState(0);

  useEffect(() => {
    if (profileLoading) return;
    if (!profile) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (profile.company_id) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [profile, profileLoading, navigate]);

  // ajusta o array de unidades quando muda a quantidade
  useEffect(() => {
    setUnits((prev) => {
      const next = [...prev];
      if (unitCount > next.length) {
        while (next.length < unitCount) next.push({ name: "", state: "", city: "" });
      } else if (unitCount < next.length) {
        next.length = unitCount;
      }
      return next;
    });
  }, [unitCount]);

  const updateUnit = (idx: number, patch: Partial<UnitDraft>) => {
    setUnits((prev) => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));
  };

  const canSubmit =
    units.length > 0 &&
    units.every((u) => u.name.trim() && u.state.trim() && u.city.trim());

  const runImport = async () => {
    if (!canSubmit) {
      toast.error("Preencha nome, estado e cidade de todas as unidades.");
      return;
    }
    setStep("importing");
    setImportProgress(20);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");

      const p_units = units.map((x) => ({
        name: x.name.trim(),
        state: x.state.trim(),
        city: x.city.trim(),
      }));
      const payload = {
        p_company_name: units[0].name || `${segment} de ${u.user.email}`,
        p_segment: segment,
        p_units,
      };
      console.log("[onboarding] rpc handle_onboarding payload →", payload);
      setImportProgress(50);

      const { data, error } = await supabase.rpc("handle_onboarding", payload as never);
      if (error) {
        console.error("[onboarding] handle_onboarding erro:", error);
        toast.error(`${error.message || "Erro ao configurar conta"}${error.details ? ` — ${error.details}` : ""}`);
        setStep("units");
        return;
      }
      console.log("[onboarding] handle_onboarding ok →", data);
      setImportProgress(100);

      await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY, refetchType: "active" });
      const freshProfile = await queryClient.fetchQuery(profileQueryOptions());

      if (!freshProfile?.company_id) {
        toast.error("Conta criada, mas o perfil ainda não foi vinculado à empresa. Tente novamente.");
        setStep("units");
        return;
      }

      navigate({ to: "/dashboard", replace: true });
    } catch (err: unknown) {
      const e = err as { message?: string; details?: string };
      console.error("[onboarding] ERRO FINAL:", e);
      toast.error(`${e.message || "Erro ao configurar conta"}${e.details ? ` — ${e.details}` : ""}`);
      setStep("units");
    }
  };

  if (profileLoading || !profile) return <Loading />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {step !== "importing" && step !== "done" && (
        <header className="px-4 pt-6 pb-2 flex items-center">
          <button
            onClick={() => {
              if (step === "units") setStep("segment");
              else navigate({ to: "/signup" });
            }}
            className="p-2 -ml-2 text-slate-700"
          >
            <ArrowLeft size={20} />
          </button>
        </header>
      )}

      <main className="flex-1 px-6 pb-8 max-w-sm w-full mx-auto flex flex-col">
        {step === "segment" && (
          <SegmentStep value={segment} onChange={setSegment} onContinue={() => setStep("units")} />
        )}
        {step === "units" && (
          <UnitsStep
            unitCount={unitCount}
            onUnitCount={setUnitCount}
            units={units}
            updateUnit={updateUnit}
            canSubmit={canSubmit}
            onContinue={runImport}
          />
        )}
        {step === "importing" && <ImportingStep segment={segment} progress={importProgress} />}
        {step === "done" && <DoneStep onContinue={() => navigate({ to: "/dashboard" })} />}
      </main>
    </div>
  );
}

/* ---------- step components ---------- */

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center mb-6">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-2">{subtitle}</p>
    </div>
  );
}

function ContinueBtn({ onClick, disabled, label = "Continuar" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-11 rounded-lg bg-[var(--franqos-blue)] hover:opacity-90 text-white font-semibold disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function SegmentStep({ value, onChange, onContinue }: { value: string; onChange: (v: string) => void; onContinue: () => void }) {
  return (
    <>
      <StepHeading title="Qual seu segmento?" subtitle="Isso nos ajuda a preparar sua conta com modelos prontos." />
      <div className="space-y-3 flex-1">
        {SEGMENTS.map((s) => {
          const active = value === s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className={`w-full flex items-center gap-3 px-4 h-14 rounded-xl border bg-white text-left transition ${
                active ? "border-[var(--franqos-blue)] ring-2 ring-[var(--franqos-blue)]/20" : "border-slate-200"
              }`}
            >
              <Icon size={20} className={s.color} />
              <span className="flex-1 text-sm font-medium text-slate-800">{s.label}</span>
              {active && <Check size={18} className="text-[var(--franqos-blue)]" />}
            </button>
          );
        })}
      </div>
      <div className="pt-6">
        <ContinueBtn onClick={onContinue} disabled={!value} />
        <div className="flex justify-center gap-1.5 mt-4">
          <Dot active /> <Dot /> <Dot /> <Dot />
        </div>
      </div>
    </>
  );
}

function UnitsStep({
  unitCount,
  onUnitCount,
  units,
  updateUnit,
  canSubmit,
  onContinue,
}: {
  unitCount: number;
  onUnitCount: (n: number) => void;
  units: UnitDraft[];
  updateUnit: (idx: number, patch: Partial<UnitDraft>) => void;
  canSubmit: boolean;
  onContinue: () => void;
}) {
  const statesQuery = useQuery({
    queryKey: ["ibge", "states"],
    queryFn: fetchStates,
    staleTime: 1000 * 60 * 60,
  });

  return (
    <>
      <StepHeading title="Vamos criar suas unidades" subtitle="Você poderá adicionar outras depois." />
      <div className="space-y-4 flex-1">
        <Field label="Quantas unidades você possui?">
          <select
            className={fieldCls + " bg-white"}
            value={unitCount}
            onChange={(e) => onUnitCount(Number(e.target.value))}
          >
            {UNIT_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 unidade" : `${n} unidades`}
              </option>
            ))}
          </select>
        </Field>

        {units.map((u, idx) => (
          <UnitBlock
            key={idx}
            index={idx}
            unit={u}
            states={statesQuery.data ?? []}
            statesLoading={statesQuery.isLoading}
            onChange={(patch) => updateUnit(idx, patch)}
          />
        ))}
      </div>

      <div className="pt-6">
        <ContinueBtn onClick={onContinue} disabled={!canSubmit} />
        <div className="flex justify-center gap-1.5 mt-4">
          <Dot /> <Dot active /> <Dot /> <Dot />
        </div>
      </div>
    </>
  );
}

function UnitBlock({
  index,
  unit,
  states,
  statesLoading,
  onChange,
}: {
  index: number;
  unit: UnitDraft;
  states: IbgeState[];
  statesLoading: boolean;
  onChange: (patch: Partial<UnitDraft>) => void;
}) {
  const citiesQuery = useQuery({
    queryKey: ["ibge", "cities", unit.state],
    queryFn: () => fetchCities(unit.state),
    enabled: !!unit.state,
    staleTime: 1000 * 60 * 60,
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Unidade {index + 1}
        </span>
        {index === 0 && <span className="text-[10px] text-slate-400">principal</span>}
      </div>
      <Field label="Nome da unidade">
        <input
          className={fieldCls}
          placeholder="Ex: Oggi Itabuna Centro"
          value={unit.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estado (UF)">
          <select
            className={fieldCls + " bg-white"}
            value={unit.state}
            onChange={(e) => onChange({ state: e.target.value, city: "" })}
            disabled={statesLoading}
          >
            <option value="">{statesLoading ? "Carregando…" : "Selecione"}</option>
            {states.map((s) => (
              <option key={s.id} value={s.sigla}>
                {s.sigla} — {s.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cidade">
          <select
            className={fieldCls + " bg-white"}
            value={unit.city}
            onChange={(e) => onChange({ city: e.target.value })}
            disabled={!unit.state || citiesQuery.isLoading}
          >
            <option value="">
              {!unit.state ? "Escolha o estado" : citiesQuery.isLoading ? "Carregando…" : "Selecione"}
            </option>
            {(citiesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

function ImportingStep({ segment, progress }: { segment: string; progress: number }) {
  const items = [
    { label: "Checklists padrão", done: progress >= 40 },
    { label: "POPs padrão", done: progress >= 60 },
    { label: "Categorias financeiras", done: progress >= 80 },
    { label: "Estrutura inicial", done: progress >= 100 },
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center pt-12">
      <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 relative">
        <FolderCheck size={44} className="text-[var(--franqos-blue)]" />
        <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
          <Check size={16} />
        </span>
      </div>
      <h2 className="text-xl font-bold text-slate-900">Preparando tudo para você!</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-xs">
        Estamos importando os modelos de checklists, POPs e categorias financeiras do segmento{" "}
        <span className="font-semibold text-slate-700">{segment}</span>.
      </p>

      <ul className="mt-8 space-y-3 text-left w-full max-w-xs">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-3 text-sm">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                i.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
              }`}
            >
              <Check size={12} />
            </span>
            <span className={i.done ? "text-slate-800" : "text-slate-400"}>{i.label}</span>
          </li>
        ))}
      </ul>

      <div className="w-full max-w-xs mt-8">
        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-[var(--franqos-blue)] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-right text-xs text-slate-500 mt-1">{progress}%</div>
      </div>
    </div>
  );
}

function DoneStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center pt-12">
      <div className="w-24 h-24 rounded-full border-4 border-emerald-500 flex items-center justify-center mb-6">
        <CheckCircle2 size={52} className="text-emerald-500" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Tudo pronto!</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-xs">
        Sua conta foi criada com sucesso.
        <br />
        Vamos para o seu painel.
      </p>
      <div className="w-full max-w-xs mt-10">
        <ContinueBtn onClick={onContinue} label="Acessar meu painel" />
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

const fieldCls =
  "w-full h-11 rounded-lg bg-white border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--franqos-blue)]/40 focus:border-[var(--franqos-blue)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function Dot({ active }: { active?: boolean }) {
  return <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-[var(--franqos-blue)] w-4" : "bg-slate-300"} transition-all`} />;
}
