import { Download, FileSpreadsheet, FileUp, Settings2, Trash2 } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';
import { Button } from '../common/ui';

interface CoordinationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportProduction: () => void;
  onImportProgramacao: () => void;
  onExport: () => void;
  onDeleteApontamentos: () => void;
  exporting?: boolean;
  disabled?: boolean;
}

export function CoordinationSettingsModal({
  isOpen,
  onClose,
  onImportProduction,
  onImportProgramacao,
  onExport,
  onDeleteApontamentos,
  exporting = false,
  disabled = false,
}: CoordinationSettingsModalProps) {
  const choose = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Configurações"
      description="Central de importação e exportação da Coordenação."
      size="sm"
      busy={exporting}
      footer={<Button variant="secondary" onClick={onClose} disabled={exporting}>Fechar</Button>}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
            <Settings2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-black text-slate-100">Operações do sistema</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">As reimportações substituem os dados anteriores do período correspondente, sem duplicação.</p>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled || exporting}
          onClick={() => choose(onImportProduction)}
          className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left transition-colors hover:border-emerald-400/25 hover:bg-emerald-400/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><FileUp className="size-5" aria-hidden="true" /></span>
          <span><strong className="block text-sm text-slate-100">Importar produção</strong><small className="mt-1 block text-xs text-slate-500">Um dia ou mês inteiro</small></span>
        </button>

        <button
          type="button"
          disabled={disabled || exporting}
          onClick={() => choose(onImportProgramacao)}
          className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left transition-colors hover:border-emerald-400/25 hover:bg-emerald-400/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><FileSpreadsheet className="size-5" aria-hidden="true" /></span>
          <span><strong className="block text-sm text-slate-100">Importar programação</strong><small className="mt-1 block text-xs text-slate-500">Substitui a programação anterior do mês</small></span>
        </button>

        <button
          type="button"
          disabled={disabled || exporting}
          onClick={() => choose(onDeleteApontamentos)}
          className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-red-400/15 bg-red-400/[0.035] p-3 text-left transition-colors hover:border-red-400/30 hover:bg-red-400/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-400/10 text-red-300"><Trash2 className="size-5" aria-hidden="true" /></span>
          <span><strong className="block text-sm text-slate-100">Excluir apontamentos</strong><small className="mt-1 block text-xs text-slate-500">Por dia, mês ou setor</small></span>
        </button>

        <button
          type="button"
          disabled={disabled || exporting}
          onClick={() => choose(onExport)}
          className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left transition-colors hover:border-emerald-400/25 hover:bg-emerald-400/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-300"><Download className="size-5" aria-hidden="true" /></span>
          <span><strong className="block text-sm text-slate-100">Exportar Excel</strong><small className="mt-1 block text-xs text-slate-500">Exporta o recorte atual da Coordenação</small></span>
        </button>
      </div>
    </ModalShell>
  );
}
