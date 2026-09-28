
-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  display_name TEXT,
  whatsapp TEXT NOT NULL,
  banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_banned(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT banned FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND banned = (SELECT p.banned FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Other',
  location TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  whatsapp TEXT NOT NULL,
  is_sold BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  boosted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_public_read" ON public.products FOR SELECT USING (is_hidden = false OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "products_owner_insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() AND NOT public.is_banned(auth.uid()));
CREATE POLICY "products_owner_update" ON public.products FOR UPDATE TO authenticated
  USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "products_owner_delete" ON public.products FOR DELETE TO authenticated USING (seller_id = auth.uid());
CREATE POLICY "products_admin_all" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX products_boost_idx ON public.products (boosted_until DESC NULLS LAST);
CREATE INDEX products_created_idx ON public.products (created_at DESC);

-- boost codes
CREATE TABLE public.boost_codes (
  code TEXT PRIMARY KEY,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.boost_codes TO authenticated;
GRANT ALL ON public.boost_codes TO service_role;
ALTER TABLE public.boost_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boost_codes_admin_read" ON public.boost_codes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- redeem function (security definer)
CREATE OR REPLACE FUNCTION public.redeem_boost_code(_code TEXT, _product_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _rows INT; _until TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not signed in'); END IF;
  IF public.is_banned(_uid) THEN RETURN jsonb_build_object('ok', false, 'error', 'Account banned'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id AND (seller_id = _uid OR public.has_role(_uid,'admin'))) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your product');
  END IF;

  UPDATE public.boost_codes SET used_by = _uid, used_at = now(), product_id = _product_id
  WHERE code = upper(trim(_code)) AND used_by IS NULL;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid or already used code'); END IF;

  UPDATE public.products
  SET boosted_until = GREATEST(COALESCE(boosted_until, now()), now()) + interval '12 hours', updated_at = now()
  WHERE id = _product_id
  RETURNING boosted_until INTO _until;

  RETURN jsonb_build_object('ok', true, 'boosted_until', _until);
END; $$;
GRANT EXECUTE ON FUNCTION public.redeem_boost_code(TEXT, UUID) TO authenticated;

-- site settings (popup)
CREATE TABLE public.site_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  popup_enabled BOOLEAN NOT NULL DEFAULT true,
  popup_title TEXT NOT NULL DEFAULT 'Welcome to INFINITYRESALE',
  popup_body TEXT NOT NULL DEFAULT 'Buy and sell anything. Chat with sellers directly on WhatsApp.',
  popup_image_url TEXT,
  popup_link_url TEXT,
  boost_group_url TEXT NOT NULL DEFAULT 'https://t.me/+8RAh91JzVM8wMmY1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
INSERT INTO public.site_settings (id) VALUES (1);

-- timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- profile auto-create on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, display_name, whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'display_name',
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', NEW.raw_user_meta_data->>'phone', split_part(NEW.email,'@',1))
  ) ON CONFLICT (id) DO NOTHING;

  IF COALESCE(NEW.raw_user_meta_data->>'phone', split_part(NEW.email,'@',1)) = '95395065611' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
