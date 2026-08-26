import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Info,
  RotateCcw,
} from 'lucide-react';
import { ImportSectorFilter, Linha, ProductionImportGroup, ProductionImportMonthDay, Setor } from '../../types';
import { formatDateBR, formatPotencia } from '../../utils/formatters';
import {
  buildFinalImportGroups,
  getUnresolvedLineIssues,
  importUnitLabel,
  ProductionImportPreview,
  readProductionImportExcel,
  readProductionImportExcelMonth,
  productionImportSectorForRawGroup,
} from '../../utils/importProductionExcel';
import { ModalShell } from '../common/ModalShell';
import { Badge, Button, FieldError } from '../common/ui';
import { CustomSelect } from '../common/CustomSelect';
import { finishLoadingProgress, startLoadingProgress } from '../../services/loadingProgressService';

type ImportMode = 'DAY' | 'MONTH';

interface ImportProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportDay: (data: string, groups: ProductionImportGroup[], setorFiltro: ImportSectorFilter) => Promise<void>;
  onImportMonth: (mesReferencia: string, dias: ProductionImportMonthDay[], setorFiltro: ImportSectorFilter) => Promise<void>;
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
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function ImportProductionModal({
  isOpen,
  onClose,
  onImportDay,
  onImportMonth,
}: ImportProductionModalProps) {
  const [mode, setMode] = useState<ImportMode>('DAY');
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState('');
  const [mes, setMes] = useState(currentMonth);
  const [setorFiltro, setSetorFiltro] = useState<ImportSectorFilter>('ALL');
  const [previews, setPreviews] = useState<ProductionImportPreview[]>([]);
  const [corrections, setCorrections] = useState<Record<string, Linha | undefined>>({});
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progressRows, setProgressRows] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) return;
    setMode('DAY');
    setFile(null);
    setData('');
    setMes(currentMonth());
    setSetorFiltro('ALL');
    setPreviews([]);
    setCorrections({});
    setProcessing(false);
    setSaving(false);
    setProgressRows(0);
    setError(null);
  }, [isOpen]);

  const finalDays = useMemo(() => previews.map((preview) => ({
    data: preview.data,
    grupos: buildFinalImportGroups(preview, corrections)
      .filter((group) => setorFiltro === 'ALL' || group.setor === setorFiltro),
  })), [corrections, previews, setorFiltro]);

  const unresolved = useMemo(
    () => previews.flatMap((preview) => getUnresolvedLineIssues(preview, corrections))
      .filter((issue) => setorFiltro === 'ALL' || productionImportSectorForRawGroup(issue.setorOriginal, issue.linhaOriginal) === setorFiltro),
    [corrections, previews, setorFiltro],
  );
  const sectorIssues = previews.flatMap((preview) => preview.issues.filter((issue) => issue.kind === 'SETOR'))
    .filter((issue) => setorFiltro === 'ALL' || productionImportSectorForRawGroup(issue.setorOriginal, issue.linhaOriginal) === setorFiltro);
  const allGroups = finalDays.flatMap((day) => day.grupos);

  const summary = useMemo(() => {
    const map = new Map<string, { label: string; quantidade: number; groups: number }>();
    for (const group of allGroups) {
      const label = importUnitLabel(group);
      const current = map.get(label);
      if (current) {
        current.quantidade += group.quantidade;
        current.groups += 1;
      } else {
        map.set(label, { label, quantidade: group.quantidade, groups: 1 });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [allGroups]);

  const totalQuantidade = allGroups.reduce((sum, item) => sum + item.quantidade, 0);
  const rowsMatched = setorFiltro === 'ALL'
    ? previews.reduce((sum, item) => sum + item.rowsMatched, 0)
    : previews.reduce((sum, preview) => sum
      + preview.validGroups.filter((group) => group.setor === setorFiltro).reduce((subtotal, group) => subtotal + group.quantidade, 0)
      + preview.issues.filter((issue) => productionImportSectorForRawGroup(issue.setorOriginal, issue.linhaOriginal) === setorFiltro).reduce((subtotal, issue) => subtotal + issue.quantidade, 0), 0);
  const ignoredWithoutPower = setorFiltro === 'ALL' ? previews.reduce((sum, item) => sum + item.ignoredWithoutPower, 0) : 0;

  const invalidatePreview = () => {
    setPreviews([]);
    setCorrections({});
    setError(null);
  };

  const analyze = async () => {
    if (!file) {
      setError('Selecione o arquivo Excel que será importado.');
      return;
    }
    if (mode === 'DAY' && !data) {
      setError('Informe a data que deve ser considerada em DATA PRODUZIDA.');
      return;
    }
    if (mode === 'MONTH' && !mes) {
      setError('Informe o mês que deve ser considerado em DATA PRODUZIDA.');
      return;
    }

    setProcessing(true);
    const loadingId = startLoadingProgress(
      mode === 'DAY' ? 'Analisando produção do Excel' : 'Analisando produção mensal',
      mode === 'DAY'
        ? 'Lendo a aba Apontamento Final e preparando a produção da data selecionada.'
        : 'Lendo a aba Apontamento Final e organizando todos os dias do mês selecionado.',
    );
    setProgressRows(0);
    setError(null);
    try {
      if (mode === 'DAY') {
        const result = await readProductionImportExcel(file, data, setProgressRows);
        setPreviews([result]);
      } else {
        const result = await readProductionImportExcelMonth(file, mes, setProgressRows);
        setPreviews(result.dias);
      }
      setCorrections({});
    } catch (readError) {
      setPreviews([]);
      setError(readError instanceof Error ? readError.message : 'Não foi possível analisar o Excel.');
    } finally {
      finishLoadingProgress(loadingId);
      setProcessing(false);
    }
  };

  const confirm = async () => {
    if (!previews.length) return;
    if (unresolved.length) {
      setError(`Corrija ${unresolved.length} grupo(s) com linha sem correspondência antes de importar.`);
      return;
    }
    const validDays = finalDays.filter((day) => day.grupos.length > 0);
    if (!validDays.length) {
      setError('Nenhum registro válido ficou disponível para importação.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === 'DAY') {
        await onImportDay(validDays[0].data, validDays[0].grupos, setorFiltro);
      } else {
        await onImportMonth(mes, validDays, setorFiltro);
      }
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar a produção importada.');
    } finally {
      setSaving(false);
    }
  };

  const busy = processing || saving;
  const periodLabel = mode === 'DAY'
    ? (data ? formatDateBR(data) : 'dia selecionado')
    : (mes ? mes.split('-').reverse().join('/') : 'mês selecionado');

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Importar produção do Excel"
      description="Importe um único dia ou todo o mês usando a aba Apontamento Final."
      size="xl"
      busy={busy}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-5 text-slate-500">
            {setorFiltro === 'ALL'
              ? 'A nova importação substitui a produção do período escolhido. Faltas, paradas, não conformidades, observações e demais informações dos apontadores permanecem salvas.'
              : `A nova importação substitui somente a produção de ${sectorLabel(setorFiltro)} no período escolhido. Os demais setores e as informações dos apontadores permanecem salvos.`}
          </p>
          <div className="grid w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:w-auto sm:flex sm:shrink-0">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
            {!previews.length ? (
              <Button
                onClick={() => void analyze()}
                isLoading={processing}
                loadingLabel="Analisando…"
                leftIcon={<FileSpreadsheet className="size-4" aria-hidden="true" />}
              >
                Analisar arquivo
              </Button>
            ) : (
              <Button
                onClick={() => void confirm()}
                isLoading={saving}
                loadingLabel="Importando…"
                disabled={unresolved.length > 0 || allGroups.length === 0}
                leftIcon={<FileUp className="size-4" aria-hidden="true" />}
              >
                Confirmar importação
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <span className="mb-2 block text-xs font-bold text-slate-300">Período da importação</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => { setMode('DAY'); invalidatePreview(); }}
              className={`min-h-11 rounded-xl border px-3 text-sm font-black transition-colors ${mode === 'DAY' ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'}`}
            >
              Importar 1 dia
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setMode('MONTH'); invalidatePreview(); }}
              className={`min-h-11 rounded-xl border px-3 text-sm font-black transition-colors ${mode === 'MONTH' ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'}`}
            >
              Importar mês inteiro
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-black/15 p-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              <FileSpreadsheet className="size-4 text-emerald-400" aria-hidden="true" />
              Arquivo Excel
            </span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                invalidatePreview();
              }}
              className="block min-h-11 min-w-0 w-full cursor-pointer rounded-xl border border-white/15 bg-[#070B08] px-3 py-2 text-sm font-semibold text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-400/10 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            />
            {file && <p className="mt-1.5 truncate text-xs text-slate-500">{file.name}</p>}
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              {mode === 'DAY' ? <CalendarDays className="size-4 text-emerald-400" aria-hidden="true" /> : <CalendarRange className="size-4 text-emerald-400" aria-hidden="true" />}
              {mode === 'DAY' ? 'Data a considerar' : 'Mês a considerar'}
            </span>
            {mode === 'DAY' ? (
              <input
                type="date"
                value={data}
                disabled={busy}
                onChange={(event) => { setData(event.target.value); invalidatePreview(); }}
                className="min-h-11 w-full rounded-xl border border-white/15 bg-[#070B08] px-3 py-2.5 text-sm font-bold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            ) : (
              <input
                type="month"
                value={mes}
                disabled={busy}
                onChange={(event) => { setMes(event.target.value); invalidatePreview(); }}
                className="min-h-11 w-full rounded-xl border border-white/15 bg-[#070B08] px-3 py-2.5 text-sm font-bold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            )}
            <p className="mt-1.5 text-xs text-slate-500">Filtro aplicado sobre a coluna DATA PRODUZIDA.</p>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-300">Setor</span>
            <CustomSelect
              value={setorFiltro}
              onChange={(value) => setSetorFiltro(value as ImportSectorFilter)}
              disabled={busy}
              ariaLabel="Setor da importação de produção"
              className="min-h-11 text-sm font-bold"
              options={IMPORT_SECTOR_OPTIONS}
            />
            <p className="mt-1.5 text-xs text-slate-500">Por padrão, todos os setores são importados.</p>
          </label>
        </section>

        {processing && (
          <section role="status" aria-live="polite" className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
            <p className="text-sm font-black text-emerald-200">Analisando a aba Apontamento Final…</p>
            <p className="mt-1 text-xs text-emerald-200/70">
              {progressRows > 0 ? `${progressRows.toLocaleString('pt-BR')} linhas processadas.` : 'Preparando a leitura do arquivo.'}
            </p>
          </section>
        )}

        {previews.length > 0 && (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Período</span><p className="mt-1 font-black text-white">{periodLabel}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Dias encontrados</span><p className="mt-1 font-black text-white">{previews.length}</p></div>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><span className="text-xs font-black uppercase tracking-wider text-emerald-300/70">Produzido</span><p className="mt-1 font-black text-emerald-200">{totalQuantidade.toLocaleString('pt-BR')} un.</p></div>
              <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3"><span className="text-xs font-black uppercase tracking-wider text-sky-300/70">Linhas do Excel</span><p className="mt-1 font-black text-sky-200">{rowsMatched.toLocaleString('pt-BR')}</p></div>
            </section>

            <section className="flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.05] p-3 text-xs leading-5 text-sky-100/80">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {setorFiltro === 'ALL'
                ? (mode === 'MONTH'
                  ? 'A importação mensal substitui a fotografia completa do mês. Produções antigas de dias que não estiverem no novo arquivo também serão retiradas, sem apagar ocorrências digitadas pelos apontadores.'
                  : 'A importação diária substitui integralmente a produção importada daquela data, sem acumular com a importação anterior.')
                : (mode === 'MONTH'
                  ? `A importação mensal substitui somente ${sectorLabel(setorFiltro)} no mês escolhido, inclusive removendo dias antigos desse setor que não estiverem no novo arquivo. Os demais setores não são alterados.`
                  : `A importação diária substitui somente ${sectorLabel(setorFiltro)} na data escolhida. Os demais setores não são alterados.`)}
            </section>

            {setorFiltro !== 'ALL' && allGroups.length === 0 && (
              <section className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs font-semibold leading-5 text-amber-100">
                Nenhum registro válido de {sectorLabel(setorFiltro)} foi encontrado no período selecionado. Escolha outro setor ou verifique o arquivo.
              </section>
            )}

            {(unresolved.length > 0 || sectorIssues.length > 0 || ignoredWithoutPower > 0) && (
              <section className="overflow-hidden rounded-2xl border border-amber-400/20" aria-labelledby="import-issues-title">
                <div className="flex items-center gap-2 border-b border-amber-400/15 bg-amber-400/[0.06] px-4 py-3">
                  <AlertTriangle className="size-4 text-amber-300" aria-hidden="true" />
                  <h3 id="import-issues-title" className="text-sm font-black text-amber-100">Itens que precisam de atenção</h3>
                </div>
                <div className="space-y-2 p-4">
                  {ignoredWithoutPower > 0 && <p className="text-xs font-semibold text-slate-400">{ignoredWithoutPower.toLocaleString('pt-BR')} linha(s) sem potência válida foram ignoradas.</p>}
                  {sectorIssues.map((issue) => (
                    <div key={issue.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                      <div className="flex flex-wrap items-center gap-2"><Badge variant="warning">Setor ignorado</Badge><span className="text-xs font-bold text-slate-300">{issue.setorOriginal} · {issue.linhaOriginal} · {formatPotencia(issue.potencia)} kVA · {issue.quantidade} un.</span></div>
                      <p className="mt-1 text-xs text-slate-500">{issue.message}</p>
                    </div>
                  ))}
                  {previews.flatMap((preview) => preview.issues.filter((issue) => issue.kind === 'LINHA')).map((issue) => (
                    <div key={issue.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 md:grid-cols-[1fr_220px] md:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><Badge variant="warning">Corrigir linha</Badge><span className="text-xs font-bold text-slate-300">{issue.setorOriginal} · {formatPotencia(issue.potencia)} kVA · {issue.quantidade} un.</span></div>
                        <p className="mt-1 text-xs text-slate-500">{issue.message}</p>
                      </div>
                      <CustomSelect
                        value={corrections[issue.id] || ''}
                        onChange={(value) => setCorrections((current) => ({ ...current, [issue.id]: (value || undefined) as Linha | undefined }))}
                        className="min-h-11 text-xs font-black"
                        ariaLabel={`Corrigir linha de ${issue.setorOriginal}, potência ${formatPotencia(issue.potencia)}`}
                        options={[{ value: '', label: 'Selecionar linha…' }, ...issue.allowedLines.map((line) => ({ value: line, label: line }))]}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-2xl border border-emerald-400/20" aria-labelledby="import-summary-title">
              <div className="flex flex-col items-stretch gap-2 border-b border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" /><h3 id="import-summary-title" className="text-sm font-black text-emerald-100">Resumo que será importado</h3></div>
                {previews.some((preview) => preview.issues.some((issue) => issue.kind === 'LINHA')) && <Button size="sm" variant="ghost" onClick={() => setCorrections({})} leftIcon={<RotateCcw className="size-3.5" aria-hidden="true" />}>Limpar correções</Button>}
              </div>
              {summary.length === 0 ? <p className="p-4 text-sm text-slate-500">Nenhum grupo válido para importar.</p> : (
                <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-sm font-black text-slate-100">{item.label}</p><p className="mt-1 text-xs text-slate-500">{item.groups} combinação(ões) de data/linha/potência/turno</p><p className="mt-2 text-lg font-black text-emerald-300">{item.quantidade.toLocaleString('pt-BR')} un.</p></div>)}
                </div>
              )}
            </section>
          </>
        )}

        <FieldError role="alert">{error}</FieldError>
      </div>
    </ModalShell>
  );
}
