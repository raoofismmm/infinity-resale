import { Link, useNavigate } from "@tanstack/react-router";
import { Infinity as InfinityIcon, LogOut, Plus, Shield, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, isAdmin, profile } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <InfinityIcon className="size-5" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">
            INFINITY<span className="text-primary">RESALE</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          {user ? (
            <>
              <Link to="/sell" className="btn-primary px-3 sm:px-5">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Sell</span>
              </Link>
              <Link to="/account" className="btn-ghost px-3">
                <User className="size-4" />
                <span className="hidden sm:inline">{profile?.display_name || "My items"}</span>
              </Link>
              {isAdmin && (
                <Link to="/admin" className="btn-soft px-3">
                  <Shield className="size-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}
              <button onClick={signOut} className="btn-ghost px-3" aria-label="Sign out">
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "login" }} className="btn-ghost">
                Log in
              </Link>
              <Link to="/auth" search={{ mode: "register" }} className="btn-primary">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
