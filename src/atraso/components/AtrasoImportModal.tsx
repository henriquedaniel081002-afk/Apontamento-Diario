import { useRef, useState } from 'react';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import { ModalShell } from '../../components/common/ModalShell';
import { Button } from '../../components/common/ui';
import { atrasoService } from '../services/atrasoService';
import type { AtrasoImportPreview } from '../types';
import { parseAtrasoWorkbook } from '../utils/importAtrasoExcel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'danger' | 'success' }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-400/20 bg-rose-400/[0.08] text-rose-200'
    : tone === 'success'
      ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200'
      : 'border-white/[0.08] bg-white/[0.035] text-slate-200';
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] opacity-70">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums">{value.toLocaleString('pt-BR')}</div>
    </div>
  );
}

export function AtrasoImportModal({ isOpen, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<AtrasoImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setPreview(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (parsing || importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setError('');
    setPreview(null);
    try {
      setPreview(await parseAtrasoWorkbook(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o Excel.');
    } finally {
      setParsing(false);
    }
  };

  const importData = async () => {
    if (!preview) return;
    setImporting(true);
    setError('');
    try {
      await atrasoService.replaceAll(preview.payload);
      await onImported();
      reset();
      onClose();
    } catch (e: any) {
      const message = e?.message || 'Falha ao importar a base de atrasos.';
      if (/row-level security|permission denied|not authorized|401|403/i.test(message)) {
        setError('O Supabase bloqueou a gravação na tabela controle_atrasos. Verifique as permissões/RLS da tabela para a conexão já usada pelo sistema.');
      } else {
        setError(message);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={close}
      busy={parsing || importing}
      size="lg"
      title="Configurações · Importar base de atrasos"
      description="O importador utiliza somente ATRASO e ADIANTAMENTO e grava apenas as oito colunas definidas para o dashboard."
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={parsing || importing}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={importData}
            disabled={!preview || parsing}
            isLoading={importing}
            loadingLabel="Importando..."
            leftIcon={<UploadCloud className="size-4" aria-hidden="true" />}
          >
            Confirmar importação
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <label className="block cursor-pointer rounded-2xl border border-dashed border-emerald-400/25 bg-emerald-400/[0.045] p-5 text-center transition hover:border-emerald-400/45 hover:bg-emerald-400/[0.07]">
          <FileSpreadsheet className="mx-auto size-8 text-emerald-300" aria-hidden="true" />
          <div className="mt-3 text-sm font-extrabold text-white">Selecionar BASE ATRASO.xlsx</div>
          <div className="mt-1 text-xs text-slate-400">Aceita .xlsx, .xlsm e .xls. A leitura é validada antes de substituir a base atual.</div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="sr-only"
            disabled={parsing || importing}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>

        {parsing && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm text-slate-300">
            Lendo e validando o Excel...
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] p-4 text-sm leading-6 text-rose-100">
            {error}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-black/15 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-100">{preview.fileName}</div>
                <div className="mt-0.5 text-xs text-slate-500">O arquivo foi validado e está pronto para importação.</div>
              </div>
              <button type="button" onClick={reset} className="text-xs font-bold text-slate-400 hover:text-white">Trocar arquivo</button>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Stat label="Linhas do Excel" value={preview.totalSourceRows} />
              <Stat label="Atrasos" value={preview.atrasoRows} tone="danger" />
              <Stat label="Adiantamentos" value={preview.adiantamentoRows} tone="success" />
              <Stat label="Ignorados" value={preview.ignoredRows} />
            </div>

            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3 text-xs leading-5 text-amber-100">
              Ao confirmar, os registros atuais de ATRASO e ADIANTAMENTO em <strong>controle_atrasos</strong> serão substituídos pelos {preview.payload.length.toLocaleString('pt-BR')} registros válidos deste arquivo. As demais tabelas do sistema não são alteradas.
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
