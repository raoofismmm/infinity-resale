import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, EyeOff, Eye, Trash2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SmartImage } from "@/components/SmartImage";
import { BoostTimer, isBoosted } from "@/components/BoostTimer";
import { formatPrice } from "@/lib/images";
import type { ProductRow } from "@/components/ProductCard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — INFINITYRESALE" },
      { name: "description", content: "Manage users, listings, boosts and the welcome popup." },
      { property: "og:title", content: "Admin panel — INFINITYRESALE" },
      { property: "og:description", content: "Manage users, listings, boosts and the welcome popup." },
    ],
  }),
  component: AdminPage,
});

type Tab = "users" | "products" | "popup";

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) void navigate({ to: "/", replace: true });
  }, [loading, user, isAdmin, navigate]);

  if (!isAdmin) return <main className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">Checking access...</main>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Admin panel</h1>
      <div className="mt-5 flex gap-2">
        {(["users", "products", "popup"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={t === tab ? "chip bg-primary text-primary-foreground" : "chip bg-card ring-1 ring-border"}
          >
            {t === "users" ? "Users" : t === "products" ? "All listings" : "Popup window"}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "users" && <UsersTab />}
        {tab === "products" && <ProductsTab />}
        {tab === "popup" && <PopupTab />}
      </div>
    </main>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, phone, display_name, whatsapp, banned, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function setBanned(id: string, banned: boolean) {
    const { error } = await supabase.from("profiles").update({ banned }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(banned ? "User banned" : "User unbanned");
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{users.length} registered users</p>
      {users.map((u) => (
        <div key={u.id} className="card-surface flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1">
            <p className="font-semibold">{u.display_name || u.phone}</p>
            <p className="text-sm text-muted-foreground">
              Phone {u.phone} · WhatsApp {u.whatsapp} · joined {new Date(u.created_at).toLocaleDateString()}
            </p>
          </div>
          {u.banned && <span className="chip bg-destructive/15 text-destructive">Banned</span>}
          <button onClick={() => setBanned(u.id, !u.banned)} className={u.banned ? "btn-outline" : "btn-soft"}>
            <Ban className="size-4" /> {u.banned ? "Unban" : "Ban"}
          </button>
        </div>
      ))}
    </div>
  );
}

function ProductsTab() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  async function boost(p: ProductRow) {
    const base = isBoosted(p.boosted_until) ? new Date(p.boosted_until!).getTime() : Date.now();
    const until = new Date(base + 12 * 3600 * 1000).toISOString();
    const { error } = await supabase.from("products").update({ boosted_until: until }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Boosted for 12 hours");
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function toggleHidden(p: ProductRow) {
    await supabase.from("products").update({ is_hidden: !p.is_hidden }).eq("id", p.id);
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function remove(p: ProductRow) {
    await supabase.from("products").delete().eq("id", p.id);
    toast.success("Listing deleted");
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{items.length} listings</p>
      {items.map((p) => (
        <div key={p.id} className="card-surface flex flex-wrap items-center gap-4 p-4">
          <SmartImage path={p.images[0]} alt={p.title} className="size-16 rounded-xl object-cover" />
          <div className="min-w-40 flex-1">
            <Link to="/product/$id" params={{ id: p.id }} className="font-semibold hover:underline">
              {p.title}
            </Link>
            <p className="text-sm text-muted-foreground">{formatPrice(Number(p.price))}</p>
            {isBoosted(p.boosted_until) && <BoostTimer until={p.boosted_until!} className="mt-1" />}
          </div>
          <button onClick={() => boost(p)} className="btn-soft">
            <Zap className="size-4" /> Boost 12h
          </button>
          <button onClick={() => toggleHidden(p)} className="btn-outline">
            {p.is_hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            {p.is_hidden ? "Show" : "Hide"}
          </button>
          <button onClick={() => remove(p)} className="btn-ghost text-destructive" aria-label="Delete listing">
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function PopupTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    popup_enabled: true,
    popup_title: "",
    popup_body: "",
    popup_image_url: "",
    popup_link_url: "",
    boost_group_url: "",
  });
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  useEffect(() => {
    if (data) {
      setForm({
        popup_enabled: data.popup_enabled,
        popup_title: data.popup_title,
        popup_body: data.popup_body,
        popup_image_url: data.popup_image_url ?? "",
        popup_link_url: data.popup_link_url ?? "",
        boost_group_url: data.boost_group_url,
      });
    }
  }, [data]);

  async function uploadImage(file: File) {
    if (!user) return;
    setBusy(true);
    try {
      const path = `${user.id}/popup-${crypto.randomUUID()}.${file.name.split(".").pop() ?? "jpg"}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      setForm((f) => ({ ...f, popup_image_url: signed?.signedUrl ?? "" }));
      toast.success("Image uploaded — remember to save");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        popup_enabled: form.popup_enabled,
        popup_title: form.popup_title,
        popup_body: form.popup_body,
        popup_image_url: form.popup_image_url || null,
        popup_link_url: form.popup_link_url || null,
        boost_group_url: form.boost_group_url,
      })
      .eq("id", 1);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Popup updated");
    void qc.invalidateQueries({ queryKey: ["admin-settings"] });
  }

  return (
    <div className="card-surface space-y-4 p-6">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={form.popup_enabled}
          onChange={(e) => setForm({ ...form, popup_enabled: e.target.checked })}
          className="size-5 accent-[oklch(0.54_0.148_156)]"
        />
        <span className="font-semibold">Show the popup when the website opens</span>
      </label>
      <input
        className="field"
        placeholder="Popup title"
        value={form.popup_title}
        onChange={(e) => setForm({ ...form, popup_title: e.target.value })}
      />
      <textarea
        className="field min-h-28"
        placeholder="Popup message"
        value={form.popup_body}
        onChange={(e) => setForm({ ...form, popup_body: e.target.value })}
      />
      <div className="space-y-2">
        <p className="text-sm font-semibold">Popup image</p>
        {form.popup_image_url && (
          <img src={form.popup_image_url} alt="" className="max-h-48 rounded-xl border border-border object-cover" />
        )}
        <div className="flex flex-wrap gap-2">
          <label className="btn-outline cursor-pointer">
            Upload image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
            />
          </label>
          {form.popup_image_url && (
            <button onClick={() => setForm({ ...form, popup_image_url: "" })} className="btn-ghost text-destructive">
              Remove image
            </button>
          )}
        </div>
      </div>
      <input
        className="field"
        placeholder="Popup button link (optional)"
        value={form.popup_link_url}
        onChange={(e) => setForm({ ...form, popup_link_url: e.target.value })}
      />
      <input
        className="field"
        placeholder="Boost codes Telegram group link"
        value={form.boost_group_url}
        onChange={(e) => setForm({ ...form, boost_group_url: e.target.value })}
      />
      <button disabled={busy} onClick={save} className="btn-primary">
        {busy ? "Saving..." : "Save popup settings"}
      </button>
    </div>
  );
}
