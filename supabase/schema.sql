-- Rode isto no SQL Editor do seu projeto Supabase
-- (Supabase Dashboard → SQL Editor → New query → colar e Run).
-- Seguro para rodar de novo: usa "if not exists" em tudo, então não duplica
-- nem quebra nada se a tabela já existir de uma versão anterior do app.

create table if not exists perfumes (
  id text primary key,
  name text not null,
  brand text,
  perfumer text,
  year integer,
  family text,
  top jsonb default '[]'::jsonb,
  heart jsonb default '[]'::jsonb,
  base jsonb default '[]'::jsonb,
  external_source text,
  external_rating numeric,
  external_rating_count integer,
  external_url text,
  my_score numeric,
  my_notes jsonb default '[]'::jsonb,
  my_impression text,
  created_at bigint,
  updated_at bigint
);

-- Campos adicionados depois da primeira versão do app.
alter table perfumes add column if not exists image_url text;
alter table perfumes add column if not exists volume text;
alter table perfumes add column if not exists climate jsonb default '[]'::jsonb;
alter table perfumes add column if not exists occasion jsonb default '[]'::jsonb;
alter table perfumes add column if not exists alerts text;

-- Contador de buscas na Fragella por mês (o plano free tem um limite mensal).
create table if not exists api_usage (
  month text primary key,
  search_count integer not null default 0
);

-- RLS ligado e sem nenhuma política: a chave pública (anon) não enxerga nada.
-- Só a service_role key (usada apenas no servidor, nas rotas de API) acessa
-- as tabelas — ela ignora RLS por padrão.
alter table perfumes enable row level security;
alter table api_usage enable row level security;
