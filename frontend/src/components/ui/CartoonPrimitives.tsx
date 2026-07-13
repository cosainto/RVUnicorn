/**
 * Cartoon Theme Primitives — shared components that carry the
 * RVUnicorn cartoon aesthetic. Two intensity variants:
 *
 *   "full"   — sticker rotations, wobble, display-font headers
 *              (marketing/identity surfaces)
 *   "subtle" — thick outlines + cel shadows + cartoon buttons,
 *              no rotation, straight edges (functional/dense surfaces)
 *
 * Usage:
 *   import { CButton, CCard, CInput, CBadge, CModal, CTabs, WaveDivider, SquiggleUnderline } from '../ui/CartoonPrimitives';
 */

import React from 'react';

/* ── Campfire Night tokens (JS access) ────────────────────────── */
export const CN = {
  deep: '#0F1C35',
  navy: '#1B2B4B',
  navyLight: '#243352',
  border: '#2A3F5F',
  gold: '#C9A84C',
  orange: '#E8622A',
  cream: '#F5F0E8',
  muted: '#8B9BB4',
  green: '#1D9E75',
} as const;

/* ══════════════════════════════════════════════════════════════════
   BUTTON
   ══════════════════════════════════════════════════════════════════ */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface CButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  intensity?: 'full' | 'subtle';
  as?: 'button' | 'a';
  href?: string;
}

export function CButton({ variant = 'primary', size = 'md', intensity = 'subtle', className = '', children, ...props }: CButtonProps) {
  const base = intensity === 'full' ? 'cartoon-btn' : 'cartoon-btn-subtle';
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  };
  const style: React.CSSProperties = {
    background: variant === 'primary' ? CN.gold : variant === 'secondary' ? CN.navyLight : variant === 'danger' ? '#EF4444' : 'transparent',
    color: variant === 'primary' ? CN.deep : variant === 'danger' ? 'white' : CN.cream,
    borderColor: variant === 'primary' ? CN.gold : variant === 'secondary' ? CN.border : variant === 'outline' ? CN.cream : variant === 'danger' ? '#EF4444' : 'transparent',
    fontFamily: intensity === 'full' ? "var(--font-display)" : undefined,
  };

  return (
    <button className={`${base} ${sizes[size]} inline-flex items-center justify-center gap-2 font-semibold ${className}`} style={style} {...props}>
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CARD
   ══════════════════════════════════════════════════════════════════ */
interface CCardProps {
  children: React.ReactNode;
  intensity?: 'full' | 'subtle';
  rotation?: number;
  className?: string;
  onClick?: () => void;
}

export function CCard({ children, intensity = 'subtle', rotation = 0, className = '', onClick }: CCardProps) {
  if (intensity === 'full') {
    return (
      <div className={`sticker p-5 ${className}`}
        style={{ transform: `rotate(${rotation}deg)` }}
        onClick={onClick}>
        {children}
      </div>
    );
  }
  return (
    <div className={`cartoon-card p-5 ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INPUT
   ══════════════════════════════════════════════════════════════════ */
interface CInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function CInput({ label, className = '', ...props }: CInputProps) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold mb-1.5" style={{ color: CN.muted }}>{label}</label>}
      <input className={`cartoon-input w-full text-sm ${className}`} {...props} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TEXTAREA
   ══════════════════════════════════════════════════════════════════ */
interface CTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function CTextarea({ label, className = '', ...props }: CTextareaProps) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold mb-1.5" style={{ color: CN.muted }}>{label}</label>}
      <textarea className={`cartoon-input w-full text-sm ${className}`} {...props} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BADGE
   ══════════════════════════════════════════════════════════════════ */
interface CBadgeProps {
  children: React.ReactNode;
  color?: 'gold' | 'orange' | 'green' | 'muted' | 'cream';
  className?: string;
}

export function CBadge({ children, color = 'gold', className = '' }: CBadgeProps) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    gold: { bg: 'rgba(201,168,76,0.1)', text: CN.gold, border: CN.gold },
    orange: { bg: 'rgba(232,98,42,0.1)', text: CN.orange, border: CN.orange },
    green: { bg: 'rgba(29,158,117,0.1)', text: CN.green, border: CN.green },
    muted: { bg: 'rgba(139,155,180,0.1)', text: CN.muted, border: CN.border },
    cream: { bg: 'rgba(245,240,232,0.1)', text: CN.cream, border: CN.cream },
  };
  const c = colors[color] || colors.gold;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${className}`}
      style={{ background: c.bg, color: c.text, border: `2px solid ${c.border}` }}>
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL
   ══════════════════════════════════════════════════════════════════ */
interface CModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  intensity?: 'full' | 'subtle';
}

export function CModal({ isOpen, onClose, title, children, intensity = 'subtle' }: CModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className={`w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl ${intensity === 'full' ? 'sticker' : 'cartoon-card'}`}
        style={{ background: CN.navy }} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between p-4" style={{ borderBottom: `2px solid ${CN.border}` }}>
            <h3 className="text-base font-bold font-display" style={{ color: CN.cream }}>{title}</h3>
            <button onClick={onClose} className="text-xl" style={{ color: CN.muted }}>✕</button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TABS
   ══════════════════════════════════════════════════════════════════ */
interface CTabsProps {
  tabs: { id: string; label: string; icon?: string }[];
  active: string;
  onChange: (id: string) => void;
  intensity?: 'full' | 'subtle';
}

export function CTabs({ tabs, active, onChange, intensity = 'subtle' }: CTabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: CN.deep }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
          style={active === tab.id
            ? { background: CN.navy, color: CN.gold, border: `2px solid ${CN.gold}`, fontFamily: intensity === 'full' ? 'var(--font-display)' : undefined }
            : { color: CN.muted, border: '2px solid transparent' }
          }>
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════════════ */
interface CToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  visible: boolean;
}

export function CToast({ message, type = 'info', visible }: CToastProps) {
  const colors = {
    success: { bg: CN.green, icon: '✓' },
    error: { bg: '#EF4444', icon: '✕' },
    info: { bg: CN.gold, icon: 'ℹ' },
  };
  const c = colors[type];

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300"
      style={{ opacity: visible ? 1 : 0, transform: `translate(-50%, ${visible ? 0 : -20}px)` }}>
      <div className="cartoon-card flex items-center gap-3 px-5 py-3" style={{ background: CN.navy }}>
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: c.bg }}>{c.icon}</span>
        <span className="text-sm font-medium" style={{ color: CN.cream }}>{message}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SVG ACCENTS
   ══════════════════════════════════════════════════════════════════ */

export function WaveDivider({ flip = false, color = CN.deep }: { flip?: boolean; color?: string }) {
  return (
    <div style={{ marginTop: -1, transform: flip ? 'scaleY(-1)' : 'none', lineHeight: 0 }}>
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 40 }}>
        <path d="M0,30 C240,50 480,10 720,30 C960,50 1200,10 1440,30 L1440,60 L0,60 Z" fill={color} />
      </svg>
    </div>
  );
}

