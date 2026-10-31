import { useId } from 'react'

// Cờ vẽ bằng SVG: Windows không hiện emoji cờ (chỉ ra chữ "VN").

export function VietnamFlag() {
  return (
    <svg className="af-flag" viewBox="0 0 30 20" aria-hidden>
      <rect width="30" height="20" fill="#da251d" />
      <polygon fill="#ffff00" points="15.00,4.00 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15.00,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15" />
    </svg>
  )
}

export function UkFlag() {
  const clip = useId()
  return (
    <svg className="af-flag" viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden>
      <clipPath id={clip}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clip})`} stroke="#c8102e" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  )
}
