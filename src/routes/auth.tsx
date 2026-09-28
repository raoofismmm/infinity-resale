import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Infinity as InfinityIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, phoneToEmail, useAuth } from "@/lib/auth";

type Search = { mode?: "login" | "register" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: search['mode'] === "register" ? "register" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Log in or register — INFINITYRESALE" },
      { name: "description", content: "Sign in to INFINITYRESALE with your phone number to list items for sale." },
      { property: "og:title", content: "Log in or register — INFINITYRESALE" },
      { property: "og:description", content: "Phone number sign-in for buyers and sellers on INFINITYRESALE." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isRegister = mode === "register";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/", replace: true });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = normalizePhone(phone);
    if (digits.length < 8) return toast.error("Enter a valid phone number");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email: phoneToEmail(digits),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              phone: digits,
              display_name: name || digits,
              whatsapp: normalizePhone(whatsapp) || digits,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: phoneToEmail(digits),
          password,
        });
        if (error) throw error;
        toast.success("Welcome back");
      }
      void navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[80vh] max-w-md place-items-center px-4 py-10">
      <div className="card-surface w-full space-y-5 p-7">
        <div className="space-y-1 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <InfinityIcon className="size-6" />
          </span>
          <h1 className="pt-2 text-2xl font-bold">{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="text-sm text-muted-foreground">Phone number and password — that's all.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="field"
            placeholder="Phone number"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {isRegister && (
            <>
              <input
                className="field"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="field"
                placeholder="WhatsApp number (leave empty to use the same)"
                inputMode="numeric"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </>
          )}
          <input
            className="field"
            type="password"
            placeholder="Password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button disabled={busy} className="btn-primary w-full">
            {busy ? "Please wait..." : isRegister ? "Register" : "Log in"}
          </button>
        </form>

        <button
          className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => navigate({ to: "/auth", search: { mode: isRegister ? "login" : "register" } })}
        >
          {isRegister ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </div>
    </main>
  );
}
