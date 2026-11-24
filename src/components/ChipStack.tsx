import type { CSSProperties } from 'react'

const TONES = [
  { face: '#d1a446', side: '#a57a28', edge: '#8a6420' },
  { face: '#c23b33', side: '#9a2a23', edge: '#7a1f1a' },
  { face: '#f1e8d3', side: '#c9bea2', edge: '#a1987f' },
]

/**
 * Chip-Stapel in leichter Aufsicht. Jeder Chip fällt nacheinander auf den Stapel
 * (Klasse animate-chip-drop, Verzögerung pro Chip).
 */
export function ChipStack({ count = 6, className = '', delay = 200 }: { count?: number; className?: string; delay?: number }) {
  const rx = 52
  const ry = 15
  const h = 11 // Höhe eines Chips
  const height = count * h + ry * 2 + 6
  return (
    <svg viewBox={`0 0 120 ${height}`} className={className} aria-hidden="true" overflow="visible">
      <ellipse cx="60" cy={height - ry + 2} rx={rx + 6} ry={ry + 3} fill="black" opacity="0.35" />
      {Array.from({ length: count }, (_, i) => {
        const t = TONES[[0, 1, 0, 2, 0, 1, 0, 2][i % 8]]
        const cy = height - ry - 4 - i * h
        return (
          <g
            key={i}
            className="animate-chip-drop"
            style={{ animationDelay: `${delay + i * 110}ms`, transformBox: 'fill-box', transformOrigin: 'center' } as CSSProperties}
          >
            {/* Seite */}
            <path d={`M${60 - rx} ${cy} v${-h + 2} a${rx} ${ry} 0 0 0 ${rx * 2} 0 v${h - 2} a${rx} ${ry} 0 0 1 ${-rx * 2} 0z`} fill={t.side} />
            {/* Randstreifen */}
            {[-38, -14, 10, 34].map((x) => (
              <rect key={x} x={60 + x} y={cy - h + 4} width="8" height={h - 3} fill="#fbf7ec" opacity="0.85" rx="1" />
            ))}
            {/* Oberseite */}
            <ellipse cx="60" cy={cy - h + 2} rx={rx} ry={ry} fill={t.face} stroke={t.edge} strokeWidth="1" />
            <ellipse cx="60" cy={cy - h + 2} rx={rx * 0.62} ry={ry * 0.62} fill="none" stroke="#fbf7ec" strokeOpacity="0.55" strokeDasharray="3 3" />
          </g>
        )
      })}
    </svg>
  )
}
