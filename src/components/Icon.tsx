import {
  ArrowCounterClockwise,
  ArrowRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  Cards,
  Check,
  Club,
  CornersIn,
  DotsThree,
  CornersOut,
  Crown,
  Diamond,
  Eye,
  EyeSlash,
  FlagCheckered,
  Image,
  Key,
  MagnifyingGlass,
  Pause,
  PencilSimpleLine,
  Play,
  Plus,
  PokerChip,
  QrCode,
  Shuffle,
  SignOut,
  Spade,
  Sparkle,
  Stack,
  Tag,
  Television,
  Trash,
  UserCircle,
  UsersThree,
  X,
  YoutubeLogo,
  type Icon as PhosphorIcon,
  type IconWeight,
} from '@phosphor-icons/react'

// Eine Icon-Familie (Phosphor) für die ganze App.
// Steuerelemente: "regular"/"bold". Hervorgehobene Motive: "duotone".
const icons = {
  plus: Plus,
  x: X,
  image: Image,
  play: Play,
  pause: Pause,
  restart: ArrowCounterClockwise,
  sparkle: Sparkle,
  search: MagnifyingGlass,
  tag: Tag,
  check: Check,
  trash: Trash,
  back: CaretLeft,
  next: CaretRight,
  down: CaretDown,
  arrow: ArrowRight,
  cards: Cards,
  pencil: PencilSimpleLine,
  tv: Television,
  chip: PokerChip,
  signOut: SignOut,
  eye: Eye,
  eyeOff: EyeSlash,
  shuffle: Shuffle,
  flag: FlagCheckered,
  fullscreen: CornersOut,
  shrink: CornersIn,
  youtube: YoutubeLogo,
  crown: Crown,
  qr: QrCode,
  stack: Stack,
  more: DotsThree,
  club: Club,
  diamond: Diamond,
  spade: Spade,
  users: UsersThree,
  key: Key,
  user: UserCircle,
} satisfies Record<string, PhosphorIcon>

export type IconName = keyof typeof icons

export function Icon({
  name,
  className = 'size-5',
  weight = 'regular',
}: {
  name: IconName
  className?: string
  weight?: IconWeight
}) {
  const Cmp = icons[name]
  return <Cmp className={className} weight={weight} aria-hidden="true" />
}
