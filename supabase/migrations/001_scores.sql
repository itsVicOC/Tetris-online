create table if not exists public.scores (
  id bigint generated always as identity primary key,
  game_id uuid not null unique,
  player_id uuid not null,
  nickname varchar(16) not null check (char_length(nickname) between 2 and 16),
  score integer not null check (score >= 0),
  level integer not null check (level >= 1),
  lines integer not null check (lines >= 0),
  duration_ms integer not null check (duration_ms between 1000 and 86400000),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists scores_rank_idx on public.scores (score desc, lines desc, created_at asc);
create index if not exists scores_player_idx on public.scores (player_id, score desc);
alter table public.scores enable row level security;
create or replace view public.leaderboard with (security_invoker = false) as
select game_id, player_id, nickname, score, level, lines, created_at
from (
  select game_id, player_id, nickname, score, level, lines, created_at,
    row_number() over (partition by player_id order by score desc, lines desc, created_at asc) as rank_for_player
  from public.scores where verified = true
) ranked where rank_for_player = 1
order by score desc, lines desc, created_at asc;
revoke all on public.scores from anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
