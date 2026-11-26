-- Schätzpoker – Datenbankschema
-- Einmalig im Supabase-Dashboard unter "SQL Editor" ausführen.
-- Jede Zeile gehört einem Benutzer (owner_id). Row Level Security sorgt dafür,
-- dass jede Spielleitung nur ihre eigenen Fragen, Kategorien und Spiele sieht.

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: updated_at automatisch setzen
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kategorien
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  color       text not null default '#d4a84b',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

-- ---------------------------------------------------------------------------
-- Fragen
-- Medien-Felder sind JSON-Listen, z. B.:
--   [{"type":"image","path":"<user-id>/abc.webp","caption":"..."},
--    {"type":"youtube","videoId":"dQw4w9WgXcQ","start":12,"end":30}]
-- ---------------------------------------------------------------------------
create table public.questions (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id        uuid references public.categories (id) on delete set null,
  title              text not null default '',
  question           text not null default '',
  question_media     jsonb not null default '[]',
  hint1              text not null default '',
  hint1_media        jsonb not null default '[]',
  hint2              text not null default '',
  hint2_media        jsonb not null default '[]',
  answer             numeric,
  answer_unit        text not null default '',
  answer_display     text not null default '',
  explanation        text not null default '',
  explanation_media  jsonb not null default '[]',
  notes              text not null default '',
  source             text not null default '',
  status             text not null default 'draft' check (status in ('draft', 'ready')),
  played_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index questions_owner_category_idx on public.questions (owner_id, category_id);

create trigger questions_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Spielabende
-- blind_levels: [{"small":10,"big":20},{"small":20,"big":40},...]
-- state: aktueller Ablauf (Phase, aktuelle Frage, ...) – wird in Etappe 3/4 befüllt
-- ---------------------------------------------------------------------------
create table public.games (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  room_code            text not null unique,
  name                 text not null default '',
  blind_levels         jsonb not null default '[{"small":10,"big":20}]',
  questions_per_level  int  not null default 3 check (questions_per_level > 0),
  current_level        int  not null default 0,
  state                jsonb not null default '{}',
  started_at           timestamptz not null default now(),
  finished_at          timestamptz,
  -- Wer gerade am Tisch sitzt (kann sich während des Abends ändern)
  player_ids           uuid[] not null default '{}'
);

-- Welche Fragen an einem Abend gespielt wurden (in Reihenfolge)
create table public.game_questions (
  game_id      uuid not null references public.games (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  position     int  not null,
  played_at    timestamptz not null default now(),
  -- Wer bei dieser Frage dabei war. Leer = unbekannt (gilt dann für alle als gespielt).
  player_ids   uuid[] not null default '{}',
  primary key (game_id, question_id)
);

-- Spieler (nur Namen – für "Wer kennt welche Frage schon?")
create table public.players (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.categories     enable row level security;
alter table public.questions      enable row level security;
alter table public.games          enable row level security;
alter table public.game_questions enable row level security;
alter table public.players        enable row level security;

create policy "own categories" on public.categories
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "own questions" on public.questions
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "own games" on public.games
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "own players" on public.players
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "own game questions" on public.game_questions
  for all to authenticated
  using (exists (select 1 from public.games g where g.id = game_id and g.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.games g where g.id = game_id and g.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Bilder-Speicher
-- Öffentlich lesbar (zufällige Dateinamen), damit der Präsentations-Bildschirm
-- ohne Login Bilder anzeigen kann. Hochladen/Löschen nur im eigenen Ordner.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Lesen über die API ist für Löschen/Überschreiben nötig
create policy "media read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
