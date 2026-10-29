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
function requireType(input: unknown): Tipo {
  if (!TIPOS.has(String(input))) throw new Error('Tipo de importação inválido.');
  return input as Tipo;
}
function validateLines(input: any[], tipo: Tipo) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 400) throw new Error('Envie entre 1 e 400 linhas por lote.');
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
  let cachedSummary: {expires: number; data: unknown} | null = null;
  function invalidateSummary() {cachedSummary = null;}
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
      if (!Number.isInteger(esperado) || esperado < 1 || esperado > 200000) return res.status(400).json({error:'Quantidade inválida (máximo 200 mil registros por arquivo).'});
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
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const session = await client.query('SELECT id FROM public.atrasos_importacoes WHERE id=$1 AND tipo=$2 AND status=$3 FOR SHARE',[id,tipo,'PENDENTE']);
        if (!session.rowCount) throw new Error('Importação não está mais pendente. Recomece o envio.');
        const values:any[]=[];
        const tuples=linhas.map((row,i) => {
          const props=tipo==='PROGRAMACAO' ? [row.serie,row.setor,row.op,row.data,row.linha,row.cliente,row.potencia,row.referencia] : [row.serie,row.setor,row.op,row.data,row.linha,row.potencia,row.turno,row.codigo_produto];
          const start=values.length+1; values.push(id,...props);
          return `(${Array.from({length:9},(_,j)=>`$${start+j}`).join(',')})`;
        });
        const columns=tipo==='PROGRAMACAO' ? 'importacao_id,serie,setor,op,data_programada,linha,cliente,potencia,referencia' : 'importacao_id,serie,setor,op,data_produzida,linha,potencia,turno,codigo_produto';
        const table=tipo==='PROGRAMACAO' ? 'atrasos_programacao_detalhada' : 'atrasos_apontamentos_detalhados';
        await client.query(`INSERT INTO public.${table}(${columns}) VALUES ${tuples.join(',')}`,values);
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
      const session=await client.query('SELECT esperado FROM public.atrasos_importacoes WHERE id=$1 AND tipo=$2 AND status=$3 FOR UPDATE',[id,tipo,'PENDENTE']);
      if (!session.rowCount) throw new Error('Importação pendente não encontrada.');
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

  app.get(`${base}/resumo`, auth, async (_req:any,res) => {
    try {
      if (cachedSummary && cachedSummary.expires > Date.now()) return res.json(cachedSummary.data);
      const {start,end,today}=period();
      // O recorte de dois meses é aplicado na programação. Os apontamentos da base ativa
      // são cruzados pela série e setor, nunca somando quantidades entre setores.
      const result=await pool.query(`
        WITH prog AS (
          SELECT s.* FROM public.atrasos_programacao_detalhada s
          JOIN public.atrasos_importacoes imp ON imp.id=s.importacao_id AND imp.status='ATIVA'
          WHERE s.data_programada >= $1::date AND s.data_programada < $2::date
        ),
        done AS (
          SELECT a.* FROM public.atrasos_apontamentos_detalhados a
          JOIN public.atrasos_importacoes imp ON imp.id=a.importacao_id AND imp.status='ATIVA'
        ),
        totals AS (
          SELECT op,COUNT(DISTINCT serie)::int AS quantidade_op FROM prog GROUP BY op
        )
        SELECT p.op,p.setor,MAX(p.linha) AS linha,MAX(p.cliente) AS cliente,
               t.quantidade_op,COUNT(*)::int AS programados,
               COUNT(a.serie)::int AS produzidos,
               COUNT(*) FILTER (WHERE p.data_programada < $3::date AND a.serie IS NULL)::int AS pendentes_vencidos,
               COUNT(*) FILTER (WHERE a.data_produzida > p.data_programada)::int AS produzidos_em_atraso,
               MIN(p.data_programada)::text AS primeira_data_programada,
               MAX(p.data_programada)::text AS ultima_data_programada
        FROM prog p
        JOIN totals t ON t.op=p.op
        LEFT JOIN done a ON a.serie=p.serie AND a.setor=p.setor AND a.op=p.op
        GROUP BY p.op,p.setor,t.quantidade_op
        ORDER BY MAX(p.data_programada) DESC,p.op DESC,p.setor`,[start,end,today]);
      const justification=await pool.query(`SELECT DISTINCT ON (j.op,j.setor) j.op,j.setor,j.motivo,j.previsao_regularizacao::text,
        j.criado_em,j.usuario_login AS responsavel
        FROM public.atrasos_justificativas j
        ORDER BY j.op,j.setor,j.criado_em DESC,j.id DESC`);
      const imports=await pool.query("SELECT tipo,esperado,atualizado_em FROM public.atrasos_importacoes WHERE status='ATIVA'");
      const payload={periodo:{inicio:start,fimExclusivo:end,hoje:today}, rows:result.rows, justificativas:justification.rows, importacoes:imports.rows};
      cachedSummary={expires:Date.now()+30_000,data:payload};
      res.json(payload);
    } catch(e:any) { res.status(500).json({error:e?.code==='42P01'?'Execute SUPABASE_GESTAO_ATRASOS.sql no Supabase antes de abrir Gestão por OP.':'Falha ao carregar a Gestão de Atrasos.'}); }
  });

  app.get(`${base}/justificativas`,auth,async(req:any,res)=>{
    try {
      const op=String(req.query?.op || '').trim();const setor=sector(req.query?.setor);
      if(!/^\d{1,20}$/.test(op) || !setor) return res.status(400).json({error:'Informe OP e setor válidos.'});
      const result=await pool.query(`SELECT j.id,j.motivo,j.previsao_regularizacao::text,j.criado_em,j.usuario_login AS responsavel
        FROM public.atrasos_justificativas j
        WHERE j.op=$1 AND j.setor=$2 ORDER BY j.criado_em DESC,j.id DESC LIMIT 100`,[op,setor]);
      res.json({rows:result.rows});
    } catch {res.status(500).json({error:'Falha ao buscar histórico.'});}
  });

  app.post(`${base}/justificativas`,auth,async(req:any,res)=>{
    try {
      const op=String(req.body?.op ?? '').trim();const setor=sector(req.body?.setor);
      const motivo=String(req.body?.motivo ?? '').trim();const previsao=req.body?.previsao_regularizacao || null;
      if(!/^\d{1,20}$/.test(op) || !setor || motivo.length<5 || motivo.length>3000 || (previsao!==null&&!validDate(previsao))) {
        return res.status(400).json({error:'Informe OP, setor, motivo de 5 a 3000 caracteres e data válida.'});
      }
      const allowed = await getAuthorizedSectors(req.auth);
      if (allowed !== null && !allowed.includes(setor)) {
        return res.status(403).json({error:'Você só pode justificar atrasos dos setores autorizados.'});
      }
      const {start,end}=period();
      const opExists=await pool.query(`SELECT 1 FROM public.atrasos_programacao_detalhada p JOIN public.atrasos_importacoes i
        ON i.id=p.importacao_id AND i.status='ATIVA' WHERE p.op=$1 AND p.setor=$2
        AND p.data_programada >= $3::date AND p.data_programada < $4::date LIMIT 1`,[op,setor,start,end]);
      if(!opExists.rowCount)return res.status(404).json({error:'OP e setor não encontrados na programação ativa do período.'});
      const result=await pool.query(`INSERT INTO public.atrasos_justificativas(op,setor,motivo,previsao_regularizacao,usuario_id,usuario_login)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id,criado_em`,[op,setor,motivo,previs,Number(req.auth.userId),String(req.auth.login || 'USUARIO')]);
      invalidateSummary();
      res.json({ok:true,...result.rows[0]});
    } catch(e:any){res.status(500).json({error:'Falha ao salvar justificativa.'});}
  });
}
