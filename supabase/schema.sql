-- Rode isto uma vez no SQL Editor do seu projeto Supabase
-- (Supabase Dashboard → SQL Editor → New query → colar e Run).

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

-- RLS ligado e sem nenhuma política: a chave pública (anon) não enxerga nada.
-- Só a service_role key (usada apenas no servidor, nas rotas de API) acessa
-- a tabela — ela ignora RLS por padrão.
alter table perfumes enable row level security;
