import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, FolderCheck, IceCream, Coffee, UtensilsCrossed, Hamburger, Soup, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  { id: "Lanchonete / Fast Food", label: "Lanchonete / Fast Food", icon: Hamburger, color: "text-orange-500" },
  { id: "Restaurante", label: "Restaurante", icon: UtensilsCrossed, color: "text-red-500" },
  { id: "Outro segmento", label: "Outro segmento", icon: MoreHorizontal, color: "text-slate-500" },
];

const UNIT_COUNTS = ["1 unidade", "2 a 3 unidades", "4 a 5 unidades", "Mais de 5 unidades"];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("segment");
  const [checking, setChecking] = useState(true);

  // form state
  const [segment, setSegment] = useState<string>("Sorveteria");
  const [unitName, setUnitName] = useState("");
  const [city, setCity] = useState("");
  const [unitCount, setUnitCount] = useState(UNIT_COUNTS[0]);

  // import progress
  const [importProgress, setImportProgress] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (profile?.company_id) {
        navigate({ to: "/dashboard" });
        return;
      }
      setChecking(false);
    })();
  }, [navigate]);

  const runImport = async () => {
    setStep("importing");
    setImportProgress(10);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");

      // 1. Company (trigger seeds defaults)
      const { data: company, error: cErr } = await supabase
        .from("companies")
        .insert({ name: unitName || `${segment} de ${u.user.email}`, segment })
        .select()
        .single();
      if (cErr) throw cErr;
      setImportProgress(40);

      // 2. Profile as owner
      const { error: pErr } = await supabase.from("profiles").insert({
        user_id: u.user.id,
        company_id: company.id,
        name: (u.user.user_metadata?.name as string) ?? u.user.email,
        email: u.user.email,
        role: "owner",
      });
      if (pErr) throw pErr;
      setImportProgress(70);

      // 3. First unit
      const { error: uErr } = await supabase.from("units").insert({
        company_id: company.id,
        name: unitName,
        city,
      });
      if (uErr) throw uErr;
      setImportProgress(100);

      setTimeout(() => setStep("done"), 600);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao configurar conta");
      setStep("units");
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Carregando...
      </div>
    );
  }

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
          <SegmentStep
            value={segment}
            onChange={setSegment}
            onContinue={() => setStep("units")}
          />
        )}
        {step === "units" && (
          <UnitsStep
            unitName={unitName}
            city={city}
            unitCount={unitCount}
            onUnitName={setUnitName}
            onCity={setCity}
            onUnitCount={setUnitCount}
            onContinue={runImport}
          />
        )}
        {step === "importing" && (
          <ImportingStep segment={segment} progress={importProgress} />
        )}
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
      <StepHeading
        title="Qual seu segmento?"
        subtitle="Isso nos ajuda a preparar sua conta com modelos prontos."
      />
      <div className="space-y-3 flex-1">
        {SEGMENTS.map((s) => {
          const active = value === s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className={`w-full flex items-center gap-3 px-4 h-14 rounded-xl border bg-white text-left transition ${
                active
                  ? "border-[var(--franqos-blue)] ring-2 ring-[var(--franqos-blue)]/20"
                  : "border-slate-200"
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
  unitName,
  city,
  unitCount,
  onUnitName,
  onCity,
  onUnitCount,
  onContinue,
}: {
  unitName: string;
  city: string;
  unitCount: string;
  onUnitName: (v: string) => void;
  onCity: (v: string) => void;
  onUnitCount: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <StepHeading
        title="Vamos criar sua unidade"
        subtitle="Você poderá adicionar outras depois."
      />
      <div className="space-y-4 flex-1">
        <Field label="Nome da unidade">
          <input
            className={fieldCls}
            placeholder="Ex: Oggi Itabuna Centro"
            value={unitName}
            onChange={(e) => onUnitName(e.target.value)}
          />
        </Field>
        <Field label="Cidade">
          <input
            className={fieldCls}
            placeholder="Ex: Itabuna - BA"
            value={city}
            onChange={(e) => onCity(e.target.value)}
          />
        </Field>
        <Field label="Quantas unidades você possui?">
          <select
            className={fieldCls + " bg-white"}
            value={unitCount}
            onChange={(e) => onUnitCount(e.target.value)}
          >
            {UNIT_COUNTS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="pt-6">
        <ContinueBtn onClick={onContinue} disabled={!unitName} />
        <div className="flex justify-center gap-1.5 mt-4">
          <Dot /> <Dot active /> <Dot /> <Dot />
        </div>
      </div>
    </>
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
          <div
            className="h-full bg-[var(--franqos-blue)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
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
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full ${active ? "bg-[var(--franqos-blue)] w-4" : "bg-slate-300"} transition-all`}
    />
  );
}
