import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function DELETE(_request, { params }) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Banco de dados não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes)." },
      { status: 500 }
    );
  }
  const { id } = await params;
  const { data, error } = await supabase.from("perfumes").delete().eq("id", id).select();
  if (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Perfume não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
