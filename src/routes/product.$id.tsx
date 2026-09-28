import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "@/components/SmartImage";
import { BoostTimer, isBoosted } from "@/components/BoostTimer";
import { formatPrice } from "@/lib/images";
import type { ProductRow } from "@/components/ProductCard";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "Item details — INFINITYRESALE" },
      { name: "description", content: "See photos, price and description, then message the seller on WhatsApp." },
      { property: "og:title", content: "Item details — INFINITYRESALE" },
      { property: "og:description", content: "See photos and price, then order directly through WhatsApp." },
    ],
  }),
  component: ProductPage,
  errorComponent: () => <Missing />,
  notFoundComponent: () => <Missing />,
});

function Missing() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Item not available</h1>
      <Link to="/" className="btn-primary mt-4">
        Back to listings
      </Link>
    </main>
  );
}

function ProductPage() {
  const { id } = Route.useParams();
  const [active, setActive] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as ProductRow | null;
    },
  });

  const { data: seller } = useQuery({
    queryKey: ["seller", product?.seller_id],
    enabled: Boolean(product?.seller_id),
    queryFn: async () =>
      (await supabase.from("profiles").select("display_name, phone").eq("id", product!.seller_id).maybeSingle()).data,
  });

  if (isLoading) return <main className="mx-auto max-w-5xl px-4 py-16">Loading...</main>;
  if (!product) return <Missing />;

  const waText = encodeURIComponent(
    `Hi! I want to order "${product.title}" (${formatPrice(Number(product.price))}) listed on INFINITYRESALE.`,
  );
  const waLink = `https://wa.me/${product.whatsapp}?text=${waText}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="card-surface relative aspect-4/3 overflow-hidden">
            <SmartImage path={product.images[active]} alt={product.title} className="size-full object-cover" />
            {isBoosted(product.boosted_until) && (
              <div className="absolute left-3 top-3">
                <BoostTimer until={product.boosted_until!} />
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setActive(i)}
                  className={`size-20 shrink-0 overflow-hidden rounded-xl border-2 ${i === active ? "border-primary" : "border-transparent"}`}
                >
                  <SmartImage path={p} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <span className="chip bg-secondary text-secondary-foreground">{product.category}</span>
            <h1 className="mt-3 text-3xl font-extrabold">{product.title}</h1>
            <p className="mt-1 font-display text-3xl font-bold text-primary">{formatPrice(Number(product.price))}</p>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          <div className="card-surface space-y-3 p-5">
            <p className="text-sm">
              Seller: <span className="font-semibold">{seller?.display_name || "INFINITYRESALE user"}</span>
              {product.location ? ` · ${product.location}` : ""}
            </p>
            {product.is_sold ? (
              <p className="text-sm font-semibold text-muted-foreground">This item is marked sold.</p>
            ) : (
              <a href={waLink} target="_blank" rel="noreferrer" className="btn-primary w-full">
                <MessageCircle className="size-4" /> Order on WhatsApp
              </a>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Deals happen directly between buyer and seller.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
