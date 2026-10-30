-- Aplicar apenas no banco de atrasos, após backup. Não altera os dados existentes.
BEGIN;
ALTER TABLE public.atrasos_importacoes DROP CONSTRAINT IF EXISTS atrasos_importacoes_esperado_check;
ALTER TABLE public.atrasos_importacoes ADD CONSTRAINT atrasos_importacoes_esperado_check CHECK (esperado > 0);
COMMIT;
