import React from 'react';
import { AlertTriangle, Check, LoaderCircle } from 'lucide-react';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-[#00c76f] bg-[#00c76f] text-[#03150d] shadow-[0_10px_30px_rgba(0,199,111,0.16)] hover:border-[#1cdb85] hover:bg-[#1cdb85] active:bg-[#00a85e]',
  secondary:
    'border-white/12 bg-white/[0.06] text-slate-100 hover:border-white/20 hover:bg-white/[0.10] active:bg-white/[0.14]',
  ghost:
    'border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-white active:bg-white/[0.10]',
  danger:
    'border-rose-500 bg-rose-600 text-white shadow-[0_8px_24px_rgba(225,29,72,0.12)] hover:border-rose-400 hover:bg-rose-500 active:bg-rose-700',
  warning:
    'border-amber-400 bg-amber-400 text-amber-950 shadow-[0_8px_24px_rgba(251,191,36,0.12)] hover:border-amber-300 hover:bg-amber-300 active:bg-amber-500',
  success:
    'border-emerald-400/40 bg-emerald-400/12 text-emerald-200 shadow-[0_8px_24px_rgba(52,211,153,0.08)] hover:border-emerald-300/60 hover:bg-emerald-400/18 hover:text-emerald-100 active:bg-emerald-400/24',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 gap-2 rounded-lg px-3 text-xs',
  md: 'min-h-11 gap-2 rounded-xl px-4 text-sm',
  lg: 'min-h-12 gap-2.5 rounded-xl px-5 text-sm',
  icon: 'size-11 shrink-0 rounded-xl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingLabel,
      fullWidth = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cx(
        'inline-flex items-center justify-center border font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b08] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {loadingLabel || children}
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  ),
);

Button.displayName = 'Button';

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Raiz visual compartilhada pelas telas autenticadas. O background permanece no
 * body; este componente organiza apenas a altura e o fluxo do produto.
 */
export const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cx('app-shell min-h-dvh min-w-0', className)} {...props} />
  ),
);

AppShell.displayName = 'AppShell';

export type PageContainerElement = 'div' | 'main' | 'section';
export type PageContainerSize = 'default' | 'narrow' | 'wide' | 'full';

export interface PageContainerProps extends React.HTMLAttributes<HTMLElement> {
  as?: PageContainerElement;
  size?: PageContainerSize;
}

const pageContainerSizes: Record<PageContainerSize, string> = {
  default: 'app-container--default',
  narrow: 'app-container--narrow',
  wide: 'app-container--wide',
  full: 'app-container--full',
};

export const PageContainer = React.forwardRef<HTMLElement, PageContainerProps>(
  ({ as: Component = 'div', size = 'default', className, ...props }, ref) => (
    <Component
      ref={ref as React.Ref<never>}
      className={cx('app-container', pageContainerSizes[size], className)}
      {...props}
    />
  ),
);

PageContainer.displayName = 'PageContainer';

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  metadata?: React.ReactNode;
  icon?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  metadata,
  icon,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cx(
        'flex min-w-0 flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pb-6',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        {icon && (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 sm:size-12">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-300">
              {eyebrow}
            </p>
          )}
          <h1 className="text-[clamp(1.5rem,2.2vw,2.25rem)] font-black leading-[1.12] tracking-[-0.025em] text-white">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
              {description}
            </p>
          )}
          {metadata && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">{metadata}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}

export type SurfaceTone = 'base' | 'muted' | 'raised' | 'inset';
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside';
  tone?: SurfaceTone;
  padding?: SurfacePadding;
}

const surfaceTones: Record<SurfaceTone, string> = {
  base: 'border-[rgba(196,255,222,0.10)] bg-[linear-gradient(180deg,rgba(12,19,15,.98),rgba(7,12,9,.98))] shadow-[inset_0_1px_rgba(255,255,255,.02)]',
  muted: 'border-[rgba(196,255,222,0.08)] bg-[linear-gradient(180deg,rgba(9,15,12,.96),rgba(5,9,7,.96))]',
  raised: 'border-[rgba(0,199,111,.16)] bg-[linear-gradient(145deg,rgba(14,23,18,.99),rgba(7,12,9,.99))] shadow-[0_24px_70px_rgba(0,0,0,.28)]',
  inset: 'border-white/[0.08] bg-black/20',
};

const surfacePaddings: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6 lg:p-7',
};

export const Surface = React.forwardRef<HTMLElement, SurfaceProps>(
  ({ as: Component = 'div', tone = 'base', padding = 'none', className, ...props }, ref) => (
    <Component
      ref={ref as React.Ref<never>}
      className={cx('rounded-[1.15rem] border', surfaceTones[tone], surfacePaddings[padding], className)}
      {...props}
    />
  ),
);

