import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  phone: string;
  display_name: string | null;
  whatsapp: string;
  banned: boolean;
};

type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refresh: async () => {},
});

export const ADMIN_PHONE = "95395065611";

/** Phone numbers are turned into a stable internal address for sign-in. */
export function phoneToEmail(phone: string) {
  return `${normalizePhone(phone)}@infinityresale.app`;
}

export function normalizePhone(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(uid: string | undefined) {
    if (!uid) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, phone, display_name, whatsapp, banned").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p as Profile) ?? null);
    setIsAdmin(Boolean(roles?.some((r) => r.role === "admin")));
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void load(s?.user?.id);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void load(data.session?.user?.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin,
        loading,
        refresh: () => load(session?.user?.id),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
