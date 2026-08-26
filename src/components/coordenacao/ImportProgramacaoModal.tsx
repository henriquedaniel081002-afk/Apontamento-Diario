import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, CheckCircle2, FileSpreadsheet, FileUp, Loader2 } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';
import { Button } from '../common/ui';
import { programacaoImportSector, readProgramacaoExcel, type ProgramacaoImportGroup, type ProgramacaoImportPreview } from '../../utils/importProgramacaoExcel';
import type { ImportSectorFilter } from '../../types';
import { CustomSelect } from '../common/CustomSelect';
import { finishLoadingProgress, startLoadingProgress } from '../../services/loadingProgressService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (mesReferencia: string, grupos: ProgramacaoImportGroup[], setorFiltro: ImportSectorFilter) => Promise<void>;
}

const IMPORT_SECTOR_OPTIONS: Array<{ value: ImportSectorFilter; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'BOBINA AT/BT', label: 'Bobina AT/BT' },
  { value: 'CORTE LASER', label: 'Corte do Laser' },
  { value: 'CORTE DO NUCLEO', label: 'Corte do Núcleo' },
  { value: 'FERRAGEM', label: 'Ferragem' },
  { value: 'ISOLANTE', label: 'Isolante' },
  { value: 'MONTAGEM NUCLEO', label: 'Montagem do Núcleo' },
  { value: 'MONTAGEM FINAL', label: 'Montagem Final' },
  { value: 'MPA', label: 'MPA' },
  { value: 'PINTURA', label: 'Pintura' },
  { value: 'SOLDA', label: 'Solda' },
  { value: 'EPOXI', label: 'Epóxi' },
];

function sectorLabel(value: ImportSectorFilter): string {
  return IMPORT_SECTOR_OPTIONS.find((option) => option.value === value)?.label || value;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

export function ImportProgramacaoModal({ isOpen, onClose, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mes, setMes] = useState(currentMonth);
  const [preview, setPreview] = useState<ProgramacaoImportPreview | null>(null);
  const [setorFiltro, setSetorFiltro] = useState<ImportSectorFilter>('ALL');
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) setSetorFiltro('ALL');
  }, [isOpen]);

  const filteredGroups = useMemo(() => preview?.grupos.filter((group) => setorFiltro === 'ALL' || programacaoImportSector(group.setor) === setorFiltro) || [], [preview, setorFiltro]);
  const totalProgramado = useMemo(() => filteredGroups.reduce((a,r)=>a+r.quantidade,0), [filteredGroups]);

  const resetPreview = () => { setPreview(null); setProgress(0); setError(null); };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setProcessing(true); setError(null); setPreview(null); setProgress(0);
    const loadingId = startLoadingProgress(
      'Analisando programação do Excel',
      'Lendo a aba BASE PROG 2026 e consolidando a programação do mês selecionado.',
    );
    try {
      setPreview(await readProgramacaoExcel(file, mes, setProgress));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao analisar a programação.');
    } finally {
      finishLoadingProgress(loadingId);
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!preview || importing) return;
    if (!filteredGroups.length) { setError(`Nenhum registro válido de ${sectorLabel(setorFiltro)} foi encontrado para importar.`); return; }
    setImporting(true); setError(null);
    try {
      await onImport(preview.mesReferencia, filteredGroups, setorFiltro);
      setPreview(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao importar a programação.');
    } finally { setImporting(false); }
  };

  return <ModalShell
    isOpen={isOpen}
    onClose={onClose}
    busy={processing || importing}
    size="lg"
    title="Importar programação"
    description="Escolha o mês, o setor e selecione a BASE PROG 2026.xlsx. Por padrão, todos os setores são importados."
    footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onClose} disabled={processing || importing}>Cancelar</Button>
      <Button onClick={() => void handleImport()} disabled={!preview || processing || filteredGroups.length === 0} isLoading={importing} loadingLabel="Importando…" leftIcon={<FileUp className="size-4" />}>Substituir programação do mês</Button>
    </div>}
  >
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-[220px_220px_1fr]">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-400"><CalendarRange className="size-4"/>Mês de referência</span>
          <input type="month" value={mes} disabled={processing || importing} onChange={(e)=>{setMes(e.target.value);resetPreview();}} className="min-h-11 w-full rounded-xl border border-white/15 bg-[#070B08] px-3 text-sm font-bold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-slate-400">Setor</span>
          <CustomSelect
            value={setorFiltro}
            onChange={(value) => setSetorFiltro(value as ImportSectorFilter)}
            disabled={processing || importing}
            ariaLabel="Setor da importação de programação"
            className="min-h-11 text-sm font-bold"
            options={IMPORT_SECTOR_OPTIONS}
          />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-bold text-slate-400">Arquivo</span>
          <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e)=>void handleFile(e.target.files?.[0])}/>
          <button type="button" disabled={!mes || processing || importing} onClick={()=>inputRef.current?.click()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 text-sm font-black text-emerald-200 hover:bg-emerald-400/15 disabled:opacity-40">
            {processing ? <Loader2 className="size-4 animate-spin"/> : <FileSpreadsheet className="size-4"/>}
            {processing ? 'Lendo BASE PROG…' : 'Selecionar BASE PROG 2026.xlsx'}
          </button>
        </div>
      </section>

      {processing && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">
        <p className="font-black">Processando a aba BASE PROG 2026…</p>
        <p className="mt-1 text-xs text-emerald-200/70">{progress ? `${progress.toLocaleString('pt-BR')} linhas analisadas.` : 'Preparando leitura.'}</p>
      </div>}

      {preview && <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Mês</span><p className="mt-1 font-black text-white">{preview.mesReferencia.split('-').reverse().join('/')}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Linhas selecionadas</span><p className="mt-1 font-black text-white">{totalProgramado.toLocaleString('pt-BR')}</p></div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><span className="text-xs font-black uppercase tracking-wider text-emerald-300/70">Programado</span><p className="mt-1 font-black text-emerald-200">{totalProgramado.toLocaleString('pt-BR')} un.</p></div>
          <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3"><span className="text-xs font-black uppercase tracking-wider text-sky-300/70">Consolidados</span><p className="mt-1 font-black text-sky-200">{filteredGroups.length.toLocaleString('pt-BR')}</p></div>
        </section>
        <div className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3 text-xs leading-5 text-emerald-100/80">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0"/>
          {setorFiltro === 'ALL'
            ? 'O sistema enviará ao Neon somente os consolidados por Data Programada + Setor + Linha + Potência. A programação anterior do mês será substituída para todos os setores.'
            : `Somente ${sectorLabel(setorFiltro)} será substituído no mês selecionado. A programação dos demais setores permanecerá intacta.`}
        </div>
        {setorFiltro !== 'ALL' && filteredGroups.length === 0 && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs font-semibold leading-5 text-amber-100">
            Nenhum registro de {sectorLabel(setorFiltro)} foi encontrado no mês selecionado.
          </div>
        )}
      </>}

      {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-3 text-sm font-semibold text-rose-200">{error}</div>}
    </div>
  </ModalShell>;
}
