GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO anon;
GRANT SELECT ON public.products, public.profiles, public.site_settings TO anon;