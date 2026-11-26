import type { QuestionMode } from '../game/types'
import { Icon } from './Icon'

const MODES: { value: QuestionMode; icon: 'crown' | 'shuffle'; title: string; text: string }[] = [
  { value: 'pick', icon: 'crown', title: 'Big Blind wählt', text: 'Vor jeder Frage sucht der Big Blind eine Kategorie aus.' },
  { value: 'random', icon: 'shuffle', title: 'Zufällige Fragen', text: 'Die App zieht jede Frage zufällig aus allen Kategorien.' },
]

/** Auswahl, wie die nächste Frage gefunden wird: Big Blind wählt oder Zufall. */
export function QuestionModePicker({ value, onChange }: { value: QuestionMode; onChange: (m: QuestionMode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Wie wird die nächste Frage ausgewählt?">
      {MODES.map((m) => {
        const isSel = value === m.value
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={isSel}
            onClick={() => onChange(m.value)}
            className={`card flex h-full flex-col items-start gap-1.5 px-4 py-3.5 text-left ${isSel ? 'border-gold-300/80! bg-gold-400/10' : ''}`}
          >
            <span className="flex w-full items-center gap-2">
              <Icon name={m.icon} weight="duotone" className={`size-5 ${isSel ? 'text-gold-200' : 'text-gold-300'}`} />
              <span
                aria-hidden="true"
                className={`ml-auto grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                  isSel ? 'border-gold-300 bg-gold-300 text-felt-950' : 'border-cream-400'
                }`}
              >
                {isSel && <Icon name="check" weight="bold" className="size-3" />}
              </span>
            </span>
            <span className="font-display text-lg leading-tight font-extrabold text-cream-50">{m.title}</span>
            <span className="text-sm leading-snug text-cream-300">{m.text}</span>
          </button>
        )
      })}
    </div>
  )
}
