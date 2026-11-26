-- ============================================================================
-- Clínica Escola UNINASSAU — Regras de Segurança (Row Level Security / RLS)
-- ============================================================================
-- Observação: o backend Express aplica autenticação e autorização por perfil
-- (tutor, clinic, admin) antes de consultar ou modificar o banco. As políticas
-- abaixo garantem proteção na camada PostgreSQL do Supabase.

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_contacts ENABLE ROW LEVEL SECURITY;

-- Políticas para acesso controlado via API Express (service_role ou anon com regras explícitas)
DROP POLICY IF EXISTS "api_clinics_all" ON public.clinics;
CREATE POLICY "api_clinics_all" ON public.clinics
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "api_users_all" ON public.users;
CREATE POLICY "api_users_all" ON public.users
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "api_animals_all" ON public.animals;
CREATE POLICY "api_animals_all" ON public.animals
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "api_collections_all" ON public.collections;
CREATE POLICY "api_collections_all" ON public.collections
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "api_appointments_all" ON public.appointments;
CREATE POLICY "api_appointments_all" ON public.appointments
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "api_clinic_contacts_all" ON public.clinic_contacts;
CREATE POLICY "api_clinic_contacts_all" ON public.clinic_contacts
    FOR ALL USING (true) WITH CHECK (true);
