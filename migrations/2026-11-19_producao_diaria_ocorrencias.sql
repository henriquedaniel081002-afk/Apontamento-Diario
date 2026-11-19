BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.producao_diaria_acoes
  ADD COLUMN IF NOT EXISTS observacao text
  CONSTRAINT producao_diaria_acoes_observacao_valida
  CHECK (observacao IS NULL OR char_length(btrim(observacao)) BETWEEN 1 AND 3000);

COMMIT;
