import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hashPin(userId: string, pin: string) {
  const data = new TextEncoder().encode(`infinityresale:${userId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be 4 digits");

export const setRecoveryPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pin: pinSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("recovery_pins").upsert({
      user_id: context.userId,
      pin_hash: await hashPin(context.userId, data.pin),
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save PIN");
    return { ok: true };
  });

export const resetPasswordWithPin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().regex(/^\d{8,15}$/, "Invalid phone number"),
        pin: pinSchema,
        password: z.string().min(6).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fail = { ok: false as const, error: "Phone number or PIN is incorrect" };
    const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("phone", data.phone).maybeSingle();
    if (!prof) return fail;
    const { data: rec } = await supabaseAdmin.from("recovery_pins").select("*").eq("user_id", prof.id).maybeSingle();
    if (!rec) return { ok: false as const, error: "No recovery PIN set for this account" };
    if (rec.locked_until && new Date(rec.locked_until).getTime() > Date.now()) {
      return { ok: false as const, error: "Too many attempts. Try again in 15 minutes." };
    }
    if ((await hashPin(prof.id, data.pin)) !== rec.pin_hash) {
      const attempts = rec.failed_attempts + 1;
      await supabaseAdmin
        .from("recovery_pins")
        .update({
          failed_attempts: attempts >= 5 ? 0 : attempts,
          locked_until: attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
        })
        .eq("user_id", prof.id);
      return fail;
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(prof.id, { password: data.password });
    if (error) return { ok: false as const, error: "Could not reset password" };
    await supabaseAdmin.from("recovery_pins").update({ failed_attempts: 0, locked_until: null }).eq("user_id", prof.id);
    return { ok: true as const };
  });
