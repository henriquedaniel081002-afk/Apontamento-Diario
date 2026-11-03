import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { Pool } from 'pg';

type Tipo = 'PROGRAMACAO' | 'APONTAMENTO';
const TIPOS = new Set(['PROGRAMACAO', 'APONTAMENTO']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const SECTORS_ALIASES: Record<string,string> = {
  'CORTE LASER':'CORTE DO LASER',
  'MONTAGEM NUCLEO':'MONTAGEM DO NUCLEO',
  'BOBINA AT/BT':'BOBINA AT/BT',
};
function normal(text: unknown) {
  return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
}
function sector(value: unknown) {
  const s = normal(value);
  return SECTORS_ALIASES[s] || s;
}
function dateOnly(value: any): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !YMD.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function period() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const day = Number(parts.find(p => p.type === 'day')?.value);
  const start = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const today = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  return { start, end, today };
}
function selectedPeriod(input: any) {
  const defaults=period();
  const start=String(input?.inicio||defaults.start);
  const last=String(input?.fim||new Date(Date.parse(defaults.end)-86400000).toISOString().slice(0,10));
  if(!validDate(start)||!validDate(last)||start>last||last==='9999-12-31') throw new RangeError('Período inválido.');
  return {start,end:new Date(Date.parse(last)+86400000).toISOString().slice(0,10),today:defaults.today};
}
function requireType(input: unknown): Tipo {
  if (!TIPOS.has(String(input))) throw new Error('Tipo de importação inválido.');
  return input as Tipo;
}
function validateLines(input: any[], tipo: Tipo) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 1000) throw new Error('Envie entre 1 e 1000 linhas por lote.');
  return input.map((raw, i) => {
    const serie = String(raw?.serie ?? '').trim();
    const op = String(raw?.op ?? '').trim();
    const setor = sector(raw?.setor);
    const data = String(tipo === 'PROGRAMACAO' ? raw?.data_programada : raw?.data_produzida);
    const linha = normal(raw?.linha);
    if (!/^\d{1,20}$/.test(serie) || !/^\d{1,20}$/.test(op) || !setor || setor.length > 100 || !validDate(data) || (tipo === 'PROGRAMACAO' && !linha)) {
      throw new Error(`Dados inválidos na linha ${i+1} do lote (série, OP, setor, data ou linha).`);
    }
    return { serie, op, setor, data, linha, cliente:String(raw?.cliente ?? '').slice(0,300), potencia:String(raw?.potencia ?? '').slice(0,40), referencia:String(raw?.referencia ?? '').slice(0,100), turno:String(raw?.turno ?? '').slice(0,40), codigo_produto:String(raw?.codigo_produto ?? '').slice(0,100) };
  });
}
export function registerGestaoAtrasosRoutes(
  app: Express, pool: Pool, auth: any, requireCoordenacao: any,
  getUserAccess: (id: number) => Promise<any[]>,
) {
  const base = '/api/gestao-atrasos';
  // Respostas por usuário nunca são compartilhadas entre perfis.
  function invalidateSummary() {}
  async function getAuthorizedSectors(reqAuth: any): Promise<string[] | null> {
    if (reqAuth?.perfil === 'COORDENACAO') return null;
    const acessos = await getUserAccess(Number(reqAuth?.userId));
    const allowed = new Set<string>();
    for (const access of acessos) {
      const s = sector(access.setor);
      if (!s) continue;
      allowed.add(s);
      if (s === 'BOBINA AT/BT') { allowed.add('BOBINA AT'); allowed.add('BOBINA BT'); }
      if (s === 'CORTE DO LASER') allowed.add('FERRAGEM');
      if (s === 'MONTAGEM DO NUCLEO') allowed.add('CORTE DO NUCLEO');
      if (s === 'EPOXI') { allowed.add('BOBINAGEM EPOXI'); allowed.add('ENCAPSULAMENTO'); }
    }
    return [...allowed].sort();
  }

  app.get(`${base}/permissoes`, auth, async (req: any, res) => {
    try {
      const sectors = await getAuthorizedSectors(req.auth);
      res.json({coordenacao: sectors === null, setores: sectors || []});
    } catch (e) {res.status(500).json({error:'Falha ao verificar permissões de setores.'});}
  });

  app.post(`${base}/importacoes/iniciar`, auth, requireCoordenacao, async (req: any,res) => {
    try {
      const tipo = requireType(req.body?.tipo);
      const esperado = Number(req.body?.esperado);
      if (!Number.isInteger(esperado) || esperado < 1 || esperado > 200000) return res.status(400).json({error:'Quantidade inválida: envie entre 1 e 200.000 registros.'});
      const id = randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`itam_atrasos_import_${tipo}`]);
        // Remove somente a importação PENDENTE. A ATIVA continua consultável até a conclusão.
        await client.query('DELETE FROM public.atrasos_importacoes WHERE tipo=$1 AND status=$2', [tipo, 'PENDENTE']);
        await client.query('INSERT INTO public.atrasos_importacoes(id,tipo,status,esperado) VALUES($1,$2,$3,$4)',[id,tipo,'PENDENTE',esperado]);
        await client.query('COMMIT');
      } catch(e) { await client.query('ROLLBACK').catch(()=>{}); throw e; }
      finally { client.release(); }
      res.json({id,tipo,esperado});
    } catch(e:any) { res.status(400).json({error:e?.message || 'Falha ao iniciar importação. Verifique se executou SUPABASE_GESTAO_ATRASOS.sql no Supabase correto.'}); }
  });

  app.post(`${base}/importacoes/lote`, auth, requireCoordenacao, async (req:any,res) => {
    try {
      const tipo = requireType(req.body?.tipo);
      const id = String(req.body?.id || '');
      if (!UUID.test(id)) throw new Error('ID de importação inválido.');
      const linhas = validateLines(req.body?.linhas, tipo);
      if(new Set(linhas.map(r=>JSON.stringify([r.serie,r.setor,r.op]))).size!==linhas.length) throw new Error('Série, setor e OP repetidos no lote.');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const session = await client.query('SELECT id FROM public.atrasos_importacoes WHERE id=$1 AND tipo=$2 AND status=$3 FOR UPDATE',[id,tipo,'PENDENTE']);
        if (!session.rowCount) throw new Error('Importação não está mais pendente. Recomece o envio.');
        const values:any[]=[];
        const tuples=linhas.map((row) => {
          const props=tipo==='PROGRAMACAO' ? [row.serie,row.setor,row.op,row.data,row.linha,row.cliente,row.potencia,row.referencia] : [row.serie,row.setor,row.op,row.data,row.linha,row.potencia,row.turno,row.codigo_produto];
          const start=values.length+1; values.push(id,...props);
          return `(${Array.from({length:9},(_,j)=>`$${start+j}::${j===0?'uuid':j===4?'date':'text'}`).join(',')})`;
        });
        const columns=tipo==='PROGRAMACAO' ? 'importacao_id,serie,setor,op,data_programada,linha,cliente,potencia,referencia' : 'importacao_id,serie,setor,op,data_produzida,linha,potencia,turno,codigo_produto';
        const table=tipo==='PROGRAMACAO' ? 'atrasos_programacao_detalhada' : 'atrasos_apontamentos_detalhados';
        const fields = columns.split(',').slice(4);
        const matches = fields.map(field => `target.${field} IS NOT DISTINCT FROM incoming.${field}`).join(' AND ');
        // Existing identical rows count as accepted without another write. The row lock
        // above serializes batches/finalization for this import; conflicting replay rolls back.
        const inserted = await client.query(`WITH incoming(${columns}) AS (VALUES ${tuples.join(',')}),
          inserted AS (INSERT INTO public.${table}(${columns}) SELECT * FROM incoming
            ON CONFLICT (importacao_id,serie,setor,op) DO NOTHING RETURNING 1)
          SELECT (SELECT COUNT(*) FROM inserted) + (SELECT COUNT(*) FROM incoming
            JOIN public.${table} target USING(importacao_id,serie,setor,op) WHERE ${matches}) AS accepted`,values);
        if (Number(inserted.rows[0]?.accepted) !== linhas.length) throw new Error('Lote repetido com conteúdo diferente. Recomece a importação.');
        await client.query('COMMIT');
      } catch(e) { await client.query('ROLLBACK').catch(()=>{}); throw e; }
      finally { client.release(); }
      res.json({gravados:linhas.length});
    } catch(e:any) { res.status(400).json({error:e?.code==='23505'?'Série repetida no mesmo setor nesta importação. Corrija o Excel antes de continuar.':e?.message||'Falha ao inserir lote.'}); }
  });

  app.post(`${base}/importacoes/finalizar`, auth, requireCoordenacao, async (req:any,res) => {
    let client: any;
    try {
      const tipo = requireType(req.body?.tipo);
      const id=String(req.body?.id || '');
      if (!UUID.test(id)) throw new Error('ID inválido.');
      client=await pool.connect();
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`itam_atrasos_import_${tipo}`]);
      const session=await client.query("SELECT esperado,status FROM public.atrasos_importacoes WHERE id=$1 AND tipo=$2 AND (status=$3 OR status='ATIVA') FOR UPDATE",[id,tipo,'PENDENTE']);
      if (!session.rowCount) throw new Error('Importação pendente não encontrada.');
      if(session.rows[0].status==='ATIVA') {
        await client.query('COMMIT');client.release();client=null;
        return res.json({importados:Number(session.rows[0].esperado),divergencias:[],totalDivergencias:0,avisoConferencia:'Importação já estava ativa. Repetição confirmada; conferência não repetida.',repetida:true});
      }
      const table=tipo==='PROGRAMACAO'?'atrasos_programacao_detalhada':'atrasos_apontamentos_detalhados';
      const count=await client.query(`SELECT count(*)::int AS total FROM public.${table} WHERE importacao_id=$1`,[id]);
      const total=Number(count.rows[0]?.total);
      if (total !== Number(session.rows[0].esperado)) throw new Error(`Importação incompleta: ${total} de ${session.rows[0].esperado} registros.`);
      await client.query('DELETE FROM public.atrasos_importacoes WHERE tipo=$1 AND status=$2',[tipo,'ATIVA']);
      await client.query("UPDATE public.atrasos_importacoes SET status='ATIVA',atualizado_em=now() WHERE id=$1",[id]);
      await client.query('COMMIT');
      client.release(); client=null;
      // A importação JÁ foi confirmada. Falhas de conferência não a desfazem.
      // Divergências entre arquivos ou entre duas OPs de um mesmo arquivo não bloqueiam.
      let divergencias: any[] = [];
      let totalDivergencias = 0;
      let avisoConferencia: string | null = null;
      try {
        const mismatch = await pool.query(`
          WITH prog AS (
            SELECT p.serie, p.setor, p.op FROM public.atrasos_programacao_detalhada p
            JOIN public.atrasos_importacoes i ON i.id = p.importacao_id AND i.status = 'ATIVA'
          ), apont AS (
            SELECT p.serie, p.setor, p.op FROM public.atrasos_apontamentos_detalhados p
            JOIN public.atrasos_importacoes i ON i.id = p.importacao_id AND i.status = 'ATIVA'
          ), divergencias AS (
            SELECT p.serie, p.setor, p.op AS op_programacao, a.op AS op_apontamento,
                   'ENTRE_ARQUIVOS'::text AS origem
            FROM prog p JOIN apont a ON p.serie=a.serie AND p.setor=a.setor
            WHERE p.op <> a.op
            UNION ALL
            SELECT a.serie,a.setor,a.op AS op_programacao,b.op AS op_apontamento,
                   'PROGRAMACAO'::text AS origem
            FROM prog a JOIN prog b ON a.serie=b.serie AND a.setor=b.setor AND a.op<b.op
            UNION ALL
            SELECT a.serie,a.setor,a.op AS op_programacao,b.op AS op_apontamento,
                   'APONTAMENTO'::text AS origem
            FROM apont a JOIN apont b ON a.serie=b.serie AND a.setor=b.setor AND a.op<b.op
          )
          SELECT serie,setor,op_programacao,op_apontamento,origem,
                 count(*) OVER()::int AS total_divergencias
          FROM divergencias ORDER BY serie,setor,origem LIMIT 100`);
        divergencias = mismatch.rows.map(({ total_divergencias, ...row }: any) => row);
        totalDivergencias = Number(mismatch.rows[0]?.total_divergencias || 0);
      } catch (e) {
        avisoConferencia = 'Importação concluída, mas a conferência de divergências não pôde ser concluída.';
        console.error('Gestão por OP — conferência pós-importação:', e);
      }
      invalidateSummary();
      res.json({importados: total, divergencias, totalDivergencias,
        divergenciasLimitadas: totalDivergencias > divergencias.length, avisoConferencia});

    } catch(e:any) { if(client){await client.query('ROLLBACK').catch(()=>{});client.release();} res.status(400).json({error:e?.message||'Falha ao finalizar importação.'}); }
  });

  // A mesma série pode percorrer vários setores. Conflitos dentro de um setor
  // são resolvidos deterministamente para que não multipliquem quantidades.
  const activeRows = (scope = 'TRUE', bulkDone = false) => `WITH prog AS (
    SELECT DISTINCT ON (p.serie,p.setor) p.serie,p.setor,p.op,p.data_programada,p.linha,p.cliente,p.potencia
    FROM public.atrasos_programacao_detalhada p
    JOIN public.atrasos_importacoes i ON i.id=p.importacao_id AND i.status='ATIVA' AND i.tipo='PROGRAMACAO'
    WHERE ${scope}
    ORDER BY p.serie,p.setor,p.data_programada,p.op
  ), done AS ${bulkDone?'MATERIALIZED':'NOT MATERIALIZED'} (
    SELECT a.serie,a.setor,a.op,a.data_produzida
    FROM public.atrasos_apontamentos_detalhados a
    JOIN public.atrasos_importacoes i ON i.id=a.importacao_id AND i.status='ATIVA' AND i.tipo='APONTAMENTO'
  )`;

  app.get(`${base}/resumo`, auth, async (req:any,res) => {
    try {
      const allowed=await getAuthorizedSectors(req.auth);
      if (allowed !== null && !allowed.length) return res.json({periodo:period(),rows:[],total:0,importacoes:[]});
      const {start,end,today}=period();
      const op=String(req.query.op||'').trim();
      const serie=String(req.query.serie||'').trim();
      const setor=sector(req.query.setor);
      const linha=normal(req.query.linha);const cliente=String(req.query.cliente||'').trim();
      const situacao=String(req.query.situacao||'ATRASADOS');
      const justificativa=String(req.query.justificativa||'');
      const multiplos=req.query.multiplos==='true';
      const dateFrom=String(req.query.inicio||start),dateTo=String(req.query.fim||new Date(Date.parse(end)-86400000).toISOString().slice(0,10));
      const page=Number(req.query.page||1);
      if (!Number.isInteger(page)||page<1||page>100000) return res.status(400).json({error:'Página inválida.'});
      if ((op&&!/^\d{1,20}$/.test(op))||(serie&&!/^\d{1,20}$/.test(serie))||
        !['ATRASADOS','TODOS','PENDENTES','CONCLUIDOS','PRAZO_VENCIDO'].includes(situacao)||
        (justificativa&&!['COM','SEM'].includes(justificativa))||!validDate(dateFrom)||!validDate(dateTo)||dateFrom>dateTo)
        return res.status(400).json({error:'Filtros inválidos.'});
      if (allowed !== null && setor && !allowed.includes(setor)) return res.status(403).json({error:'Setor não autorizado.'});
      const values:any[]=[dateFrom,dateTo,today,allowed,setor||null,op||null,serie||null,linha||null,cliente||null,dateFrom,dateTo,situacao,justificativa,multiplos];
      const result=await pool.query(`${activeRows('($4::text[] IS NULL OR p.setor=ANY($4::text[])) AND ($5::text IS NULL OR p.setor=$5) AND ($7::text IS NULL OR p.serie=$7) AND p.data_programada <= $11::date',!op&&!serie&&!setor&&!linha&&!cliente&&allowed===null)}, scoped AS (
        SELECT p.*,a.data_produzida
        FROM prog p LEFT JOIN done a ON a.serie=p.serie AND a.setor=p.setor AND a.op=p.op
        WHERE ($4::text[] IS NULL OR p.setor=ANY($4::text[]))
          AND ($5::text IS NULL OR p.setor=$5)
          AND ($6::text IS NULL OR p.op=$6)
          AND ($7::text IS NULL OR p.serie=$7)
          AND ($8::text IS NULL OR p.linha=$8)
          AND ($9::text IS NULL OR p.cliente ILIKE '%'||$9||'%')
          AND p.data_programada BETWEEN $1::date AND $2::date
          AND p.data_programada BETWEEN $10::date AND $11::date
      ), grouped AS (
        SELECT op,setor,MAX(linha) linha,MAX(cliente) cliente,MAX(potencia) potencia,
          COUNT(*)::int programados,COUNT(data_produzida)::int produzidos,
          array_agg(serie) FILTER(WHERE data_programada<$3::date AND data_produzida IS NULL) series_vencidas,
          COUNT(*) FILTER(WHERE data_programada<$3::date AND data_produzida IS NULL)::int pendentes_vencidos,
          COUNT(*) FILTER(WHERE data_produzida>data_programada)::int produzidos_em_atraso,
          COUNT(DISTINCT data_programada)::int dias_programados,
          MIN(data_programada)::text primeira_data_programada,MAX(data_programada)::text ultima_data_programada,
          MAX(data_produzida) ultima_producao
        FROM scoped GROUP BY op,setor
      ), ready AS (
        SELECT g.*,j.motivo,j.previsao_regularizacao::text,j.usuario_login AS responsavel,j.criado_em,
          CASE WHEN g.programados=g.produzidos AND j.previsao_regularizacao IS NOT NULL
                 AND g.ultima_producao>j.previsao_regularizacao THEN 'CONCLUIDO_APOS_PRAZO'
            WHEN g.programados=g.produzidos THEN 'REGULARIZADO'
            WHEN j.previsao_regularizacao<$3::date AND g.pendentes_vencidos>0 THEN 'PRAZO_VENCIDO'
            WHEN g.pendentes_vencidos>0 AND j.id IS NULL THEN 'SEM_JUSTIFICATIVA'
            WHEN g.pendentes_vencidos>0 AND j.previsao_regularizacao IS NULL THEN 'SEM_PRAZO'
            WHEN g.pendentes_vencidos>0 THEN 'JUSTIFICADO' ELSE 'NO_PRAZO' END situacao
        FROM grouped g LEFT JOIN LATERAL (
          SELECT id,motivo,previsao_regularizacao,usuario_login,criado_em
          FROM public.atrasos_justificativas WHERE op=g.op AND setor=g.setor
          ORDER BY criado_em DESC,id DESC LIMIT 1
        ) j ON true
      ), filtered AS MATERIALIZED (
      SELECT * FROM ready
      WHERE ($12='TODOS' OR ($12='ATRASADOS' AND (pendentes_vencidos>0 OR produzidos_em_atraso>0))
        OR ($12='PENDENTES' AND pendentes_vencidos>0)
        OR ($12='CONCLUIDOS' AND programados=produzidos)
        OR ($12='PRAZO_VENCIDO' AND situacao='PRAZO_VENCIDO'))
        AND ($13='' OR ($13='COM' AND motivo IS NOT NULL) OR ($13='SEM' AND motivo IS NULL))
        AND (NOT $14::boolean OR dias_programados>1)
      ), page_rows AS (
        SELECT * FROM filtered ORDER BY pendentes_vencidos DESC,ultima_data_programada DESC,op DESC,setor
        LIMIT 50 OFFSET $15
      )
      SELECT (SELECT COUNT(*)::int FROM filtered) total,
        COALESCE((SELECT jsonb_agg(to_jsonb(r)-'series_vencidas') FROM page_rows r),'[]'::jsonb) rows,
        jsonb_build_object(
          'ops_atrasadas',(SELECT COUNT(DISTINCT op)::int FROM filtered WHERE pendentes_vencidos>0 OR produzidos_em_atraso>0),
          'transformadores_vencidos',(SELECT COUNT(DISTINCT serie)::int FROM filtered f CROSS JOIN LATERAL unnest(f.series_vencidas) serie),
          'produzidos_fora_prazo',COALESCE((SELECT SUM(produzidos_em_atraso)::int FROM filtered),0),
          'sem_justificativa',(SELECT COUNT(*)::int FROM filtered WHERE situacao='SEM_JUSTIFICATIVA'),
          'prazo_vencido',(SELECT COUNT(*)::int FROM filtered WHERE situacao='PRAZO_VENCIDO'),
          'regularizados',(SELECT COUNT(*)::int FROM filtered WHERE programados=produzidos)
        ) kpis,
        COALESCE((SELECT jsonb_agg(i) FROM (SELECT tipo,esperado,atualizado_em FROM public.atrasos_importacoes WHERE status='ATIVA') i),'[]'::jsonb) importacoes`,[...values,(page-1)*50]);
      res.json({periodo:{inicio:dateFrom,fim:dateTo,hoje:today},...result.rows[0],page});
    } catch(e:any) { res.status(500).json({error:e?.code==='42P01'?'Execute SUPABASE_GESTAO_ATRASOS.sql no banco de atrasos.':'Falha ao carregar a Visão OP.'}); }
  });

  app.get(`${base}/op/:op`,auth,async(req:any,res)=>{
    try {
      const op=String(req.params.op||'');const setor=sector(req.query.setor);
      const allowed=await getAuthorizedSectors(req.auth);
      if(!/^\d{1,20}$/.test(op)||!setor) return res.status(400).json({error:'OP e setor obrigatórios.'});
      if(allowed!==null&&!allowed.includes(setor)) return res.status(403).json({error:'Setor não autorizado.'});
      const {start,end,today}=selectedPeriod(req.query);
      const result=await pool.query(`${activeRows('p.data_programada < $4::date')}, scoped AS MATERIALIZED (
        SELECT p.*,a.data_produzida FROM prog p
        LEFT JOIN done a ON a.serie=p.serie AND a.setor=p.setor AND a.op=p.op
        WHERE p.op=$1 AND p.data_programada >= $3::date AND p.data_programada<$4::date
      ), series AS (
        SELECT serie,setor,op,data_programada::text,linha,cliente,potencia,data_produzida::text,
          CASE WHEN data_produzida>data_programada THEN 'PRODUZIDO_ATRASADO'
            WHEN data_produzida IS NOT NULL THEN 'PRODUZIDO_NO_PRAZO'
            WHEN data_programada<$5::date THEN 'PENDENTE_VENCIDO' ELSE 'PENDENTE_NO_PRAZO' END situacao
        FROM scoped WHERE setor=$2 ORDER BY data_programada,serie
      ), progress AS (
        SELECT setor,COUNT(*)::int programados,COUNT(data_produzida)::int produzidos,
          (SELECT COUNT(DISTINCT serie)::int FROM scoped) quantidade_op,
          COUNT(*) FILTER(WHERE data_programada<$5::date AND data_produzida IS NULL)::int pendentes_vencidos
        FROM scoped GROUP BY setor ORDER BY setor
      ) SELECT EXISTS(SELECT 1 FROM series) visible,
        COALESCE((SELECT jsonb_agg(s) FROM series s),'[]'::jsonb) series,
        COALESCE((SELECT jsonb_agg(p) FROM progress p),'[]'::jsonb) progresso,
        EXISTS(SELECT 1 FROM public.atrasos_importacoes WHERE tipo='APONTAMENTO' AND status='ATIVA') AS "apontamentoImportado"`,[op,setor,start,end,today]);
      const resultRow=result.rows[0];
      if(!resultRow?.visible) return res.status(404).json({error:'OP não encontrada no setor autorizado.'});
      const {visible,...detail}=resultRow;
      res.json(detail);
    }catch(e) {res.status(e instanceof RangeError?400:500).json({error:e instanceof RangeError?e.message:'Falha ao carregar detalhes da OP.'});}
  });

  app.get(`${base}/justificativas`,auth,async(req:any,res)=>{
    try {
      const op=String(req.query?.op || '').trim();const setor=sector(req.query?.setor);
      if(!/^\d{1,20}$/.test(op) || !setor) return res.status(400).json({error:'Informe OP e setor válidos.'});
      const allowed=await getAuthorizedSectors(req.auth);
      if(allowed!==null&&!allowed.includes(setor)) return res.status(403).json({error:'Setor não autorizado.'});
      const result=await pool.query(`SELECT j.id,j.motivo,j.previsao_regularizacao::text,j.criado_em,j.usuario_login AS responsavel
        FROM public.atrasos_justificativas j
        WHERE j.op=$1 AND j.setor=$2 ORDER BY j.criado_em DESC,j.id DESC LIMIT 100`,[op,setor]);
      res.json({rows:result.rows});
    } catch {res.status(500).json({error:'Falha ao buscar histórico.'});}
  });

  app.post(`${base}/justificativas`,auth,async(req:any,res)=>{
    try {
      const op=String(req.body?.op ?? '').trim();const setor=sector(req.body?.setor);
      const motivo=String(req.body?.motivo ?? '').trim();const previsao=req.body?.previsao_regularizacao;
      if(!/^\d{1,20}$/.test(op) || !setor || motivo.length<5 || motivo.length>3000 || !validDate(previsao)) {
        return res.status(400).json({error:'Informe OP, setor, motivo de 5 a 3000 caracteres e previsão válida.'});
      }
      const allowed=await getAuthorizedSectors(req.auth);
      if (allowed !== null && !allowed.includes(setor)) return res.status(403).json({error:'Setor não autorizado.'});
      const {start,end}=selectedPeriod(req.body);
      const opExists=await pool.query(`SELECT 1 FROM public.atrasos_programacao_detalhada p JOIN public.atrasos_importacoes i
        ON i.id=p.importacao_id AND i.status='ATIVA' WHERE p.op=$1 AND p.setor=$2
        AND p.data_programada >= $3::date AND p.data_programada < $4::date LIMIT 1`,[op,setor,start,end]);
      if(!opExists.rowCount)return res.status(404).json({error:'OP e setor não encontrados na programação ativa do período.'});
      const result=await pool.query(`INSERT INTO public.atrasos_justificativas(op,setor,motivo,previsao_regularizacao,usuario_id,usuario_login)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id,criado_em`,[op,setor,motivo,previsao,Number(req.auth.userId),String(req.auth.login || 'USUARIO')]);
      invalidateSummary();
      res.json({ok:true,...result.rows[0]});
    } catch(e) {res.status(e instanceof RangeError?400:500).json({error:e instanceof RangeError?e.message:'Falha ao salvar justificativa.'});}
  });
}
