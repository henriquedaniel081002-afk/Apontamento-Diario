BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.producao_diaria_acoes
  ADD COLUMN IF NOT EXISTS excluida_em timestamptz;

COMMIT;