export function SquiggleUnderline({ color = CN.gold, width = 120 }: { color?: string; width?: number }) {
  return (
    <svg width={width} height="8" viewBox={`0 0 ${width} 8`} fill="none" className="mx-auto mt-1">
      <path d={`M0 4 Q${width * 0.15} 0, ${width * 0.25} 4 T${width * 0.5} 4 T${width * 0.75} 4 T${width} 4`}
        stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SparkStar({ size = 16, color = CN.gold, className = '' }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} fill={color}>
      <path d="M10 0l2.5 7.5L20 10l-7.5 2.5L10 20l-2.5-7.5L0 10l7.5-2.5z" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SECTION HEADER (display font, squiggle)
   ══════════════════════════════════════════════════════════════════ */
interface CSectionHeaderProps {
  children: React.ReactNode;
  subtitle?: string;
  intensity?: 'full' | 'subtle';
  className?: string;
}

export function CSectionHeader({ children, subtitle, intensity = 'subtle', className = '' }: CSectionHeaderProps) {
  return (
    <div className={`text-center mb-8 ${className}`}>
      <h2 className="text-2xl md:text-3xl font-bold" style={{
        fontFamily: intensity === 'full' ? 'var(--font-display)' : undefined,
        color: 'white',
      }}>
        {children}
      </h2>
      {intensity === 'full' && <SquiggleUnderline width={160} />}
      {subtitle && <p className="text-sm mt-3" style={{ color: CN.muted }}>{subtitle}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LOADING SKELETON
   ══════════════════════════════════════════════════════════════════ */
export function CSkeleton({ width = '100%', height = 20, className = '' }: { width?: string | number; height?: number; className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg ${className}`}
      style={{ width, height, background: CN.border }} />
  );
}

/* ══════════════════════════════════════════════════════════════════
   SELECT
   ══════════════════════════════════════════════════════════════════ */
interface CSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function CSelect({ label, options, className = '', ...props }: CSelectProps) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold mb-1.5" style={{ color: CN.muted }}>{label}</label>}
      <select className={`cartoon-input w-full text-sm appearance-none ${className}`} {...props}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
