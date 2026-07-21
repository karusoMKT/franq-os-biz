import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["manager", "employee"]),
  unit_id: z.string().uuid(),
});

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load caller profile via RLS
    const { data: caller, error: callerErr } = await supabase
      .from("profiles")
      .select("role, company_id, unit_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (callerErr) throw new Error(callerErr.message);
    if (!caller || !caller.company_id) throw new Error("Perfil sem empresa.");
    if (caller.role !== "owner" && caller.role !== "manager") {
      throw new Error("Sem permissão para criar membros.");
    }
    if (caller.role === "manager" && data.unit_id !== caller.unit_id) {
      throw new Error("Gerente só pode criar membros da própria unidade.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário.");
    }

    const newUserId = created.user.id;

    // Upsert profile (trigger may have already created a base row)
    const { error: upsertErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: newUserId,
          name: data.name,
          email: data.email,
          role: data.role,
          company_id: caller.company_id,
          unit_id: data.unit_id,
        },
        { onConflict: "user_id" },
      );

    if (upsertErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(upsertErr.message);
    }

    return { ok: true, user_id: newUserId };
  });
