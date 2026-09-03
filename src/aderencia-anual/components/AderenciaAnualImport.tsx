import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button, FieldError } from '../../components/common/ui';
import { ModalShell } from '../../components/common/ModalShell';
import type { AderenciaAnualImportPreview, AderenciaAnualUpsertRow } from '../types';
import { parseAderenciaAnualWorkbook } from '../utils/parseAderenciaAnualExcel';

interface AderenciaAnualImportProps {
  onImport: (rows: AderenciaAnualUpsertRow[]) => Promise<void>;
}

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function formatMonth(value: string): string {
  return monthFormatter.format(new Date(`${value}T12:00:00Z`)).replace('.', '');
}

export function AderenciaAnualImport({ onImport }: AderenciaAnualImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<AderenciaAnualImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setFileName('');
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (isParsing || isSaving) return;
    setIsOpen(false);
    reset();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPreview(null);
    setError(null);
    setIsOpen(true);
    setIsParsing(true);

    try {
      setPreview(await parseAderenciaAnualWorkbook(file));
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Não foi possível validar o arquivo.');
    } finally {
      setIsParsing(false);
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setError(null);
    setIsSaving(true);
    try {
      await onImport(preview.payload);
      setIsOpen(false);
      reset();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Não foi possível concluir a importação.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        className="sr-only"
        onChange={handleFile}
        aria-label="Selecionar Excel de Aderência Anual"
      />
      <Button
        leftIcon={<Upload className="size-4" aria-hidden="true" />}
        onClick={() => inputRef.current?.click()}
        isLoading={isParsing}
        loadingLabel="Lendo Excel..."
      >
        Importar Excel
      </Button>

      <ModalShell
        isOpen={isOpen}
        onClose={close}
        title="Importar Aderência Anual"
        description={fileName || 'Valide os dados antes de gravar no Supabase.'}
        busy={isParsing || isSaving}
        size="md"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close} disabled={isParsing || isSaving}>Cancelar</Button>
            <Button
              onClick={confirmImport}
              disabled={!preview || isParsing}
              isLoading={isSaving}
              loadingLabel="Importando..."
            >
              Confirmar importação
            </Button>
          </div>
        )}
      >
        {isParsing ? (
          <div role="status" className="flex min-h-40 flex-col items-center justify-center text-center">
            <FileSpreadsheet className="size-10 text-emerald-300" aria-hidden="true" />
            <p className="mt-4 font-extrabold text-white">Validando a planilha</p>
            <p className="mt-1 text-sm text-slate-400">Localizando a aba e conferindo cada linha.</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4">
            <p className="font-extrabold text-rose-200">Importação não concluída</p>
            <FieldError role="alert">{error}</FieldError>
          </div>
        ) : preview ? (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Registros</span>
                <strong className="mt-2 block text-2xl font-black text-white">{preview.payload.length}</strong>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Anos</span>
                <strong className="mt-2 block text-lg font-black text-white">{preview.years.join(', ')}</strong>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Período</span>
                <strong className="mt-2 block text-sm font-black capitalize text-white">
                  {formatMonth(preview.firstMonth)} — {formatMonth(preview.lastMonth)}
                </strong>
              </div>
            </div>
            <p className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm leading-6 text-slate-300">
              Meses já existentes serão atualizados pelo campo <strong className="text-emerald-200">mes</strong>.
              Os demais serão inseridos. Nenhuma outra tabela será alterada.
            </p>
          </div>
        ) : null}
      </ModalShell>
    </>
  );
}
