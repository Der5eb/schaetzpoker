import { useId, type CSSProperties } from 'react'

// Jeton-Marke der App – Vektor-Nachbau von design/jeton-original.png
// (Logo, Blind-Anzeige, Ladeanzeige). Farben aus index.css.

/** Randsegmente, abwechselnd Bronze und Creme (12 × 30°) */
const SEGMENTS = [
  'M329.0 203.8A342 342 0 0 1 500.0 158.0L500.0 238.0A262 262 0 0 0 369.0 273.1Z',
  'M500.0 158.0A342 342 0 0 1 671.0 203.8L631.0 273.1A262 262 0 0 0 500.0 238.0Z',
  'M671.0 203.8A342 342 0 0 1 796.2 329.0L726.9 369.0A262 262 0 0 0 631.0 273.1Z',
  'M796.2 329.0A342 342 0 0 1 842.0 500.0L762.0 500.0A262 262 0 0 0 726.9 369.0Z',
  'M842.0 500.0A342 342 0 0 1 796.2 671.0L726.9 631.0A262 262 0 0 0 762.0 500.0Z',
  'M796.2 671.0A342 342 0 0 1 671.0 796.2L631.0 726.9A262 262 0 0 0 726.9 631.0Z',
  'M671.0 796.2A342 342 0 0 1 500.0 842.0L500.0 762.0A262 262 0 0 0 631.0 726.9Z',
  'M500.0 842.0A342 342 0 0 1 329.0 796.2L369.0 726.9A262 262 0 0 0 500.0 762.0Z',
  'M329.0 796.2A342 342 0 0 1 203.8 671.0L273.1 631.0A262 262 0 0 0 369.0 726.9Z',
  'M203.8 671.0A342 342 0 0 1 158.0 500.0L238.0 500.0A262 262 0 0 0 273.1 631.0Z',
  'M158.0 500.0A342 342 0 0 1 203.8 329.0L273.1 369.0A262 262 0 0 0 238.0 500.0Z',
  'M203.8 329.0A342 342 0 0 1 329.0 203.8L369.0 273.1A262 262 0 0 0 273.1 369.0Z',
]

const QUESTION =
  'M353 447L353 430A144 118 0 0 1 641 430C641 470 618 488 588 508C566 523 550 533 550 548L550 559L455 559L455 538C455 510 474 492 500 472C516 460 526 448 526 430A35 42 0 0 0 455 430L455 447Z'
const DOT = 'M449 594H556V694H449Z'
/** Plus in gleicher Strichstärke wie das Fragezeichen */
const PLUS = 'M450 345H550V450H655V550H550V655H450V550H345V450H450Z'

export function ChipMark({
  className = 'size-8',
  style,
  symbol = 'question',
}: {
  className?: string
  style?: CSSProperties
  /** Motiv in der Mitte: Fragezeichen (Logo) oder Plus (Knopf „Neue Frage“) */
  symbol?: 'question' | 'plus'
}) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="140 140 720 720" className={className} style={style} aria-hidden="true">
      <defs>
        <filter id={id} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
          <feFlood floodColor="#f7e9c8" result="lt" />
          <feComposite in="lt" in2="SourceAlpha" operator="out" result="outside" />
          <feGaussianBlur in="outside" stdDeviation="13" result="blurOut" />
          <feComposite in="blurOut" in2="SourceAlpha" operator="in" result="glow" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="13" result="sb" />
          <feFlood floodColor="#04100a" floodOpacity="0.9" />
          <feComposite in2="sb" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="glow" />
            <feMergeNode in="glow" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="500" cy="500" r="356" fill="#d1a446" />
      {SEGMENTS.map((d, i) => (
        <path key={i} d={d} fill={i % 2 === 0 ? '#8a6420' : '#fbf7ec'} />
      ))}
      <circle cx="500" cy="500" r="261" fill="#d1a446" />
      <circle cx="500" cy="500" r="253" fill="#0f2b20" />
      <circle cx="500" cy="500" r="240" fill="#d1a446" />
      <circle cx="500" cy="500" r="233" fill="#0f2b20" />
      <g filter={`url(#${id})`} fill="#e6c470">
        {symbol === 'plus' ? (
          <path d={PLUS} />
        ) : (
          <>
            <path d={QUESTION} />
            <path d={DOT} />
          </>
        )}
      </g>
    </svg>
  )
}
