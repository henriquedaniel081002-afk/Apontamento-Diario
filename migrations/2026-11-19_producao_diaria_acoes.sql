BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.producao_diaria_observacoes
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;
ALTER TABLE public.producao_diaria_observacoes
  DROP CONSTRAINT IF EXISTS producao_diaria_observacoes_linha_check,
  ADD CONSTRAINT producao_diaria_observacoes_linha_check CHECK (linha IN ('GERAL', 'MON', 'TRI', 'EPO'));

CREATE TABLE IF NOT EXISTS public.producao_diaria_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_origem date NOT NULL,
  setor text NOT NULL CHECK (char_length(setor) BETWEEN 1 AND 100),
  linha text NOT NULL CHECK (linha IN ('GERAL', 'MON', 'TRI', 'EPO')),
  plano_acao text NOT NULL CHECK (char_length(btrim(plano_acao)) BETWEEN 1 AND 3000),
  responsavel text NOT NULL CHECK (char_length(btrim(responsavel)) BETWEEN 1 AND 200),
  prazo date NOT NULL,
  situacao text NOT NULL DEFAULT 'PENDENTE' CHECK (situacao IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  criado_por_id integer NOT NULL REFERENCES public.usuarios(id),
  criado_por_login text NOT NULL,
  atualizado_por_id integer NOT NULL REFERENCES public.usuarios(id),
  atualizado_por_login text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  CHECK ((situacao = 'CONCLUIDA') = (concluido_em IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.producao_diaria_acoes_historico (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acao_id uuid NOT NULL REFERENCES public.producao_diaria_acoes(id),
  tipo text NOT NULL CHECK (tipo IN ('CRIACAO', 'ALTERACAO')),
  autor_id integer NOT NULL REFERENCES public.usuarios(id),
  autor_login text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  antes jsonb,
  depois jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.producao_diaria_observacoes_historico (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data date NOT NULL,
  setor text NOT NULL,
  linha text NOT NULL,
  autor_id integer NOT NULL REFERENCES public.usuarios(id),
  autor_login text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  antes jsonb,
  depois jsonb NOT NULL,
  FOREIGN KEY (data, setor, linha) REFERENCES public.producao_diaria_observacoes (data, setor, linha)
);

CREATE INDEX IF NOT EXISTS producao_diaria_acoes_abertas_idx
  ON public.producao_diaria_acoes (prazo, data_origem, id)
  WHERE situacao IN ('PENDENTE', 'EM_ANDAMENTO');
CREATE INDEX IF NOT EXISTS producao_diaria_acoes_prazo_idx
  ON public.producao_diaria_acoes (prazo, data_origem, id);
CREATE INDEX IF NOT EXISTS producao_diaria_acoes_situacao_idx
  ON public.producao_diaria_acoes (situacao, prazo, data_origem, id);
CREATE INDEX IF NOT EXISTS producao_diaria_acoes_escopo_idx
  ON public.producao_diaria_acoes (setor, linha, data_origem);
CREATE INDEX IF NOT EXISTS producao_diaria_acoes_historico_acao_idx
  ON public.producao_diaria_acoes_historico (acao_id, id DESC);
CREATE INDEX IF NOT EXISTS producao_diaria_observacoes_historico_escopo_idx
  ON public.producao_diaria_observacoes_historico (data, setor, linha, id DESC);

CREATE OR REPLACE FUNCTION public.producao_diaria_proteger_historico()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'O histórico da Produção Diária só permite inclusão.' USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE TRIGGER producao_diaria_acoes_historico_imutavel
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.producao_diaria_acoes_historico
FOR EACH STATEMENT EXECUTE FUNCTION public.producao_diaria_proteger_historico();

CREATE OR REPLACE TRIGGER producao_diaria_observacoes_historico_imutavel
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.producao_diaria_observacoes_historico
FOR EACH STATEMENT EXECUTE FUNCTION public.producao_diaria_proteger_historico();

CREATE OR REPLACE FUNCTION public.producao_diaria_versionar_observacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  NEW.versao := OLD.versao + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER producao_diaria_observacoes_versao
BEFORE UPDATE ON public.producao_diaria_observacoes
FOR EACH ROW EXECUTE FUNCTION public.producao_diaria_versionar_observacao();

CREATE OR REPLACE FUNCTION public.producao_diaria_auditar_observacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  INSERT INTO public.producao_diaria_observacoes_historico
    (data, setor, linha, autor_id, autor_login, antes, depois)
  VALUES
    (NEW.data, NEW.setor, NEW.linha, NEW.atualizado_por_id, NEW.atualizado_por_login,
     CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER producao_diaria_observacoes_auditoria
AFTER INSERT OR UPDATE ON public.producao_diaria_observacoes
FOR EACH ROW EXECUTE FUNCTION public.producao_diaria_auditar_observacao();

CREATE OR REPLACE FUNCTION public.producao_diaria_auditar_acao()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     (OLD.id, OLD.data_origem, OLD.criado_em, OLD.criado_por_id, OLD.criado_por_login)
     IS DISTINCT FROM (NEW.id, NEW.data_origem, NEW.criado_em, NEW.criado_por_id, NEW.criado_por_login) THEN
    RAISE EXCEPTION 'A origem e a autoria da ação são imutáveis.' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.producao_diaria_acoes_historico
    (acao_id, tipo, autor_id, autor_login, antes, depois)
  VALUES
    (NEW.id, CASE WHEN TG_OP = 'INSERT' THEN 'CRIACAO' ELSE 'ALTERACAO' END,
     NEW.atualizado_por_id, NEW.atualizado_por_login,
     CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER producao_diaria_acoes_auditoria
AFTER INSERT OR UPDATE ON public.producao_diaria_acoes
FOR EACH ROW EXECUTE FUNCTION public.producao_diaria_auditar_acao();

COMMIT;
