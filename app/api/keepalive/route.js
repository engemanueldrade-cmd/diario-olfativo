import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// Executado automaticamente pelo Vercel Cron (ver vercel.json) para gerar
// atividade real no banco do Supabase e evitar a pausa automática por
// inatividade do plano gratuito (que ocorre após 7 dias sem uso).
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 500 });
  }

  const { error } = await supabase.from("perfumes").select("id").limit(1);
  return NextResponse.json({ ok: !error, error: error?.message ?? null, timestamp: new Date().toISOString() });
}
