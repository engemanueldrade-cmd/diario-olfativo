import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// Sempre executa de verdade (nunca devolve resposta em cache).
export const dynamic = "force-dynamic";

// Chamado pelo GitHub Actions (repo diario-olfativo) para gerar atividade real
// no banco do Supabase e evitar a pausa por inatividade do plano gratuito.
// Tenta primeiro GRAVAR um registro na tabela `keepalive` (atividade
// inequívoca); se a tabela ainda não existir, cai para uma leitura simples.
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 500 });
  }

  const timestamp = new Date().toISOString();

  const { error: writeError } = await supabase
    .from("keepalive")
    .upsert({ id: 1, last_ping: timestamp }, { onConflict: "id" });
  if (!writeError) {
    return NextResponse.json({ ok: true, mode: "write", error: null, timestamp });
  }

  const { error: readError } = await supabase.from("perfumes").select("id").limit(1);
  return NextResponse.json({
    ok: !readError,
    mode: "read",
    error: readError?.message ?? null,
    writeError: writeError.message,
    timestamp,
  });
}
