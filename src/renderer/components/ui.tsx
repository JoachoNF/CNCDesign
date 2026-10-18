import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './utils'

/* ============================================================
   Sistema de diseño — tema oscuro minimalista
   · Esquinas redondeadas (píldoras y radios suaves)
   · Superficies zinc translúcidas con bordes finos
   · Acentos en degradado sutil por sección
   ============================================================ */

// --- Acentos por sección (usados en iconos y tarjetas) ---
export const acentos = {
  violeta: { tile: 'from-violet-500/25 to-indigo-500/5 text-violet-300' },
  cian: { tile: 'from-cyan-500/25 to-sky-500/5 text-cyan-300' },
  ambar: { tile: 'from-amber-500/25 to-orange-500/5 text-amber-300' },
  esmeralda: { tile: 'from-emerald-500/25 to-teal-500/5 text-emerald-300' },
  rosa: { tile: 'from-rose-500/25 to-pink-500/5 text-rose-300' },
} as const
export type Acento = keyof typeof acentos

// --- Botón ---
export const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
    'rounded-full font-medium tracking-tight',
    'transition-all duration-200 ease-out active:scale-[0.97]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
    'disabled:pointer-events-none disabled:opacity-40',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_6px_24px_-10px_rgba(124,58,237,0.7)] hover:from-indigo-400 hover:to-violet-400 hover:shadow-[0_8px_28px_-10px_rgba(124,58,237,0.85)]',
        secondary:
          'border border-white/10 bg-white/[0.06] text-zinc-200 hover:bg-white/[0.1] hover:text-white',
        outline:
          'border border-white/10 bg-transparent text-zinc-300 hover:border-white/20 hover:bg-white/[0.05] hover:text-zinc-100',
        ghost: 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
        destructive:
          'bg-rose-500/90 text-white shadow-[0_6px_24px_-10px_rgba(244,63,94,0.7)] hover:bg-rose-500',
      },
      size: {
        sm: 'h-8 px-3.5 text-xs',
        default: 'h-9 px-4 text-[13px]',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}
export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

// --- Badge ---
export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight transition-colors',
  {
    variants: {
      variant: {
        default: 'border-violet-400/25 bg-violet-500/10 text-violet-300',
        secondary: 'border-white/10 bg-white/[0.06] text-zinc-300',
        success: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
        warning: 'border-amber-400/25 bg-amber-500/10 text-amber-300',
        destructive: 'border-rose-400/25 bg-rose-500/10 text-rose-300',
        outline: 'border-white/10 bg-transparent text-zinc-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {children}
    </span>
  )
}

// --- Panel ---
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-sm',
        'shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function PanelHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3',
        className
      )}
    >
      {children}
    </div>
  )
}

export function PanelBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>
}

// --- Icono de sección (azulejo con degradado) ---
export function SectionIcon({
  icono,
  acento = 'violeta',
  className,
}: {
  icono: React.ReactNode
  acento?: Acento
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10',
        'bg-gradient-to-br shadow-inner',
        '[&>svg]:h-[18px] [&>svg]:w-[18px]',
        acentos[acento].tile,
        className
      )}
    >
      {icono}
    </div>
  )
}

// --- Encabezado de sección (icono + título + acciones) ---
export function SectionHeader({
  icono,
  acento = 'violeta',
  titulo,
  subtitulo,
  acciones,
  className,
}: {
  icono: React.ReactNode
  acento?: Acento
  titulo: string
  subtitulo?: string
  acciones?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <SectionIcon icono={icono} acento={acento} />
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold tracking-tight text-zinc-100">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="truncate text-[11px] leading-snug text-zinc-500">{subtitulo}</p>
          )}
        </div>
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </div>
  )
}

// --- Control segmentado (píldora) ---
export interface OpcionSegmento {
  id: string
  etiqueta: string
  icono?: React.ReactNode
}

export function Segmented({
  opciones,
  valor,
  onCambio,
  className,
}: {
  opciones: OpcionSegmento[]
  valor: string
  onCambio: (id: string) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-1',
        className
      )}
    >
      {opciones.map((o) => {
        const activo = o.id === valor
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onCambio(o.id)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium tracking-tight',
              'transition-all duration-200',
              activo
                ? 'bg-white/10 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {o.icono}
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

// --- Estado vacío ---
export function EmptyState({
  icon,
  titulo,
  descripcion,
  accion,
  acento = 'violeta',
}: {
  icon: React.ReactNode
  titulo: string
  descripcion: string
  accion?: React.ReactNode
  acento?: Acento
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div
        className={cn(
          'mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10',
          'bg-gradient-to-br shadow-inner [&>svg]:h-6 [&>svg]:w-6',
          acentos[acento].tile
        )}
      >
        {icon}
      </div>
      <h3 className="text-sm font-semibold tracking-tight text-zinc-200">{titulo}</h3>
      <p className="mt-1.5 max-w-[280px] text-xs leading-relaxed text-zinc-500">{descripcion}</p>
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
}

// --- Marca / logo principal (placa CNC estilizada) ---
export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
        'bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500',
        'shadow-[0_10px_30px_-12px_rgba(139,92,246,0.9)] ring-1 ring-white/20',
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px]" aria-hidden="true">
        {/* placa con 4 agujeros */}
        <rect
          x="3.2"
          y="3.2"
          width="17.6"
          height="17.6"
          rx="4.5"
          stroke="white"
          strokeWidth="1.5"
          strokeOpacity="0.95"
        />
        <circle cx="8" cy="8" r="1.35" fill="white" fillOpacity="0.95" />
        <circle cx="16" cy="8" r="1.35" fill="white" fillOpacity="0.95" />
        <circle cx="8" cy="16" r="1.35" fill="white" fillOpacity="0.95" />
        <circle cx="16" cy="16" r="1.35" fill="white" fillOpacity="0.95" />
        {/* marca central de herramienta */}
        <path
          d="M12 9.4v5.2M9.4 12h5.2"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.9"
        />
      </svg>
    </div>
  )
}
