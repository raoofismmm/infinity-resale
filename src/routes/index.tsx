import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Send, Sparkles, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductRow } from "@/components/ProductCard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "INFINITYRESALE — Buy & sell anything, deal on WhatsApp" },
      {
        name: "description",
        content:
          "Browse boosted and fresh listings on INFINITYRESALE. Post your own items with photos and a price, and buyers message you on WhatsApp.",
      },
      { property: "og:title", content: "INFINITYRESALE — Buy & sell anything" },
      {
        property: "og:description",
        content: "Boosted listings, fresh finds, and direct WhatsApp deals. No chat, no payments, no fuss.",
      },
    ],
  }),
  component: Home,
});

const CATEGORIES = ["All", "Electronics", "Fashion", "Home", "Vehicles", "Mobiles", "Books", "Other"];

function Home() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("site_settings").select("boost_group_url").eq("id", 1).maybeSingle()).data,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
    refetchInterval: 60_000,
  });

  const now = Date.now();
  const filtered = products.filter(
    (p) =>
      (cat === "All" || p.category === cat) &&
      (q.trim() === "" || `${p.title} ${p.description}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const boosted = filtered
    .filter((p) => p.boosted_until && new Date(p.boosted_until).getTime() > now)
    .sort((a, b) => new Date(b.boosted_until!).getTime() - new Date(a.boosted_until!).getTime());
  const rest = filtered.filter((p) => !boosted.includes(p));
  const telegram = settings?.boost_group_url ?? "https://t.me/+8RAh91JzVM8wMmY1";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <section className="grid gap-6 py-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div className="space-y-5">
          <span className="chip bg-secondary text-secondary-foreground">
            <Sparkles className="size-3.5" /> Resale, simplified
          </span>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            Sell anything. Buyers reach you on <span className="text-primary">WhatsApp</span>.
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Upload photos, set your price, and get orders straight to your phone. No in-app chat, no payments —
            just real deals.
          </p>
          <div className="flex flex-wrap gap-2">
            {user ? (
              <Link to="/sell" className="btn-primary">
                Post your item
              </Link>
            ) : (
              <Link to="/auth" search={{ mode: "register" }} className="btn-primary">
                Post your item
              </Link>
            )}
            <a href="#browse" className="btn-outline">
              Browse listings
            </a>
          </div>
        </div>

        <aside className="card-surface space-y-3 border-accent/50 bg-blush p-6">
          <span className="chip bg-card text-foreground">
            <Zap className="size-3.5 text-boost" /> Side quest
          </span>
          <h2 className="text-xl font-bold">Need boost codes?</h2>
          <p className="text-sm text-muted-foreground">
            One code pushes your item to the top of the homepage for 12 hours. Grab codes from our Telegram group.
          </p>
          <a href={telegram} target="_blank" rel="noreferrer" className="btn-primary w-full">
            <Send className="size-4" /> Get boost codes
          </a>
        </aside>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-boost" />
          <h2 className="text-2xl font-bold">Boosted products</h2>
        </div>
        {boosted.length === 0 ? (
          <div className="card-surface p-8 text-center text-sm text-muted-foreground">
            No boosted items right now. Use a boost code on your listing to appear here.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boosted.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section id="browse" className="space-y-4 pt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">All listings</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items..."
              className="field pl-9"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={c === cat ? "chip bg-primary text-primary-foreground" : "chip bg-card text-muted-foreground ring-1 ring-border"}
            >
              {c}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-surface h-72 animate-pulse" />
            ))}
          </div>
        ) : rest.length === 0 ? (
          <div className="card-surface p-8 text-center text-sm text-muted-foreground">Nothing listed here yet.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
