import type { Category } from '../lib/types'

export function CategoryBadge({ category }: { category: Category | undefined }) {
  if (!category) {
    return <span className="rounded-full border border-dashed border-felt-600 px-2 py-0.5 text-xs text-cream-300">ohne Kategorie</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-felt-900 px-2 py-0.5 text-xs text-cream-100">
      <span className="size-2 rounded-full" style={{ background: category.color }} />
      {category.name}
    </span>
  )
}
