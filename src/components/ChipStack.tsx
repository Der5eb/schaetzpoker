import { useId, type CSSProperties } from 'react'

// Poker-Jetons in leichter Aufsicht: Kante mit umlaufenden Einlagen,
// Oberseite mit Segmentring wie beim App-Jeton. Jeder Chip fällt nacheinander
// auf seinen Stapel (Klasse animate-chip-drop).

interface Tone {
  face: string
  side: string
  inlay: string
  ring: string
}

const TONES: Record<string, Tone> = {
  red: { face: '#c23b33', side: '#9a2a23', inlay: '#fbf7ec', ring: '#fbf7ec' },
  black: { face: '#1f2a25', side: '#121a16', inlay: '#fbf7ec', ring: '#d1a446' },
  gold: { face: '#d1a446', side: '#a57a28', inlay: '#8a6420', ring: '#fbf7ec' },
  cream: { face: '#f1e8d3', side: '#c9bea2', inlay: '#c23b33', ring: '#c23b33' },
}

/** Zwei Stapel – Farben von unten nach oben, leichter Versatz je Chip */
const STACKS: { cx: number; chips: (keyof typeof TONES)[] }[] = [
  { cx: 78, chips: ['black', 'gold', 'red', 'cream', 'black', 'gold', 'cream', 'red'] },
  { cx: 196, chips: ['gold', 'red', 'cream', 'gold', 'black'] },
]
const JITTER = [0, 2.5, -1.5, 1, -2.5, 1.5, -1, 2]

const RX = 50 // Radius
const RY = 15 // Radius in der Aufsicht
const H = 10 // Höhe eines Chips
const INLAYS = 8 // Einlagen rundum
const INLAY_DEG = 17 // Breite einer Einlage in Grad

const rad = (d: number) => (d * Math.PI) / 180
const ex = (cx: number, deg: number, r = RX) => cx + r * Math.cos(rad(deg))
const ey = (cy: number, deg: number, r = RY) => cy + r * Math.sin(rad(deg))

/** Sichtbare Vorderkante (unterer Halbbogen) als Band der Höhe H */
function sidePath(cx: number, cy: number) {
  return `M${cx - RX} ${cy}A${RX} ${RY} 0 0 0 ${cx + RX} ${cy}v${H}A${RX} ${RY} 0 0 1 ${cx - RX} ${cy + H}Z`
}

/** Einlage auf der Kante, folgt der Rundung (nur Vorderseite sichtbar) */
function edgeInlay(cx: number, cy: number, deg: number) {
  const a = Math.max(2, deg - INLAY_DEG / 2)
  const b = Math.min(178, deg + INLAY_DEG / 2)
  if (b <= a) return null
  const steps = [a, (a + b) / 2, b]
  const top = steps.map((d) => `${ex(cx, d).toFixed(1)} ${ey(cy, d).toFixed(1)}`)
  const bottom = [...steps].reverse().map((d) => `${ex(cx, d).toFixed(1)} ${(ey(cy, d) + H).toFixed(1)}`)
  return `M${top.join('L')}L${bottom.join('L')}Z`
}

/** Einlage am Rand der Oberseite (Ringsegment in Aufsicht) */
function faceInlay(cx: number, cy: number, deg: number) {
  const a = deg - INLAY_DEG / 2
  const b = deg + INLAY_DEG / 2
  const ro = 0.97
  const ri = 0.74
  return (
    `M${ex(cx, a, RX * ro)} ${ey(cy, a, RY * ro)}` +
    `A${RX * ro} ${RY * ro} 0 0 1 ${ex(cx, b, RX * ro)} ${ey(cy, b, RY * ro)}` +
    `L${ex(cx, b, RX * ri)} ${ey(cy, b, RY * ri)}` +
    `A${RX * ri} ${RY * ri} 0 0 0 ${ex(cx, a, RX * ri)} ${ey(cy, a, RY * ri)}Z`
  )
}

function Chip({ cx, cy, tone, turn, shade }: { cx: number; cy: number; tone: Tone; turn: number; shade: string }) {
  const angles = Array.from({ length: INLAYS }, (_, k) => turn + (k * 360) / INLAYS)
  return (
    <>
      {/* Kante */}
      <path d={sidePath(cx, cy)} fill={tone.side} />
      {angles.map((d) => {
        const norm = ((d % 360) + 360) % 360
        const p = norm < 180 ? edgeInlay(cx, cy, norm) : null
        return p ? <path key={d} d={p} fill={tone.inlay} /> : null
      })}
      <path d={sidePath(cx, cy)} fill={`url(#${shade})`} />
      {/* Oberseite */}
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill={tone.face} />
      {angles.map((d) => (
        <path key={d} d={faceInlay(cx, cy, d)} fill={tone.inlay} />
      ))}
      <ellipse cx={cx} cy={cy} rx={RX * 0.62} ry={RY * 0.62} fill="none" stroke={tone.ring} strokeOpacity="0.7" strokeWidth="1" strokeDasharray="2.5 2.5" />
      <ellipse cx={cx} cy={cy} rx={RX * 0.5} ry={RY * 0.5} fill={tone.side} opacity="0.55" />
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth="0.8" />
    </>
  )
}

export function ChipStack({ className = '', delay = 200 }: { className?: string; delay?: number }) {
  const id = useId().replace(/:/g, '')
  const shade = `${id}-shade`
  const maxChips = Math.max(...STACKS.map((s) => s.chips.length))
  const height = maxChips * H + RY * 2 + 10
  const base = height - RY - H - 4 // Oberseite des untersten Chips
  // Fall-Reihenfolge: erst der linke Stapel, dann der rechte
  const offsets = STACKS.map((_, si) => STACKS.slice(0, si).reduce((sum, s) => sum + s.chips.length, 0))

  return (
    <svg viewBox={`0 0 274 ${height}`} className={className} aria-hidden="true" overflow="visible">
      <defs>
        {/* Rundung der Kante: Mitte heller, Ränder dunkler */}
        <linearGradient id={shade} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.45" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {STACKS.map((stack) => (
        <ellipse key={`s${stack.cx}`} cx={stack.cx} cy={base + H + 3} rx={RX + 8} ry={RY + 4} fill="black" opacity="0.4" />
      ))}
      {STACKS.map((stack, si) =>
        stack.chips.map((t, i) => {
          const cx = stack.cx + JITTER[(i + si * 3) % JITTER.length]
          const cy = base - i * H
          const n = offsets[si] + i
          return (
            <g
              key={`${si}-${i}`}
              className="animate-chip-drop"
              style={{ animationDelay: `${delay + n * 95}ms` } as CSSProperties}
            >
              <Chip cx={cx} cy={cy} tone={TONES[t]} turn={(i * 23 + si * 11) % 45} shade={shade} />
            </g>
          )
        }),
      )}
    </svg>
  )
}
