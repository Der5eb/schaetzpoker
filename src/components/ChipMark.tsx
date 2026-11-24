import type { CSSProperties } from 'react'

/**
 * Jeton-Marke der App (Logo, Blind-Anzeige, Chip-Stapel).
 * Wird später durch das eigene Jeton-Design ersetzt – Farben: siehe index.css.
 */
export function ChipMark({
  className = 'size-8',
  tone = 'gold',
  style,
}: {
  className?: string
  tone?: 'gold' | 'red'
  style?: CSSProperties
}) {
  const face = tone === 'gold' ? '#d1a446' : '#c23b33'
  const rim = tone === 'gold' ? '#8a6420' : '#9a2a23'
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill={rim} />
      <circle cx="32" cy="32" r="28" fill={face} />
      {/* Randmarkierungen */}
      <g fill="#fbf7ec">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="29" y="4" width="6" height="9" rx="1.2" transform={`rotate(${i * 45} 32 32)`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="17.5" fill="none" stroke="#fbf7ec" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="2 2.6" />
      <circle cx="32" cy="32" r="15" fill="#0f2b20" />
      <text
        x="32"
        y="39.5"
        textAnchor="middle"
        fontFamily="'Merriweather Variable', Georgia, serif"
        fontStyle="italic"
        fontWeight="600"
        fontSize="21"
        fill="#e6c470"
      >
        ?
      </text>
    </svg>
  )
}
