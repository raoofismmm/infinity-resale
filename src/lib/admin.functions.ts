import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Fully deletes a user so the phone number can register again. Banned users are kept (ban stays). */
export const removeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { ok: false as const, error: "Not allowed" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = data.userId;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", id);
    if (roles?.some((r) => r.role === "admin")) return { ok: false as const, error: "Admins cannot be removed" };
    const { data: prof } = await supabaseAdmin.from("profiles").select("banned").eq("id", id).maybeSingle();
    if (prof?.banned) return { ok: false as const, error: "Banned users stay blocked. Unban first to remove." };

    const { data: prods } = await supabaseAdmin.from("products").select("id").eq("seller_id", id);
    const ids = (prods ?? []).map((p) => p.id);
    if (ids.length) await supabaseAdmin.from("boost_codes").update({ product_id: null }).in("product_id", ids);
    await supabaseAdmin.from("boost_codes").update({ used_by: null }).eq("used_by", id);
    await supabaseAdmin.from("products").delete().eq("seller_id", id);
    await supabaseAdmin.from("recovery_pins").delete().eq("user_id", id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    await supabaseAdmin.from("profiles").delete().eq("id", id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return { ok: false as const, error: "Could not remove user" };
    return { ok: true as const };
  });
