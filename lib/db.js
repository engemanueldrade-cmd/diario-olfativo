import { Redis } from "@upstash/redis";

// Aceita tanto as variáveis novas do Upstash (UPSTASH_REDIS_REST_*) quanto
// as antigas usadas pela integração "Vercel KV" (KV_REST_API_*), para
// funcionar com qualquer uma das duas formas de conectar o banco na Vercel.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  // Erra de forma clara em vez de falhar silenciosamente numa rota de API.
  console.warn(
    "[db] Nenhuma variável de banco encontrada (UPSTASH_REDIS_REST_URL/TOKEN ou KV_REST_API_URL/TOKEN). " +
      "Conecte um banco Redis/KV ao projeto na Vercel."
  );
}

export const redis = url && token ? new Redis({ url, token }) : null;
