# Europa in Flames — Napoleonic Wargame

Multiplayer turn-based alt-history wargame. Players submit free-text orders, Claude resolves as referee.

## Setup

### 1. Supabase tables

Run this in the Supabase SQL Editor:

```sql
create table if not exists game (
  id int primary key default 1,
  turn int default 1,
  state jsonb default '{}'::jsonb,
  narrative text default '',
  updated_at timestamp default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  turn int not null,
  faction text not null,
  player_name text,
  order_text text not null,
  submitted_at timestamp default now()
);

alter table game enable row level security;
alter table orders enable row level security;

drop policy if exists "p_game" on game;
drop policy if exists "p_orders" on orders;
create policy "p_game" on game for all using (true) with check (true);
create policy "p_orders" on orders for all using (true) with check (true);
```

### 2. Environment variables

In Vercel project settings → Environment Variables, add:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_KEY` — your Supabase anon public key
- `ANTHROPIC_API_KEY` — get from console.anthropic.com (server-side only, never exposed)

### 3. Local dev

```bash
npm install
# Create .env.local with the three vars above
npm run dev
```

### 4. Deploy

```bash
git init && git add . && git commit -m "initial"
# Push to GitHub, import to Vercel
```

## How to play

1. Open the app, type your name, claim a faction
2. Write free-text orders each turn
3. When all players have submitted, the referee (or anyone) unlocks the referee panel and resolves
4. Claude reads all orders, applies historical realism, returns chronicle + updated state
5. Next turn begins

Refresh runs every 5 seconds so all players see live state.

## Reset the game

Run this in Supabase SQL Editor:

```sql
delete from orders;
delete from game;
```

App will auto-create a fresh game on next load.
