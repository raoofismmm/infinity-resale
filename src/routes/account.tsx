import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, Trash2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SmartImage } from "@/components/SmartImage";
import { BoostTimer, isBoosted } from "@/components/BoostTimer";
import { formatPrice } from "@/lib/images";
import type { ProductRow } from "@/components/ProductCard";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My listings — INFINITYRESALE" },
      { name: "description", content: "Manage your items, mark them sold and apply boost codes." },
      { property: "og:title", content: "My listings — INFINITYRESALE" },
      { property: "og:description", content: "Manage your items and boost them to the top for 12 hours." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [boostFor, setBoostFor] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }, [loading, user, navigate]);

  const { data: items = [] } = useQuery({
    queryKey: ["my-products", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  async function applyBoost() {
    if (!boostFor || !code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_boost_code", {
      _code: code.trim().toUpperCase(),
      _product_id: boostFor,
    });
    setBusy(false);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast.error(result?.error ?? error?.message ?? "Could not apply code");
      return;
    }
    toast.success("Boosted for 12 hours!");
    setCode("");
    setBoostFor(null);
    void qc.invalidateQueries({ queryKey: ["my-products"] });
    void qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function toggleSold(p: ProductRow) {
    await supabase.from("products").update({ is_sold: !p.is_sold }).eq("id", p.id);
    void qc.invalidateQueries({ queryKey: ["my-products"] });
    void qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function remove(p: ProductRow) {
    await supabase.from("products").delete().eq("id", p.id);
    toast.success("Listing removed");
    void qc.invalidateQueries({ queryKey: ["my-products"] });
    void qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">My listings</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.display_name || profile?.phone} · WhatsApp {profile?.whatsapp}
          </p>
        </div>
        <Link to="/sell" className="btn-primary">
          New listing
        </Link>
      </div>

      {profile?.banned && (
        <div className="card-surface mt-5 border-destructive/40 bg-destructive/10 p-4 text-sm">
          Your account is banned. You cannot post new items.
        </div>
      )}

      <div className="mt-6 space-y-3">
        {items.length === 0 && (
          <div className="card-surface p-8 text-center text-sm text-muted-foreground">
            You have not listed anything yet.
          </div>
        )}
        {items.map((p) => (
          <div key={p.id} className="card-surface flex flex-wrap items-center gap-4 p-4">
            <SmartImage path={p.images[0]} alt={p.title} className="size-20 rounded-xl object-cover" />
            <div className="min-w-40 flex-1">
              <Link to="/product/$id" params={{ id: p.id }} className="font-semibold hover:underline">
                {p.title}
              </Link>
              <p className="text-sm text-muted-foreground">{formatPrice(Number(p.price))}</p>
              {isBoosted(p.boosted_until) && <BoostTimer until={p.boosted_until!} className="mt-1" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setBoostFor(boostFor === p.id ? null : p.id)} className="btn-soft">
                <Zap className="size-4" /> Boost
              </button>
              <button onClick={() => toggleSold(p)} className="btn-outline">
                {p.is_sold ? "Mark available" : "Mark sold"}
              </button>
              <button onClick={() => remove(p)} className="btn-ghost text-destructive" aria-label="Delete listing">
                <Trash2 className="size-4" />
              </button>
            </div>
            {boostFor === p.id && (
              <div className="w-full space-y-2 border-t border-border pt-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    className="field flex-1"
                    placeholder="Enter boost code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                  <button disabled={busy} onClick={applyBoost} className="btn-primary">
                    {busy ? "Checking..." : "Apply 12h boost"}
                  </button>
                </div>
                <a
                  href="https://t.me/+8RAh91JzVM8wMmY1"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  <Send className="size-3.5" /> Need boost codes? Join the Telegram group
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
