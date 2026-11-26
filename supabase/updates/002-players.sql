-- Update 002: Spieler pro Spielabend.
-- Merkt sich, wer bei welcher Frage dabei war. So zeigt ein späterer Abend
-- nur Fragen, die alle Spieler am Tisch noch nicht kennen.
-- Einmalig im Supabase SQL Editor ausführen (nur nötig, wenn schema.sql vor diesem Update eingespielt wurde).

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

alter table public.players enable row level security;

create policy "own players" on public.players
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Wer gerade am Tisch sitzt (kann sich während des Abends ändern)
alter table public.games add column player_ids uuid[] not null default '{}';

-- Wer bei dieser Frage dabei war. Leer = unbekannt (gilt dann für alle als gespielt).
alter table public.game_questions add column player_ids uuid[] not null default '{}';
