import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadProductImage } from "@/lib/images";
import { normalizePhone, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "List an item — INFINITYRESALE" },
      { name: "description", content: "Upload photos of your item, add a description and price, and start selling." },
      { property: "og:title", content: "List an item — INFINITYRESALE" },
      { property: "og:description", content: "Upload photos, set a price, and get WhatsApp orders." },
    ],
  }),
  component: SellPage,
});

const CATEGORIES = ["Electronics", "Fashion", "Home", "Vehicles", "Mobiles", "Books", "Other"];

function SellPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [location, setLocation] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile?.whatsapp && !whatsapp) setWhatsapp(profile.whatsapp);
  }, [profile, whatsapp]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 8));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (profile?.banned) return toast.error("Your account is banned.");
    if (!title.trim()) return toast.error("Add a title");
    if (files.length === 0) return toast.error("Upload at least one photo");
    const wa = normalizePhone(whatsapp);
    if (wa.length < 8) return toast.error("Add a valid WhatsApp number");

    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadProductImage(user.id, f));
      const { data, error } = await supabase
        .from("products")
        .insert({
          seller_id: user.id,
          title: title.trim(),
          description: description.trim(),
          price: Number(price) || 0,
          category,
          location: location.trim() || null,
          images: paths,
          whatsapp: wa,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Your item is live");
      void navigate({ to: "/product/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">List an item</h1>
      <p className="mt-1 text-sm text-muted-foreground">Photos are uploaded from your device — no links needed.</p>

      <form onSubmit={submit} className="card-surface mt-6 space-y-4 p-6">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-border">
              <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-card/90"
                aria-label="Remove photo"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary">
            <ImagePlus className="size-6" />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
        </div>

        <input className="field" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="field min-h-32"
          placeholder="Description — condition, age, what's included..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="field"
            placeholder="Price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            className="field"
            placeholder="Location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <input
            className="field"
            placeholder="WhatsApp number for orders"
            inputMode="numeric"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>

        <button disabled={busy} className="btn-primary w-full">
          {busy ? "Publishing..." : "Publish listing"}
        </button>
      </form>
    </main>
  );
}