Surface.displayName = 'Surface';

export const Card = React.forwardRef<HTMLElement, SurfaceProps>(
  ({ padding = 'md', ...props }, ref) => <Surface ref={ref} padding={padding} {...props} />,
);

Card.displayName = 'Card';

export interface SectionCardProps extends Omit<SurfaceProps, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  headerClassName?: string;
  contentClassName?: string;
}

export const SectionCard = React.forwardRef<HTMLElement, SectionCardProps>(
  (
    {
      title,
      description,
      icon,
      actions,
      headerClassName,
      contentClassName,
      children,
      padding = 'md',
      ...props
    },
    ref,
  ) => {
    const hasHeader = Boolean(title || description || icon || actions);

    return (
      <Surface ref={ref} padding={hasHeader ? 'none' : padding} {...props}>
        {hasHeader && (
          <div
            className={cx(
              'flex min-w-0 flex-col gap-3 border-b border-white/[0.08] px-4 py-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-5',
              headerClassName,
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              {icon && (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-emerald-300">
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                {title && <h2 className="text-base font-extrabold tracking-tight text-white sm:text-lg">{title}</h2>}
                {description && <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>}
              </div>
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
        )}
        {hasHeader ? <div className={cx('p-4 sm:p-5', contentClassName)}>{children}</div> : children}
      </Surface>
    );
  },
);

SectionCard.displayName = 'SectionCard';

export type MetricCardTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface MetricCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: React.ReactNode;
  tone?: MetricCardTone;
  featured?: boolean;
}

const metricToneClasses: Record<MetricCardTone, string> = {
  neutral: 'border-white/10 text-slate-300',
  primary: 'border-emerald-400/25 text-emerald-300',
  success: 'border-emerald-400/25 text-emerald-300',
  warning: 'border-amber-400/25 text-amber-300',
  danger: 'border-rose-400/25 text-rose-300',
  info: 'border-sky-400/25 text-sky-300',
};

export const MetricCard = React.forwardRef<HTMLElement, MetricCardProps>(
  ({ label, value, description, icon, trend, tone = 'neutral', featured = false, className, ...props }, ref) => (
    <Surface
      ref={ref}
      as="article"
      tone={featured ? 'raised' : 'base'}
      padding="md"
      className={cx(
        'kpi-industrial flex min-w-0 flex-col justify-between gap-4',
        featured && 'min-h-40 sm:min-h-44',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-400">{label}</p>
        {icon && (
          <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-xl border bg-black/20', metricToneClasses[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-end gap-x-3 gap-y-1">
          <p
            className={cx(
              'break-words font-black leading-none tracking-[-0.035em] text-white',
              featured ? 'text-[clamp(2rem,4vw,3.25rem)]' : 'text-[clamp(1.65rem,3vw,2.35rem)]',
            )}
          >
            {value}
          </p>
          {trend && <div className="pb-0.5 text-xs font-bold">{trend}</div>}
        </div>
        {description && <p className="mt-2 text-sm leading-5 text-slate-400">{description}</p>}
      </div>
    </Surface>
  ),
);

MetricCard.displayName = 'MetricCard';

export interface FilterPanelProps extends Omit<SurfaceProps, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  contentClassName?: string;
}

export const FilterPanel = React.forwardRef<HTMLElement, FilterPanelProps>(
  ({ title = 'Filtros', description, actions, contentClassName, children, className, ...props }, ref) => (
    <Surface ref={ref} as="section" padding="none" className={cx('filter-panel overflow-visible', className)} {...props}>
      <div className="flex min-w-0 flex-col gap-3 border-b border-white/[0.08] px-4 py-3.5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-[0.12em] text-slate-200">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div
        className={cx(
          'grid min-w-0 gap-4 p-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr))] sm:p-5',
          contentClassName,
        )}
      >
        {children}
      </div>
    </Surface>
  ),
);

FilterPanel.displayName = 'FilterPanel';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: 'border-white/10 bg-white/[0.06] text-slate-300',
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  danger: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  info: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'neutral', className, ...props }, ref) => (
    <span
      ref={ref}
      className={cx(
        'inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold leading-5',
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  ),
);

Badge.displayName = 'Badge';

export interface StatusBadgeProps extends BadgeProps {
  dot?: boolean;
}

const badgeDotVariants: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
  info: 'bg-sky-400',
};

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ dot = false, variant = 'neutral', children, ...props }, ref) => (
    <Badge ref={ref} variant={variant} {...props}>
      {dot && <span className={cx('size-1.5 shrink-0 rounded-full', badgeDotVariants[variant])} aria-hidden="true" />}
      {children}
    </Badge>
  ),
);

StatusBadge.displayName = 'StatusBadge';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.025] px-5 py-10 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-100">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx('ui-shimmer min-h-4 rounded-lg bg-white/[0.07]', className)}
      {...props}
    />
  );
}

export interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function FieldError({ className, children, ...props }: FieldErrorProps) {
  if (!children) return null;

  return (
    <p className={cx('mt-1.5 text-sm font-medium text-rose-300', className)} {...props}>
      {children}
    </p>
  );
}

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  optionalLabel?: React.ReactNode;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  optionalLabel,
  children,
  className,
  ...props
}: FieldProps) {
  const generatedId = React.useId();
  const controlId = htmlFor || `field-${generatedId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  let control = children;

  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<{
      id?: string;
      'aria-describedby'?: string;
      'aria-invalid'?: boolean | 'false' | 'true';
    }>;
    const existingDescription = element.props['aria-describedby'];
    control = React.cloneElement(element, {
      id: element.props.id || controlId,
      'aria-describedby': [existingDescription, describedBy].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? true : element.props['aria-invalid'],
    });
  }

  return (
    <div className={cx('min-w-0', className)} {...props}>
      <label className="field-label" htmlFor={controlId}>
        <span>{label}</span>
        {required && <span className="ml-1 text-rose-300" aria-hidden="true">*</span>}
        {!required && optionalLabel && <span className="ml-1.5 font-medium text-slate-500">{optionalLabel}</span>}
      </label>
      {control}
      {hint && <p id={hintId} className="field-hint">{hint}</p>}
      {error && <FieldError id={errorId} role="alert">{error}</FieldError>}
    </div>
  );
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => <input ref={ref} className={cx('field-control', className)} {...props} />,
);

Input.displayName = 'Input';

export type DateInputProps = Omit<InputProps, 'type'>;

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, ...props }, ref) => (
    <Input ref={ref} type="date" className={cx('[color-scheme:dark]', className)} {...props} />
  ),
);

DateInput.displayName = 'DateInput';

export type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cx('field-control appearance-auto', className)} {...props}>
      {children}
    </select>
  ),
);

SelectField.displayName = 'SelectField';

export type DataTableAlign = 'left' | 'center' | 'right';

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  align?: DataTableAlign;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> extends Omit<React.TableHTMLAttributes<HTMLTableElement>, 'children'> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey?: (row: T, index: number) => React.Key;
  caption?: React.ReactNode;
  emptyState?: React.ReactNode;
  rowClassName?: string | ((row: T, index: number) => string | undefined);
  containerClassName?: string;
}

const tableAlignment: Record<DataTableAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  emptyState,
  rowClassName,
  containerClassName,
  className,
  ...props
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className={cx('overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10', containerClassName)}>
        {emptyState || <EmptyState title="Nenhum registro encontrado" description="Ajuste os filtros ou tente novamente mais tarde." />}
      </div>
    );
  }

  return (
    <div className={cx('min-w-0 overflow-x-auto rounded-2xl border border-white/[0.08]', containerClassName)}>
      <table className={cx('w-full min-w-[42rem] border-collapse text-sm', className)} {...props}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-white/[0.045]">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cx(
                  'border-b border-white/[0.08] px-4 py-3 text-xs font-extrabold uppercase tracking-[0.08em] text-slate-400',
                  tableAlignment[column.align || 'left'],
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.07] bg-[rgba(7,12,9,.72)]">
          {rows.map((row, rowIndex) => {
            const key = getRowKey
              ? getRowKey(row, rowIndex)
              : ((row as { id?: React.Key }).id ?? rowIndex);
            const resolvedRowClassName = typeof rowClassName === 'function'
              ? rowClassName(row, rowIndex)
              : rowClassName;

            return (
              <tr key={key} className={cx('transition-colors hover:bg-white/[0.035]', resolvedRowClassName)}>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cx(
                      'px-4 py-3 align-middle text-slate-200',
                      tableAlignment[column.align || 'left'],
                      column.className,
                    )}
                  >
                    {column.cell(row, rowIndex)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  compact?: boolean;
}

export function LoadingState({
  label = 'Carregando…',
  description,
  compact = false,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'flex items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] text-slate-300',
        compact ? 'min-h-20 px-4 py-3' : 'min-h-52 flex-col px-5 py-10 text-center',
        className,
      )}
      {...props}
    >
      <LoaderCircle className={cx('shrink-0 animate-spin text-emerald-400', compact ? 'size-5' : 'size-7')} aria-hidden="true" />
      <div>
        <p className="text-sm font-bold text-slate-100">{label}</p>
        {description && <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>}
      </div>
    </div>
  );
}

export interface ProgressLoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  progress: number;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export function ProgressLoadingState({
  progress,
  label = 'Carregando dados…',
  description = 'Preparando as informações para exibição.',
  className,
  ...props
}: ProgressLoadingStateProps) {
  const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const stage = normalizedProgress < 25
    ? 'Iniciando carregamento'
    : normalizedProgress < 60
      ? 'Processando informações'
      : normalizedProgress < 90
        ? 'Organizando os dados'
        : normalizedProgress < 100
          ? 'Finalizando operação'
          : 'Tudo pronto';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${String(label)}: ${normalizedProgress}%`}
      className={cx(
        'relative isolate flex min-h-[21rem] items-center justify-center overflow-hidden rounded-[1.4rem] border border-emerald-400/15 bg-[linear-gradient(145deg,rgba(10,19,14,.99),rgba(4,9,6,.99))] px-5 py-10 shadow-[0_28px_90px_rgba(0,0,0,.32)] sm:px-8',
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-48 w-80 -translate-x-1/2 rounded-full bg-emerald-400/[0.08] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent" />
      </div>

      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 shadow-[inset_0_1px_rgba(255,255,255,.05)]">
          <LoaderCircle className="size-8 animate-spin text-emerald-300" aria-hidden="true" />
        </div>

        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300/90">Sistema ITAM</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{label}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{description}</p>

        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-black/20 p-4 text-left sm:p-5">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Progresso</p>
              <p className="mt-1 text-sm font-bold text-slate-200">{stage}</p>
            </div>
            <span className="tabular-nums text-3xl font-black tracking-[-0.04em] text-emerald-300 sm:text-4xl">
              {normalizedProgress}%
            </span>
          </div>

          <div
            className="h-3 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.055] p-[2px]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={normalizedProgress}
          >
            <div
              className="relative h-full rounded-full bg-[linear-gradient(90deg,#00a85e,#00c76f,#4ade80)] shadow-[0_0_22px_rgba(0,199,111,.28)] transition-[width] duration-150 ease-out"
              style={{ width: `${normalizedProgress}%` }}
            >
              <span className="absolute inset-y-0 right-0 w-10 animate-pulse rounded-full bg-white/25 blur-sm" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>0%</span>
            <span>Carregamento seguro</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  description: React.ReactNode;
  action?: React.ReactNode;
}

export function ErrorState({
  title = 'Não foi possível carregar',
  description,
  action,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cx(
        'flex min-h-52 flex-col items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/[0.055] px-5 py-10 text-center',
        className,
      )}
      {...props}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-rose-300">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <h3 className="text-base font-extrabold text-slate-100">{title}</h3>
      <p className="mt-1.5 max-w-lg text-sm leading-6 text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export interface StepperItem {
  id: string;
  label: string;
  description?: string;
  count?: number;
}

export interface StepperProps {
  steps: StepperItem[];
  activeStep: number;
  onStepChange?: (index: number) => void;
  className?: string;
  ariaLabel?: string;
}

export function Stepper({
  steps,
  activeStep,
  onStepChange,
  className,
  ariaLabel = 'Etapas do apontamento',
}: StepperProps) {
  return (
    <nav className={cx('workflow-stepper overflow-x-auto', className)} aria-label={ariaLabel}>
      <ol className="grid min-w-max grid-flow-col auto-cols-[minmax(8.5rem,1fr)] gap-2 sm:min-w-0">
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          const isComplete = index < activeStep;
          const content = (
            <>
              <span
                className={cx(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-black',
                  isActive && 'border-emerald-300 bg-emerald-300 text-emerald-950',
                  isComplete && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
                  !isActive && !isComplete && 'border-white/12 bg-black/20 text-slate-500',
                )}
              >
                {isComplete ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0 text-left">
                <span className="flex items-center gap-1.5">
                  <span className={cx('truncate text-xs font-bold', isActive ? 'text-white' : 'text-slate-300')}>
                    {step.label}
                  </span>
                  {typeof step.count === 'number' && (
                    <span className="rounded-full bg-white/[0.08] px-1.5 text-xs leading-5 text-slate-300">
                      {step.count}
                    </span>
                  )}
                </span>
                {step.description && (
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{step.description}</span>
                )}
              </span>
            </>
          );

          return (
            <li key={step.id} className="workflow-step">
              {onStepChange ? (
                <button
                  type="button"
                  onClick={() => onStepChange(index)}
                  aria-current={isActive ? 'step' : undefined}
                  className={cx(
                    'flex min-h-14 w-full items-center gap-2 rounded-xl border px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300',
                    isActive
                      ? 'border-emerald-400/30 bg-emerald-400/[0.08]'
                      : 'border-white/[0.08] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]',
                  )}
                >
                  {content}
                </button>
              ) : (
                <div
                  aria-current={isActive ? 'step' : undefined}
                  className={cx(
                    'flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2',
                    isActive ? 'border-emerald-400/30 bg-emerald-400/[0.08]' : 'border-white/[0.08] bg-white/[0.025]',
                  )}
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
