-- ============================================================================
-- Clínica Escola UNINASSAU — Schema Inicial (PostgreSQL / Supabase)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clinics (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT,
    crmv TEXT,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'Parceiro Credenciado',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('tutor', 'clinic', 'admin')),
    clinic_id BIGINT REFERENCES public.clinics(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.animals (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT NOT NULL,
    blood TEXT,
    age TEXT NOT NULL,
    last_collection_date DATE,
    donated_amount TEXT,
    owner TEXT NOT NULL,
    owner_email TEXT,
    photo TEXT,
    notes TEXT,
    anamnesis_pdf TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Módulo: Coletas (Collections)
CREATE TABLE IF NOT EXISTS public.collections (
    id BIGSERIAL PRIMARY KEY,
    animal_id BIGINT REFERENCES public.animals(id) ON DELETE CASCADE,
    animal_name TEXT NOT NULL,
    owner_name TEXT,
    blood_type TEXT,
    collection_date DATE NOT NULL,
    volume_ml INTEGER NOT NULL CHECK (volume_ml > 0),
    responsible_vet TEXT NOT NULL,
    clinic_name TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Concluída' CHECK (status IN ('Agendada', 'Concluída', 'Cancelada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Módulo: Consultas (Appointments)
CREATE TABLE IF NOT EXISTS public.appointments (
    id BIGSERIAL PRIMARY KEY,
    animal_id BIGINT REFERENCES public.animals(id) ON DELETE SET NULL,
    animal TEXT NOT NULL,
    owner TEXT NOT NULL,
    owner_email TEXT,
    service TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Confirmado', 'Cancelado')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evita agendamentos duplicados ativos no mesmo horário exato
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_active_date
    ON public.appointments (date)
    WHERE status <> 'Cancelado';

CREATE TABLE IF NOT EXISTS public.clinic_contacts (
    id BIGSERIAL PRIMARY KEY,
    clinic_name TEXT NOT NULL,
    animal TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Requisição de Doador Enviada à Coordenação',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Função e triggers de updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_animals_updated_at ON public.animals;
CREATE TRIGGER trg_animals_updated_at
    BEFORE UPDATE ON public.animals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_collections_updated_at ON public.collections;
CREATE TRIGGER trg_collections_updated_at
    BEFORE UPDATE ON public.collections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para sincronizar a última coleta e volume total doado no cadastro do animal
CREATE OR REPLACE FUNCTION public.sync_animal_collection_summary()
RETURNS TRIGGER AS $$
DECLARE
    target_animal_id BIGINT;
    latest_date DATE;
    total_ml INTEGER;
BEGIN
    target_animal_id := COALESCE(NEW.animal_id, OLD.animal_id);
    IF target_animal_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT MAX(collection_date), COALESCE(SUM(volume_ml), 0)
    INTO latest_date, total_ml
    FROM public.collections
    WHERE animal_id = target_animal_id AND status = 'Concluída';

    UPDATE public.animals
    SET
        last_collection_date = latest_date,
        donated_amount = CASE WHEN total_ml > 0 THEN total_ml || ' ml' ELSE NULL END
    WHERE id = target_animal_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_animal_collection ON public.collections;
CREATE TRIGGER trg_sync_animal_collection
    AFTER INSERT OR UPDATE OR DELETE ON public.collections
    FOR EACH ROW EXECUTE FUNCTION public.sync_animal_collection_summary();
