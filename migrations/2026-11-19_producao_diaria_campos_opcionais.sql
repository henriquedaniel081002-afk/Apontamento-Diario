BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.producao_diaria_acoes
  ALTER COLUMN plano_acao DROP NOT NULL,
  ALTER COLUMN responsavel DROP NOT NULL,
  ALTER COLUMN prazo DROP NOT NULL;

COMMIT;
