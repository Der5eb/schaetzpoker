import type { ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Shell } from '../components/Shell'

/** Spielregeln zum Nachlesen: Texas Hold'em, übertragen auf Schätzfragen. Braucht kein Login. */
export function Rules() {
  return (
    <Shell title="Regeln" back="/">
      <p className="mb-5 text-[0.95rem] leading-relaxed text-cream-300">
        Schätzpoker wird gesetzt wie <b className="text-cream-100">Texas Hold'em (No Limit)</b> – nur ohne Karten. Statt eines Blatts hat jeder
        eine geheime Schätzung, statt Flop, Turn und River kommen zwei Hinweise und die Lösung.
      </p>

      <div className="flex flex-col gap-2.5 pb-10">
        <Chapter icon="cards" title="Die Idee" summary="Poker mit Schätzfragen">
          <P>
            Eine Schätzfrage wird gestellt, jeder notiert verdeckt eine Zahl. Danach wird gesetzt – nach der Frage, nach jedem Hinweis und
            nach der Lösung. Wer am Ende noch dabei ist und am nächsten an der Lösung liegt, gewinnt den Pot.
          </P>
          <P>Gewonnen hat am Ende, wer die meisten Chips hat. Bleibt vorher nur noch eine Person mit Chips übrig, hat sie gewonnen.</P>
          <Table
            head={['Texas Hold’em', 'Schätzpoker']}
            rows={[
              ['Zwei verdeckte Karten', 'Deine geheime Schätzung'],
              ['Preflop', 'Setzrunde 1 nach der Frage'],
              ['Flop', 'Hinweis 1, dann Setzrunde 2'],
              ['Turn', 'Hinweis 2, dann Setzrunde 3'],
              ['River', 'Lösung, dann Setzrunde 4'],
              ['Beste Hand gewinnt', 'Nächste Schätzung gewinnt'],
            ]}
          />
        </Chapter>

        <Chapter icon="users" title="Vorbereitung" summary="Chips, Sitzplätze, Zettel">
          <List
            items={[
              'Alle bekommen gleich viele Chips – üblich sind 50 bis 100 Big Blinds.',
              'Jeder braucht Zettel und Stift für die Schätzungen.',
              'Die Spielleitung liest die Fragen vor, steuert den TV und bietet nicht mit.',
              'Die Sitzreihenfolge im Uhrzeigersinn festlegen – sie bestimmt, wer wann dran ist.',
            ]}
          />
        </Chapter>

        <Chapter icon="crown" title="Dealer und Blinds" summary="Wer muss vorab setzen?">
          <P>
            Damit in jeder Runde etwas im Pot liegt, gibt es zwei Pflichteinsätze, die <b>Blinds</b>. Ein Platz am Tisch ist der{' '}
            <b>Dealer</b> (Knopf):
          </P>
          <List
            items={[
              <>
                Links vom Dealer setzt der <b>Small Blind</b> (kleiner Pflichteinsatz).
              </>,
              <>
                Links davon setzt der <b>Big Blind</b> (meist doppelt so viel).
              </>,
              'Nach jeder Frage wandern Dealer und Blinds einen Platz weiter im Uhrzeigersinn.',
              'Nach einer festen Zahl von Fragen steigen die Blinds – so wird das Spiel mit der Zeit schneller.',
            ]}
          />
          <Note>
            Zu zweit (Heads-up) ist der Dealer selbst Small Blind. Der Dealer ist in Setzrunde 1 zuerst dran, in den späteren Runden zuletzt.
          </Note>
        </Chapter>

        <Chapter icon="arrow" title="Ablauf einer Frage" summary="Von der Frage bis zum Showdown">
          <Steps
            items={[
              ['Blinds setzen', 'Small und Big Blind legen ihre Pflichteinsätze in die Mitte.'],
              ['Frage', 'Die Frage erscheint am TV. Jeder schreibt verdeckt seine Schätzung auf – sie gilt bis zum Ende und wird nicht mehr geändert.'],
              ['Setzrunde 1', 'Beginnt links vom Big Blind.'],
              ['Hinweis 1 → Setzrunde 2', 'Ab jetzt beginnt jede Runde links vom Dealer.'],
              ['Hinweis 2 → Setzrunde 3', ''],
              ['Lösung → Setzrunde 4', 'Jetzt weiß jeder, wie nah die eigene Schätzung liegt – aber nicht, wie nah die der anderen.'],
              ['Showdown', 'Wer noch dabei ist, deckt auf. Die nächste Schätzung gewinnt den Pot.'],
            ]}
          />
          <Note>Steigen alle bis auf eine Person aus, gewinnt sie sofort den Pot – ohne ihre Schätzung zu zeigen.</Note>
        </Chapter>

        <Chapter icon="chip" title="Die Aktionen" summary="Checken, mitgehen, erhöhen …">
          <P>Wer dran ist, hat je nach Lage diese Möglichkeiten:</P>
          <Terms
            items={[
              ['Checken', 'Nichts setzen und weitergeben – nur möglich, solange in dieser Runde noch niemand etwas gesetzt hat (bzw. man den Einsatz schon gebracht hat).'],
              ['Setzen', 'Als Erstes in einer Runde einen Betrag setzen (mindestens ein Big Blind).'],
              ['Mitgehen', 'Den aktuellen Einsatz ausgleichen.'],
              ['Erhöhen', 'Mehr setzen als der aktuelle Einsatz. Dann müssen alle anderen erneut entscheiden.'],
              ['Aussteigen', 'Aufgeben. Was man schon gesetzt hat, bleibt im Pot.'],
              ['All-in', 'Alle eigenen Chips setzen.'],
            ]}
          />
        </Chapter>

        <Chapter icon="restart" title="Wer ist dran?" summary="Reihenfolge und Ende einer Setzrunde">
          <List
            items={[
              'Es geht immer im Uhrzeigersinn reihum.',
              'Setzrunde 1: Es beginnt die Person links vom Big Blind. Der Big Blind ist zuletzt dran.',
              'Setzrunden 2–4: Es beginnt die erste Person links vom Dealer, die noch dabei ist.',
              'Wer ausgestiegen oder all-in ist, wird übersprungen.',
            ]}
          />
          <P>
            Eine Setzrunde ist vorbei, wenn alle, die noch dabei sind, gleich viel gesetzt haben und jeder nach der letzten Erhöhung reagiert
            hat.
          </P>
          <Note>
            Gehen in Setzrunde 1 alle nur mit, darf der Big Blind trotzdem noch einmal: checken oder erhöhen.
          </Note>
        </Chapter>

        <Chapter icon="stack" title="Wie viel darf man setzen?" summary="No Limit und Mindesterhöhung">
          <List
            items={[
              <>
                <b>Höchstens:</b> alles, was man vor sich hat (No Limit).
              </>,
              <>
                <b>Mindesteinsatz:</b> ein Big Blind.
              </>,
              <>
                <b>Mindesterhöhung:</b> um mindestens so viel wie die letzte Erhöhung in dieser Runde.
              </>,
            ]}
          />
          <Example>
            Big Blind 20. Anna erhöht auf 60 – also um 40. Wer jetzt erhöhen will, muss auf mindestens 100 gehen (60 + 40).
          </Example>
          <P>
            Wer erhöht, sagt den Betrag an („Ich erhöhe auf 100“) oder schiebt die Chips in einem Zug nach vorn. Nachlegen, nachdem man die
            Reaktion der anderen gesehen hat, gilt nicht.
          </P>
          <Note>Das ist die übliche Regel aus Casino und Turnier. Am Küchentisch dürft ihr sie gern lockerer handhaben.</Note>
        </Chapter>

        <Chapter icon="diamond" title="All-in und Nebentöpfe" summary="Wenn jemand zu wenig Chips hat">
          <P>
            Wer nicht genug Chips zum Mitgehen hat, kann trotzdem all-in gehen. Gewinnen kann man dann aber von jedem anderen nur so viel, wie
            man selbst gesetzt hat. Der Rest kommt in einen <b>Nebentopf</b>, um den nur die anderen spielen.
          </P>
          <Example>
            Anna hat nur 50 und geht all-in. Ben und Clara setzen je 200.
            <br />
            Haupttopf: 3 × 50 = 150 – darum spielen alle drei.
            <br />
            Nebentopf: 2 × 150 = 300 – darum spielen nur Ben und Clara.
          </Example>
          <P>
            Ist ein All-in kleiner als eine volle Erhöhung, dürfen die anderen nur mitgehen – wer schon gehandelt hat, darf deswegen nicht
            erneut erhöhen.
          </P>
        </Chapter>

        <Chapter icon="spade" title="Showdown" summary="Wer gewinnt den Pot?">
          <List
            items={[
              'Alle, die noch dabei sind, legen ihre Schätzung offen.',
              'Gewonnen hat, wer am nächsten an der Lösung liegt – egal ob darüber oder darunter.',
              'Liegen mehrere gleich nah, wird der Pot geteilt.',
              'Gibt es Nebentöpfe, wird jeder Topf einzeln vergeben: Den Haupttopf gewinnt die beste Schätzung von allen, den Nebentopf die beste unter denen, die dort mitspielen.',
            ]}
          />
        </Chapter>

        <Chapter icon="flag" title="Ausscheiden und Ende" summary="Wann ist der Abend vorbei?">
          <List
            items={[
              'Wer keine Chips mehr hat, scheidet aus und wird bei Blinds und Reihenfolge übersprungen.',
              'Der Abend endet nach der vereinbarten Zahl an Fragen (etwa 10) – oder wenn nur noch eine Person Chips hat.',
              'Gewonnen hat, wer die meisten Chips hat.',
            ]}
          />
        </Chapter>

        <Chapter icon="tv" title="So hilft die App" summary="Was die Spielleitung antippt">
          <List
            items={[
              'Die Spielleitung sieht auf dem Handy, wer am Zug ist, und tippt an, was die Person macht: steigt aus, checkt, geht mit, erhöht auf …',
              'Blinds, Reihenfolge, Pot, All-ins und Nebentöpfe rechnet die App selbst.',
              'Beim Showdown tippt die Spielleitung den Gewinner an – der TV zeigt danach die neuen Stände.',
              'Vertippt? „Rückgängig“ nimmt die letzte Aktion zurück, Stände lassen sich zwischen den Fragen korrigieren.',
            ]}
          />
        </Chapter>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------------------

function Chapter({ icon, title, summary, children }: { icon: IconName; title: string; summary: string; children: ReactNode }) {
  return (
    <details className="card group overflow-hidden">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <Icon name={icon} weight="duotone" className="size-6 shrink-0 text-gold-300" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg leading-tight font-extrabold text-cream-50">{title}</span>
          <span className="block truncate text-sm text-cream-400">{summary}</span>
        </span>
        <Icon name="down" className="size-4 shrink-0 text-cream-400 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 pt-4 pb-5 text-[0.95rem] leading-relaxed text-cream-100">{children}</div>
    </details>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rotate-45 rounded-[1px] bg-gold-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Steps({ items }: { items: [string, string][] }) {
  return (
    <ol className="flex flex-col">
      {items.map(([title, text], i) => (
        <li key={title} className="relative flex gap-3 pb-3 last:pb-0">
          {i < items.length - 1 && <span aria-hidden="true" className="absolute top-7 bottom-0 left-[0.8rem] w-px bg-white/10" />}
          <span className="grid size-[1.6rem] shrink-0 place-items-center rounded-full bg-gold-300 text-xs font-bold text-felt-950 tabular-nums">
            {i + 1}
          </span>
          <span className="min-w-0 pt-0.5">
            <span className="block font-semibold text-cream-50">{title}</span>
            {text && <span className="block text-sm text-cream-300">{text}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Terms({ items }: { items: [string, string][] }) {
  return (
    <dl className="flex flex-col gap-2.5">
      {items.map(([term, text]) => (
        <div key={term} className="rounded-xl bg-felt-950/40 px-3.5 py-2.5">
          <dt className="font-semibold text-gold-200">{term}</dt>
          <dd className="text-sm text-cream-200">{text}</dd>
        </div>
      ))}
    </dl>
  )
}

function Table({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <table className="w-full overflow-hidden rounded-xl text-left text-sm">
      <thead className="bg-felt-950/60 text-xs text-cream-300">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-3 py-2 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a} className="border-t border-white/[0.05]">
            <td className="px-3 py-2 text-cream-300">{a}</td>
            <td className="px-3 py-2 text-cream-50">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Example({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-gold-400/8 px-3.5 py-2.5 text-sm text-cream-100 ring-1 ring-gold-400/25">
      <span className="mb-0.5 block text-xs font-semibold text-gold-200">Beispiel</span>
      {children}
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-felt-950/40 px-3.5 py-2.5 text-sm text-cream-300">{children}</p>
}
