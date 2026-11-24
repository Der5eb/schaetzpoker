import type { Category } from '../lib/types'

export function CategoryBadge({ category }: { category: Category | undefined }) {
  if (!category) {
    return <span className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-xs text-cream-400">ohne Kategorie</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-felt-950/70 px-2 py-0.5 text-xs font-medium text-cream-200">
      <span className="size-2 rounded-full ring-2 ring-black/20" style={{ background: category.color }} />
      {category.name}
    </span>
  )
}
