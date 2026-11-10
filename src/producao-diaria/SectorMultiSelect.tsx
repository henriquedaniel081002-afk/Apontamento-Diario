import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type Props = {
  id?: string;
  options: string[];
  selected: string[] | null;
  onChange: (selected: string[] | null) => void;
};

/** Multi-seleção local, sem alterar o CustomSelect compartilhado. null = todos os setores. */
export function SectorMultiSelect({ id, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = selected === null ? options : selected.filter((value) => options.includes(value));
  const allSelected = selected === null || active.length === options.length;

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const toggle = (setor: string) => {
    const next = active.includes(setor) ? active.filter((item) => item !== setor) : [...active, setor];
    onChange(next.length === options.length ? null : next);
  };

  return (
    <div className="daily-sector-select" ref={rootRef}>
      <button
        className="field-control daily-sector-select__trigger"
        id={id}
        type="button"
        aria-label="Setores"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>{allSelected ? 'Todos os setores' : `${active.length} setor(es) selecionado(s)`}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div className="daily-sector-select__menu" role="group" aria-label="Selecionar setores">
          <div className="daily-sector-select__actions">
            <button type="button" onClick={() => onChange(null)}>Todos</button>
            <button type="button" onClick={() => onChange([])}>Limpar</button>
          </div>
          <div className="daily-sector-select__items">
            {options.map((setor) => (
              <label key={setor} className="daily-sector-select__option">
                <input
                  type="checkbox"
                  aria-label={setor}
                  checked={active.includes(setor)}
                  onChange={() => toggle(setor)}
                />
                <span>{setor}</span>
                {active.includes(setor) && <Check className="size-4" aria-hidden="true" />}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
