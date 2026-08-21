import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from './ui';

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  disabled?: boolean;
  active?: boolean;
  autoFocus?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  'aria-describedby'?: string;
  className?: string;
  menuClassName?: string;
  placeholder?: string;
}

export function CustomSelect({
  value,
  options,
  onChange,
  id,
  ariaLabel,
  ariaLabelledBy,
  disabled = false,
  active = false,
  autoFocus = false,
  ariaInvalid,
  ariaDescribedBy,
  'aria-invalid': ariaInvalidAttribute,
  'aria-describedby': ariaDescribedByAttribute,
  className,
  menuClassName,
  placeholder = 'Selecione',
}: CustomSelectProps) {
  const generatedId = useId();
  const buttonId = id || generatedId;
  const listboxId = `${buttonId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [placement, setPlacement] = useState<'up' | 'down'>('down');
  const [menuMaxHeight, setMenuMaxHeight] = useState(288);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const hasMeaningfulSelection = Boolean(selectedOption && selectedOption.value !== '');

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleViewportChange = () => resolvePlacement();
    window.addEventListener('resize', handleViewportChange);
    return () => window.removeEventListener('resize', handleViewportChange);
  }, [open, options.length]);

  const resolvePlacement = () => {
    const root = rootRef.current;
    const rect = root?.getBoundingClientRect();
    if (!root || !rect) return;

    let clippingAncestor: HTMLElement | null = root.parentElement;
    while (clippingAncestor && clippingAncestor !== document.body) {
      const styles = window.getComputedStyle(clippingAncestor);
      if (/(auto|scroll|hidden|clip)/.test(`${styles.overflowY} ${styles.overflow}`)) break;
      clippingAncestor = clippingAncestor.parentElement;
    }
    const fallbackScroll = root.closest<HTMLElement>('[data-modal-scroll="true"]');
    const clippingBounds = (clippingAncestor && clippingAncestor !== document.body ? clippingAncestor : fallbackScroll)?.getBoundingClientRect();
    const topBoundary = Math.max(8, clippingBounds?.top ?? 8);
    const bottomBoundary = Math.min(window.innerHeight - 8, clippingBounds?.bottom ?? window.innerHeight - 8);
    const spaceBelow = Math.max(0, bottomBoundary - rect.bottom - 8);
    const spaceAbove = Math.max(0, rect.top - topBoundary - 8);
    const estimatedMenuHeight = Math.min(288, Math.max(52, options.length * 46 + 12));
    const openUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;

    setPlacement(openUp ? 'up' : 'down');
    setMenuMaxHeight(Math.max(72, Math.min(288, available || 72)));
  };

  const getNextEnabledIndex = (start: number, direction: 1 | -1) => {
    if (options.length === 0) return -1;
    let candidate = start;
    for (let attempt = 0; attempt < options.length; attempt += 1) {
      candidate = (candidate + direction + options.length) % options.length;
      if (!options[candidate]?.disabled) return candidate;
    }
    return -1;
  };

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    const initial = selectedIndex >= 0 && !options[selectedIndex]?.disabled
      ? selectedIndex
      : getNextEnabledIndex(-1, 1);
    setHighlightedIndex(initial >= 0 ? initial : 0);
    resolvePlacement();
    setOpen(true);
  };

  const choose = (option: CustomSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction: 1 | -1 = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        openMenu();
        return;
      }
      const next = getNextEnabledIndex(highlightedIndex, direction);
      if (next >= 0) setHighlightedIndex(next);
      return;
    }

    if (event.key === 'Home' && open) {
      event.preventDefault();
      const first = options.findIndex((option) => !option.disabled);
      if (first >= 0) setHighlightedIndex(first);
      return;
    }

    if (event.key === 'End' && open) {
      event.preventDefault();
      for (let index = options.length - 1; index >= 0; index -= 1) {
        if (!options[index].disabled) {
          setHighlightedIndex(index);
          break;
        }
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const option = options[highlightedIndex];
      if (option) choose(option);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${highlightedIndex}` : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={ariaInvalid ?? ariaInvalidAttribute}
        aria-describedby={ariaDescribedBy || ariaDescribedByAttribute}
        data-active={active || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={handleKeyDown}
        className={cx('field-control flex cursor-pointer items-center justify-between gap-3 text-left', className)}
      >
        <span className={cx('truncate', hasMeaningfulSelection ? 'text-slate-100' : 'text-slate-500')}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={cx('size-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          style={{ maxHeight: `${menuMaxHeight}px` }}
          className={cx(
            'absolute z-[70] w-full overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] p-1.5 shadow-[var(--shadow-overlay)] ring-1 ring-black/30',
            placement === 'up' ? 'bottom-full mb-2' : 'mt-2',
            menuClassName,
          )}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <button
                key={`${option.value}-${index}`}
                id={`${listboxId}-option-${index}`}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                onClick={() => choose(option)}
                className={cx(
                  'flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  isSelected
                    ? 'bg-emerald-400/12 text-emerald-100'
                    : isHighlighted
                      ? 'bg-white/[0.07] text-white'
                      : 'text-slate-200 hover:bg-white/[0.06]',
                  option.disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{option.label}</span>
                  {option.description && (
                    <span className="mt-0.5 block truncate text-xs font-medium text-[var(--text-tertiary)]">
                      {option.description}
                    </span>
                  )}
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
