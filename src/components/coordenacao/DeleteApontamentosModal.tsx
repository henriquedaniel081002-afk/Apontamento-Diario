import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarRange, Trash2 } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';
import { Button, FieldError } from '../common/ui';
import { CustomSelect } from '../common/CustomSelect';

export type BulkDeleteMode = 'DAY' | 'MONTH' | 'SECTOR';

export interface BulkDeletePayload {
  data?: string;
  mesReferencia?: string;
  setor?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  setores: string[];
  onDelete: (payload: BulkDeletePayload) => Promise<number>;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function DeleteApontamentosModal({ isOpen, onClose, setores, onDelete }: Props) {
  const [mode, setMode] = useState<BulkDeleteMode>('DAY');
  const [data, setData] = useState('');
  const [mes, setMes] = useState(currentMonth);
  const [setor, setSetor] = useState('ALL');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) return;
    setMode('DAY');
    setData('');
    setMes(currentMonth());
    setSetor('ALL');
    setConfirming(false);
    setDeleting(false);
    setError(null);
  }, [isOpen]);

  const payload = useMemo<BulkDeletePayload>(() => {
    if (mode === 'DAY') return { data, setor: setor === 'ALL' ? undefined : setor };
    if (mode === 'MONTH') return { mesReferencia: mes, setor: setor === 'ALL' ? undefined : setor };
    return { setor: setor === 'ALL' ? undefined : setor };
  }, [data, mes, mode, setor]);

  const description = useMemo(() => {
    const sectorText = setor === 'ALL' ? 'todos os setores' : setor;
    if (mode === 'DAY') return data ? `todos os apontamentos de ${data.split('-').reverse().join('/')} em ${sectorText}` : 'os apontamentos do dia selecionado';
    if (mode === 'MONTH') return mes ? `todos os apontamentos de ${mes.split('-').reverse().join('/')} em ${sectorText}` : 'os apontamentos do mês selecionado';
    return setor === 'ALL' ? 'os apontamentos do setor selecionado' : `TODOS os apontamentos do setor ${setor}, em qualquer data`;
  }, [data, mes, mode, setor]);

  const validate = () => {
    if (mode === 'DAY' && !data) return 'Selecione o dia que será excluído.';
    if (mode === 'MONTH' && !mes) return 'Selecione o mês que será excluído.';
    if (mode === 'SECTOR' && setor === 'ALL') return 'Selecione um setor específico para excluir por setor.';
    return null;
  };

  const requestConfirmation = () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const executeDelete = async () => {
    if (deleting) return;
    const validation = validate();
    if (validation) {
      setError(validation);
      setConfirming(false);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await onDelete(payload);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Falha ao excluir os apontamentos.');
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Excluir apontamentos"
      description="Exclusão em massa por dia, mês ou setor. Esta operação não altera programação, usuários ou configurações."
      size="sm"
      busy={deleting}
      footer={confirming ? (
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>Voltar</Button>
          <Button variant="danger" onClick={() => void executeDelete()} isLoading={deleting} loadingLabel="Excluindo…" leftIcon={<Trash2 className="size-4" />}>Confirmar exclusão</Button>
        </div>
      ) : (
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={requestConfirmation} leftIcon={<Trash2 className="size-4" />}>Continuar</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-300" />
            <p className="text-xs leading-5 text-red-100/80">A exclusão remove o apontamento e seus dados vinculados de produção, faltas, paradas, não conformidades e observações. Não é possível desfazer pelo sistema.</p>
          </div>
        </div>

        {!confirming ? (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-300">Excluir por</span>
              <CustomSelect
                value={mode}
                onChange={(value) => { setMode(value as BulkDeleteMode); setError(null); }}
                ariaLabel="Tipo de exclusão de apontamentos"
                options={[
                  { value: 'DAY', label: 'Dia' },
                  { value: 'MONTH', label: 'Mês' },
                  { value: 'SECTOR', label: 'Setor (todas as datas)' },
                ]}
              />
            </label>

            {mode === 'DAY' && (
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300"><CalendarDays className="size-4 text-emerald-400" />Dia</span>
                <input type="date" value={data} onChange={(event) => { setData(event.target.value); setError(null); }} className="min-h-11 w-full rounded-xl border border-white/15 bg-[#070B08] px-3 py-2.5 text-sm font-bold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" />
              </label>
            )}

            {mode === 'MONTH' && (
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300"><CalendarRange className="size-4 text-emerald-400" />Mês</span>
                <input type="month" value={mes} onChange={(event) => { setMes(event.target.value); setError(null); }} className="min-h-11 w-full rounded-xl border border-white/15 bg-[#070B08] px-3 py-2.5 text-sm font-bold text-slate-100 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-300">Setor</span>
              <CustomSelect
                value={setor}
                onChange={(value) => { setSetor(value); setError(null); }}
                ariaLabel="Setor para exclusão"
                options={[
                  ...(mode === 'SECTOR' ? [] : [{ value: 'ALL', label: 'Todos os setores' }]),
                  ...setores.map((item) => ({ value: item, label: item })),
                ]}
              />
              <p className="mt-1.5 text-xs text-slate-500">{mode === 'SECTOR' ? 'Neste modo, o setor será apagado em todas as datas existentes.' : 'Você pode limitar a exclusão do período a um único setor.'}</p>
            </label>
          </>
        ) : (
          <div className="rounded-xl border border-red-400/25 bg-red-400/[0.08] p-4">
            <p className="text-xs font-black uppercase tracking-wider text-red-300">Confirmação final</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-100">Você está prestes a excluir <strong className="text-red-200">{description}</strong>.</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Somente os apontamentos que correspondem a esse recorte serão removidos.</p>
          </div>
        )}

        <FieldError role="alert">{error}</FieldError>
      </div>
    </ModalShell>
  );
}
