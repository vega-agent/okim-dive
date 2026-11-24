'use client'

// Square 44px icon button with an instant tooltip (MVP-SPEC #44): the trip
// editor's lifecycle actions live in the sticky nav, right-aligned. Same
// visual language as the translate icon (white + teal border, sand hover).
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export default function IconAction({ tip, danger, className = '', children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { tip: string; danger?: boolean; children: ReactNode }) {
  return <button type="button" {...rest}
    className={`icon-action${danger ? ' icon-action-danger' : ''}${className ? ` ${className}` : ''}`}
    data-tip={tip} aria-label={tip}>{children}</button>
}

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', 'aria-hidden': true }
export const icons = {
  save: <svg {...s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>,
  open: <svg {...s}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  close: <svg {...s}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  draft: <svg {...s}><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>,
  trash: <svg {...s}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
  cancel: <svg {...s}><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>,
}