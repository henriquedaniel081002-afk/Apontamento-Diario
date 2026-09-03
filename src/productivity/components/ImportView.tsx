import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, UploadCloud, XCircle } from 'lucide-react';
import { formatDateBR } from '../utils/calculations';
import { filterImportPreviewByMonths, ImportPreview, importProductivity, parseProductivityWorkbook } from '../services/importService';
import { isSupabaseConfigured } from '../lib/supabase';

interface ImportViewProps { onImported: () => Promise<void>; embedded?: boolean; }

type Stage = 'idle' | 'reading' | 'ready' | 'importing' | 'success' | 'error';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[(month || 1) - 1]} ${year}`;
};

export const ImportView: React.FC<ImportViewProps> = ({ onImported, embedded = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<any>(null);

  const selectedProductionRows = useMemo(() => {
    if (!preview || selectedMonths.length === 0) return 0;
    const selected = new Set(selectedMonths);
    return preview.productionPayload.filter(row => selected.has(String(row.data).slice(0, 7))).length;
  }, [preview, selectedMonths]);

  const chooseFile = () => inputRef.current?.click();
  const onFile = async (file?: File) => {
    if (!file) return;
    setStage('reading'); setMessage(''); setResult(null); setPreview(null); setSelectedMonths([]);
    try {
      if (!/\.xls(?:x|m)?$/i.test(file.name)) throw new Error('Selecione um arquivo Excel .xlsx, .xlsm ou .xls.');
      const parsed = await parseProductivityWorkbook(file);
      setPreview(parsed);
      setStage('ready');
    } catch (e:any) {
      setMessage(e?.message || 'Não foi possível ler o arquivo.');
      setStage('error');
    }
  };

  const toggleMonth = (month: string) => {
    setSelectedMonths(prev => prev.includes(month) ? prev.filter(item => item !== month) : [...prev, month].sort());
  };

  const confirmImport = async () => {
    if (!preview) return;
    if (selectedMonths.length === 0) { setMessage('Selecione pelo menos um mês antes de importar.'); return; }
    if (!isSupabaseConfigured) { setMessage('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de importar.'); setStage('error'); return; }
    setStage('importing'); setMessage('');
    try {
      const selectedPreview = filterImportPreviewByMonths(preview, selectedMonths);
      const response = await importProductivity(selectedPreview);
      setResult(response);
      await onImported();
      setStage('success');
    } catch (e:any) {
      setMessage(e?.message || 'Falha durante a importação. A base anterior foi preservada.');
      setStage('error');
    }
  };

  const reset = () => {
    setStage('idle'); setPreview(null); setSelectedMonths([]); setMessage(''); setResult(null);
    if (inputRef.current) inputRef.current.value='';
  };

  return <div className={`w-full flex flex-col ${embedded ? 'gap-3' : 'gap-6'}`}>
    {!embedded && <div className="bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] p-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"><UploadCloud className="w-5 h-5"/></div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Importar Excel</h2>
          <p className="text-xs text-slate-400 mt-1">Selecione o arquivo, escolha os meses desejados e confirme a substituição. Dias de trabalho são preservados.</p>
        </div>
      </div>
    </div>}

    <div className={`bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] ${embedded ? 'p-3 sm:p-4 gap-3' : 'p-5 gap-5'} flex flex-col`}>
      <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e=>onFile(e.target.files?.[0])}/>
      <button onClick={chooseFile} disabled={stage==='reading'||stage==='importing'} className={`${embedded ? 'min-h-28' : 'min-h-44'} rounded-[1.15rem] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:bg-white/[0.05] transition flex flex-col items-center justify-center gap-3 px-6 disabled:opacity-60`}>
        {stage==='reading' ? <Loader2 className="w-8 h-8 text-cyan-400 animate-spin"/> : <FileSpreadsheet className="w-9 h-9 text-emerald-400"/>}
        <div className="text-center">
          <div className="text-sm font-bold text-slate-100">{stage==='reading'?'Lendo e validando arquivo...':'Selecionar arquivo Excel'}</div>
          <div className="text-xs text-slate-400 mt-1">Aba obrigatória: BOBINAGEM (MÁQ). A BASE DE FUNCIONARIOS não é mais utilizada.</div>
        </div>
      </button>

      {preview && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Info label="Arquivo" value={preview.fileName}/>
          <Info label="Produção válida" value={String(preview.productionRows)}/>
          <Info label="Período encontrado" value={preview.firstDate&&preview.lastDate?`${formatDateBR(preview.firstDate)} a ${formatDateBR(preview.lastDate)}`:'-'}/>
        </div>

        <div className="rounded-[1.15rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Quais meses devem ser importados?</h3>
              <p className="text-xs text-slate-400 mt-1">Selecione um ou mais meses encontrados na aba BOBINAGEM (MÁQ).</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={()=>setSelectedMonths(preview.availableMonths)} className="px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] bg-white/[0.05] hover:bg-white/[0.08] text-[11px] text-slate-200">Selecionar todos</button>
              <button type="button" onClick={()=>setSelectedMonths([])} className="px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] bg-white/[0.05] hover:bg-white/[0.08] text-[11px] text-slate-300">Limpar</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {preview.availableMonths.map(month => {
              const selected = selectedMonths.includes(month);
              return <button
                key={month}
                type="button"
                onClick={()=>toggleMonth(month)}
                aria-pressed={selected}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition ${selected ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300' : 'bg-white/[0.04] border-[var(--border-subtle)] text-slate-300 hover:bg-white/[0.06]'}`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? 'bg-emerald-500 border-emerald-400 text-[#04130d]' : 'border-slate-600 bg-[var(--surface-muted)]'}`}>{selected && <Check className="w-3 h-3"/>}</span>
                {monthLabel(month)}
              </button>;
            })}
          </div>

          <div className="text-xs text-slate-400">
            {selectedMonths.length > 0
              ? <><span className="text-slate-200 font-semibold">{selectedMonths.length}</span> mês(es) selecionado(s) • <span className="text-slate-200 font-semibold">{selectedProductionRows}</span> registro(s) serão enviados.</>
              : <span className="text-amber-300">Selecione pelo menos um mês para habilitar a importação.</span>}
          </div>
        </div>

        {preview.warnings.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/><div>{preview.warnings.map((warning,index)=><div key={index}>{warning}</div>)}</div></div>}
      </>}

      {message && <div className="flex gap-2 p-4 rounded-lg bg-red-950/30 border border-red-500/30 text-sm text-red-100"><XCircle className="w-5 h-5 shrink-0"/><span>{message}</span></div>}

      {stage==='success' && <div className="flex gap-2 p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-sm text-emerald-200"><CheckCircle2 className="w-5 h-5 shrink-0"/><div><div className="font-bold">Importação concluída com sucesso.</div>{result && <div className="text-xs mt-1 text-emerald-300/80">{result.registros_producao ?? selectedProductionRows} registros • {result.jornadas ?? '-'} jornadas</div>}</div></div>}
      {stage==='success' && result?.controle_colaboradores_aviso && <div className="flex gap-2 p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs text-amber-100"><AlertTriangle className="w-4 h-4 shrink-0"/><span>A produção foi importada, mas o gerenciamento de colaboradores não foi sincronizado: {result.controle_colaboradores_aviso}</span></div>}

      {stage==='ready' && preview && <div className="p-4 rounded-[1.15rem] bg-red-950/20 border border-red-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-300 shrink-0 mt-0.5"/>
          <div>
            <div className="text-sm font-bold text-red-100">Atenção: substituição total da base importada</div>
            <p className="text-xs text-red-200/70 mt-1">Somente os meses marcados serão enviados ao Supabase. Como a regra atual substitui toda a produção e jornadas, meses não selecionados não permanecerão na base após a importação.</p>
          </div>
        </div>
        <button disabled={selectedMonths.length===0} onClick={confirmImport} className="shrink-0 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:text-slate-500 disabled:cursor-not-allowed text-[#03110b] text-xs font-extrabold">Confirmar e substituir</button>
      </div>}

      {stage==='importing' && <div className="flex items-center gap-3 p-4 rounded-lg bg-cyan-950/30 border border-cyan-500/30"><Loader2 className="w-5 h-5 text-cyan-300 animate-spin"/><div><div className="text-sm font-bold text-cyan-100">Substituindo dados no Supabase...</div><div className="text-xs text-cyan-200/70 mt-1">Aguarde a conclusão da validação e gravação.</div></div></div>}

      {(stage==='success'||stage==='error') && <button onClick={reset} className="self-start inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-[var(--border-subtle)] text-xs text-slate-200"><RefreshCw className="w-4 h-4"/>Nova tentativa</button>}
    </div>
  </div>;
};

const Info = ({label,value}:{label:string,value:string}) => <div className="rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] p-3 min-w-0"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div><div className="text-sm text-slate-100 font-semibold mt-1 truncate" title={value}>{value}</div></div>;
