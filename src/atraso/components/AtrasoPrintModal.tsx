import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { ModalShell } from '../../components/common/ModalShell';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Button, Field } from '../../components/common/ui';
import type { AtrasoRecord } from '../types';
import { printAtrasos } from '../utils/printAtrasos';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  records: AtrasoRecord[];
}

export function AtrasoPrintModal({ isOpen, onClose, records }: Props) {
  const [setor, setSetor] = useState('ALL');
  const [linha, setLinha] = useState('ALL');
  const [error, setError] = useState('');

  const atrasos = useMemo(() => records.filter((row) => row.status === 'ATRASO'), [records]);
  const setores = useMemo(() => [...new Set(atrasos.map((row) => row.setor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [atrasos]);
  const linhas = useMemo(() => [...new Set(atrasos.map((row) => row.linha).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [atrasos]);

  const filtered = useMemo(() => atrasos
    .filter((row) => (setor === 'ALL' || row.setor === setor) && (linha === 'ALL' || row.linha === linha))
    .sort((a, b) => a.data_programada.localeCompare(b.data_programada) || a.serie - b.serie), [atrasos, linha, setor]);

  const close = () => {
    setError('');
    onClose();
  };

  const print = () => {
    setError('');
    if (!filtered.length) {
      setError('Nenhum atraso encontrado para o setor e a linha selecionados.');
      return;
    }
    try {
      printAtrasos(
        filtered,
        setor === 'ALL' ? 'Todos os setores' : setor,
        linha === 'ALL' ? 'Todas as linhas' : linha,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível abrir a impressão.');
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={close}
      size="md"
      title="Imprimir Atraso"
      description="Escolha o setor e a linha. O relatório sempre considera somente registros com status ATRASO."
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">{filtered.length.toLocaleString('pt-BR')} registro(s) no relatório</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <Button variant="danger" onClick={print} leftIcon={<Printer className="size-4" aria-hidden="true" />}>Imprimir / Salvar PDF</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Setor">
            <CustomSelect
              value={setor}
              onChange={setSetor}
              options={[{ value: 'ALL', label: 'Todos os setores' }, ...setores.map((value) => ({ value, label: value }))]}
            />
          </Field>
          <Field label="Linha">
            <CustomSelect
              value={linha}
              onChange={setLinha}
              options={[{ value: 'ALL', label: 'Todas as linhas' }, ...linhas.map((value) => ({ value, label: value }))]}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/15 p-3 text-xs leading-5 text-slate-400">
          A tabela será gerada como <strong className="text-slate-200">SÉRIE | DATA PROG. | CLIENTE | OP | LINHA | POTÊNCIA | SETOR</strong>, ordenada primeiro pela menor Data Prog. e, em caso de empate, pela menor Série. A janela de impressão do navegador permite salvar diretamente como PDF.
        </div>

        {error && <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] p-3 text-sm text-rose-100">{error}</div>}
      </div>
    </ModalShell>
  );
}
