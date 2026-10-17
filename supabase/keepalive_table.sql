-- Tabela de "batimento cardíaco" para o keep-alive do Supabase.
-- Rode no SQL Editor de CADA projeto Supabase que recebeu aviso de pausa
-- (Planejador de Casamento e Administração de Usinas). É seguro: cria só uma
-- tabela nova com UMA linha que guarda a data do último ping. Não toca nos
-- seus dados. Rodar este script já conta como atividade no banco.

create table if not exists public.keepalive (
  id int primary key default 1,
  last_ping timestamptz not null default now(),
  constraint keepalive_single_row check (id = 1)
);

alter table public.keepalive enable row level security;

drop policy if exists "keepalive_select" on public.keepalive;
create policy "keepalive_select" on public.keepalive for select to anon using (id = 1);

drop policy if exists "keepalive_insert" on public.keepalive;
create policy "keepalive_insert" on public.keepalive for insert to anon with check (id = 1);

drop policy if exists "keepalive_update" on public.keepalive;
create policy "keepalive_update" on public.keepalive for update to anon using (id = 1) with check (id = 1);

-- Conferência: deve retornar 0 linhas agora (a primeira linha é criada no primeiro ping)
select count(*) as linhas from public.keepalive;
