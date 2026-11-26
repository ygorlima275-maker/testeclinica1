-- ============================================================================
-- Testes de integridade do banco Supabase (Coletas, Consultas e Relações)
-- ============================================================================

BEGIN;

-- 1. Verifica se todas as tabelas esperadas existem
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('clinics', 'users', 'animals', 'collections', 'appointments', 'clinic_contacts')
ORDER BY table_name;

-- 2. Testa inserção de animal + coleta e verifica trigger de resumo no animal
INSERT INTO public.animals (name, species, breed, blood, age, owner)
VALUES ('Thor Teste', 'Canino', 'Labrador', 'DEA 1.1 Positivo', '4 anos · 28 kg', 'Tutor Teste');

INSERT INTO public.collections (animal_id, animal_name, owner_name, blood_type, collection_date, volume_ml, responsible_vet, status)
SELECT id, name, owner, blood, CURRENT_DATE, 450, 'Dra. Ana Vet', 'Concluída'
FROM public.animals
WHERE name = 'Thor Teste'
LIMIT 1;

-- Deve mostrar last_collection_date = CURRENT_DATE e donated_amount = '450 ml'
SELECT name, last_collection_date, donated_amount
FROM public.animals
WHERE name = 'Thor Teste';

-- 3. Testa inserção de consulta
INSERT INTO public.appointments (animal, owner, service, date, status)
VALUES ('Thor Teste', 'Tutor Teste', 'Triagem Hemoterápica', '2026-12-01T10:00', 'Pendente');

SELECT animal, owner, service, date, status
FROM public.appointments
WHERE animal = 'Thor Teste';

ROLLBACK;
