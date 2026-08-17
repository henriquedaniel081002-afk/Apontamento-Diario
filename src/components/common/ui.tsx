import React from 'react';
import { Check, LoaderCircle } from 'lucide-react';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
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
    'border-emerald-400 bg-emerald-400 text-emerald-950 shadow-[0_8px_24px_rgba(52,211,153,0.14)] hover:border-emerald-300 hover:bg-emerald-300 active:bg-emerald-500',
  secondary:
    'border-white/12 bg-white/[0.06] text-slate-100 hover:border-white/20 hover:bg-white/[0.10] active:bg-white/[0.14]',
  ghost:
    'border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-white active:bg-white/[0.10]',
  danger:
    'border-rose-500 bg-rose-600 text-white shadow-[0_8px_24px_rgba(225,29,72,0.12)] hover:border-rose-400 hover:bg-rose-500 active:bg-rose-700',
  warning:
    'border-amber-400 bg-amber-400 text-amber-950 shadow-[0_8px_24px_rgba(251,191,36,0.12)] hover:border-amber-300 hover:bg-amber-300 active:bg-amber-500',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 gap-2 rounded-lg px-3 text-xs',
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

export type SurfaceTone = 'base' | 'muted' | 'raised' | 'inset';
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside';
  tone?: SurfaceTone;
  padding?: SurfacePadding;
}

const surfaceTones: Record<SurfaceTone, string> = {
  base: 'border-white/10 bg-[#0c120e]',
  muted: 'border-white/[0.08] bg-[#090e0b]',
  raised: 'border-white/12 bg-[#101712] shadow-[0_20px_50px_rgba(0,0,0,0.22)]',
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
      className={cx('rounded-2xl border', surfaceTones[tone], surfacePaddings[padding], className)}
      {...props}
    />
  ),
);

Surface.displayName = 'Surface';

export const Card = React.forwardRef<HTMLElement, SurfaceProps>(
  ({ padding = 'md', ...props }, ref) => <Surface ref={ref} padding={padding} {...props} />,
);

Card.displayName = 'Card';

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
        'inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold leading-5',
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  ),
);

Badge.displayName = 'Badge';
export const StatusBadge = Badge;

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
    <nav className={cx('overflow-x-auto', className)} aria-label={ariaLabel}>
      <ol className="grid min-w-[36rem] grid-cols-4 gap-2 sm:min-w-0">
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
                    <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] leading-5 text-slate-300">
                      {step.count}
                    </span>
                  )}
                </span>
                {step.description && (
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{step.description}</span>
                )}
              </span>
            </>
          );

          return (
            <li key={step.id}>
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
