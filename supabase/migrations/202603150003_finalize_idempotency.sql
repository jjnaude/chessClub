-- Ensure finalize retries cannot duplicate history rows for the same round pairing.

create unique index if not exists idx_pairing_history_round_pair_unique
  on public.pairing_history(round_id, white_player_id, black_player_id);
