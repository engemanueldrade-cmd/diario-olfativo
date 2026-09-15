import { createClient } from "@supabase/supabase-js";

// A chave service_role tem acesso total ao banco e ignora RLS — por isso só
// pode ser usada aqui, no servidor (rotas de API), NUNCA em código que roda
// no navegador. Ela não leva o prefixo NEXT_PUBLIC_ propositalmente.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn(
    "[db] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes. Conecte um projeto Supabase e configure as variáveis de ambiente."
  );
}

export const supabase =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

// Converte uma linha do Postgres (snake_case) para o formato usado pelo
// frontend e pela API (camelCase).
export function rowToPerfume(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    perfumer: row.perfumer,
    year: row.year,
    family: row.family,
    top: row.top || [],
    heart: row.heart || [],
    base: row.base || [],
    externalSource: row.external_source,
    externalRating: row.external_rating != null ? Number(row.external_rating) : null,
    externalRatingCount: row.external_rating_count,
    externalUrl: row.external_url,
    myScore: row.my_score != null ? Number(row.my_score) : null,
    myNotes: row.my_notes || [],
    myImpression: row.my_impression,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Converte o corpo recebido da API (camelCase) para colunas do Postgres.
export function perfumeToRow(p) {
  const row = { id: p.id };
  if (p.name !== undefined) row.name = p.name;
  if (p.brand !== undefined) row.brand = p.brand;
  if (p.perfumer !== undefined) row.perfumer = p.perfumer;
  if (p.year !== undefined) row.year = p.year;
  if (p.family !== undefined) row.family = p.family;
  if (p.top !== undefined) row.top = p.top;
  if (p.heart !== undefined) row.heart = p.heart;
  if (p.base !== undefined) row.base = p.base;
  if (p.externalSource !== undefined) row.external_source = p.externalSource;
  if (p.externalRating !== undefined) row.external_rating = p.externalRating;
  if (p.externalRatingCount !== undefined) row.external_rating_count = p.externalRatingCount;
  if (p.externalUrl !== undefined) row.external_url = p.externalUrl;
  if (p.myScore !== undefined) row.my_score = p.myScore;
  if (p.myNotes !== undefined) row.my_notes = p.myNotes;
  if (p.myImpression !== undefined) row.my_impression = p.myImpression;
  if (p.createdAt !== undefined) row.created_at = p.createdAt;
  if (p.updatedAt !== undefined) row.updated_at = p.updatedAt;
  return row;
}
