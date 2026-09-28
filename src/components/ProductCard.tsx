import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { SmartImage } from "./SmartImage";
import { BoostTimer, isBoosted } from "./BoostTimer";
import { formatPrice } from "@/lib/images";

export type ProductRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  location: string | null;
  images: string[];
  whatsapp: string;
  is_sold: boolean;
  is_hidden: boolean;
  boosted_until: string | null;
  created_at: string;
  seller_id: string;
};

export function ProductCard({ product }: { product: ProductRow }) {
  const boosted = isBoosted(product.boosted_until);
  return (
    <Link
      to="/product/$id"
      params={{ id: product.id }}
      className="card-surface group block overflow-hidden transition-transform hover:-translate-y-1"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-muted">
        <SmartImage
          path={product.images[0]}
          alt={product.title}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {boosted && (
          <div className="absolute left-3 top-3">
            <BoostTimer until={product.boosted_until!} />
          </div>
        )}
        {product.is_sold && (
          <div className="absolute inset-0 grid place-items-center bg-foreground/55">
            <span className="chip bg-card text-foreground">Sold</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 text-base font-semibold">{product.title}</h3>
          <span className="shrink-0 font-display text-base font-bold text-primary">
            {formatPrice(Number(product.price))}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span className="chip bg-secondary text-secondary-foreground">{product.category}</span>
          {product.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {product.location}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
