import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Info,
  RotateCcw,
} from 'lucide-react';
import { Linha, ProductionImportGroup } from '../../types';
import { formatDateBR, formatPotencia } from '../../utils/formatters';
import {
  buildFinalImportGroups,
  getUnresolvedLineIssues,
  importUnitLabel,
  ProductionImportPreview,
  readProductionImportExcel,
} from '../../utils/importProductionExcel';
import { ModalShell } from '../common/ModalShell';
import { Badge, Button, FieldError } from '../common/ui';
import { CustomSelect } from '../common/CustomSelect';

interface ImportProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: string, groups: ProductionImportGroup[]) => Promise<void>;
}

export function ImportProductionModal({ isOpen, onClose, onImport }: ImportProductionModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState('');
  const [preview, setPreview] = useState<ProductionImportPreview | null>(null);
  const [corrections, setCorrections] = useState<Record<string, Linha | undefined>>({});
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progressRows, setProgressRows] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) return;
    setFile(null);
    setData('');
    setPreview(null);
    setCorrections({});
    setProcessing(false);
    setSaving(false);
    setProgressRows(0);
    setError(null);
  }, [isOpen]);

  const finalGroups = useMemo(
    () => preview ? buildFinalImportGroups(preview, corrections) : [],
    [corrections, preview],
  );
  const unresolved = useMemo(
    () => preview ? getUnresolvedLineIssues(preview, corrections) : [],
    [corrections, preview],
  );
  const sectorIssues = preview?.issues.filter((issue) => issue.kind === 'SETOR') || [];

  const summary = useMemo(() => {
    const map = new Map<string, { label: string; quantidade: number; groups: number }>();
    for (const group of finalGroups) {
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
  }, [finalGroups]);

  const totalQuantidade = finalGroups.reduce((sum, item) => sum + item.quantidade, 0);

  const invalidatePreview = () => {
    setPreview(null);
    setCorrections({});
    setError(null);
  };

  const analyze = async () => {
    if (!file) {
      setError('Selecione o arquivo Excel que será importado.');
      return;
    }
    if (!data) {
      setError('Informe a data que deve ser considerada em DATA PRODUZIDA.');
      return;
    }

    setProcessing(true);
    setProgressRows(0);
    setError(null);
    try {
      const result = await readProductionImportExcel(file, data, setProgressRows);
      setPreview(result);
      setCorrections({});
    } catch (readError) {
      setPreview(null);
      setError(readError instanceof Error ? readError.message : 'Não foi possível analisar o Excel.');
    } finally {
      setProcessing(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    if (unresolved.length) {
      setError(`Corrija ${unresolved.length} grupo(s) com linha sem correspondência antes de importar.`);
      return;
    }
    if (finalGroups.length === 0) {
      setError('Nenhum registro válido ficou disponível para importação.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onImport(preview.data, finalGroups);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar a produção importada.');
    } finally {
      setSaving(false);
    }
  };

  const busy = processing || saving;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Importar produção do Excel"
      description="O sistema lê somente a aba Apontamento Final e conta os registros por setor, linha e potência."
      size="xl"
      busy={busy}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            Uma nova importação da mesma data substitui a produção importada anteriormente, preservando faltas, observações e aprovação já existentes.
          </p>
          <div className="grid w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:w-auto sm:flex sm:shrink-0">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
            {!preview ? (
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
                disabled={unresolved.length > 0 || finalGroups.length === 0}
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
        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-black/15 p-4 md:grid-cols-2">
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
              <CalendarDays className="size-4 text-emerald-400" aria-hidden="true" />
              Data a considerar
            </span>
            <input
              type="date"
              value={data}
              disabled={busy}
              onChange={(event) => {
                setData(event.target.value);
                invalidatePreview();
              }}
              className="min-h-11 w-full rounded-xl border border-white/15 bg-[#070B08] px-3 py-2.5 text-sm font-bold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            />
            <p className="mt-1.5 text-xs text-slate-500">Filtro aplicado sobre a coluna DATA PRODUZIDA.</p>
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

        {preview && (
          <>
            <section className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4" aria-label="Resumo da leitura">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Data</p>
                <p className="mt-1 text-sm font-black text-slate-100">{formatDateBR(preview.data)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Linhas encontradas</p>
                <p className="mt-1 text-sm font-black text-slate-100">{preview.rowsMatched.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-300/70">Produção válida</p>
                <p className="mt-1 text-sm font-black text-emerald-200">{totalQuantidade.toLocaleString('pt-BR')} un.</p>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                <p className="text-xs font-black uppercase tracking-wider text-amber-300/70">A revisar</p>
                <p className="mt-1 text-sm font-black text-amber-200">{unresolved.length + sectorIssues.length}</p>
              </div>
            </section>

            {preview.ignoredWithoutPower > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-100/80">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {preview.ignoredWithoutPower} registro(s) da data selecionada foram ignorados por não possuir potência válida.
              </div>
            )}

            {preview.issues.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-amber-400/20" aria-labelledby="import-issues-title">
                <div className="border-b border-amber-400/15 bg-amber-400/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-amber-300" aria-hidden="true" />
                    <h3 id="import-issues-title" className="text-sm font-black text-amber-100">Corrigir inconsistências</h3>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-amber-100/60">
                    Linhas como BIF ou POT podem ser corrigidas para MON/TRI. Setores sem apontador correspondente permanecem ignorados.
                  </p>
                </div>
                <div className="max-h-80 divide-y divide-white/[0.07] overflow-y-auto">
                  {preview.issues.map((issue) => (
                    <div key={issue.id} className="grid grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[1fr_100px_120px_180px] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-100">{issue.setorOriginal}</span>
                          <Badge variant={issue.kind === 'LINHA' ? 'warning' : 'danger'}>{issue.linhaOriginal}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{issue.message}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-300">{formatPotencia(issue.potencia)} kVA</span>
                      <span className="text-xs font-bold text-slate-300">{issue.quantidade} un.</span>
                      {issue.kind === 'LINHA' ? (
                        <CustomSelect
                          value={corrections[issue.id] || ''}
                          onChange={(value) => setCorrections((current) => ({
                            ...current,
                            [issue.id]: (value || undefined) as Linha | undefined,
                          }))}
                          className="min-h-11 text-xs font-black"
                          ariaLabel={`Corrigir linha de ${issue.setorOriginal}, potência ${formatPotencia(issue.potencia)}`}
                          options={[
                            { value: '', label: 'Selecionar linha…' },
                            ...issue.allowedLines.map((line) => ({ value: line, label: line })),
                          ]}
                        />
                      ) : (
                        <span className="text-xs font-bold text-rose-300">Será ignorado</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-2xl border border-emerald-400/20" aria-labelledby="import-summary-title">
              <div className="flex flex-col items-stretch gap-2 border-b border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />
                  <h3 id="import-summary-title" className="text-sm font-black text-emerald-100">Resumo que será importado</h3>
                </div>
                {preview.issues.some((issue) => issue.kind === 'LINHA') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCorrections({})}
                    leftIcon={<RotateCcw className="size-3.5" aria-hidden="true" />}
                  >
                    Limpar correções
                  </Button>
                )}
              </div>
              {summary.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Nenhum grupo válido para importar.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                      <p className="text-sm font-black text-slate-100">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.groups} combinação(ões) de linha/potência</p>
                      <p className="mt-2 text-lg font-black text-emerald-300">{item.quantidade.toLocaleString('pt-BR')} un.</p>
                    </div>
                  ))}
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
