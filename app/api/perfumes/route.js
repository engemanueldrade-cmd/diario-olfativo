import { NextResponse } from "next/server";
import { supabase, rowToPerfume, perfumeToRow } from "@/lib/db";
import seed from "@/data/seed.json";

function slugify(s) {
  return (
    (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "perfume"
  );
}

function uniqueId(base, existingIds) {
  let candidate = base;
  let n = 1;
  while (existingIds.has(candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

async function seedIfEmpty() {
  const { count, error } = await supabase.from("perfumes").select("id", { count: "exact", head: true });
  if (error) throw error;
  if (count === 0) {
    const rows = seed.map(perfumeToRow);
    const { error: insertError } = await supabase.from("perfumes").insert(rows);
    if (insertError) throw insertError;
  }
}

export async function GET() {
  if (!supabase) {
    // Sem banco conectado ainda: mostra os dados de exemplo, mas avisa que não vai salvar.
    return NextResponse.json({ perfumes: seed, readOnly: true });
  }
  try {
    await seedIfEmpty();
    const { data, error } = await supabase.from("perfumes").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ perfumes: data.map(rowToPerfume) });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Banco de dados não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes)." },
      { status: 500 }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.name || !body.name.toString().trim()) {
    return NextResponse.json({ error: "O nome do perfume é obrigatório" }, { status: 400 });
  }

  const now = Date.now();

  try {
    if (body.id) {
      const { data: existingRows, error: fetchError } = await supabase
        .from("perfumes")
        .select("id")
        .eq("id", body.id)
        .limit(1);
      if (fetchError) throw fetchError;
      if (!existingRows || existingRows.length === 0) {
        return NextResponse.json({ error: "Perfume não encontrado" }, { status: 404 });
      }
      const row = perfumeToRow({ ...body, updatedAt: now });
      const { data, error } = await supabase.from("perfumes").update(row).eq("id", body.id).select().single();
      if (error) throw error;
      return NextResponse.json({ perfume: rowToPerfume(data) });
    }

    const { data: allIds, error: idsError } = await supabase.from("perfumes").select("id");
    if (idsError) throw idsError;
    const existingIds = new Set((allIds || []).map((r) => r.id));
    const id = uniqueId(slugify(`${body.name}-${body.brand || ""}`), existingIds);

    const row = perfumeToRow({ ...body, id, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from("perfumes").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ perfume: rowToPerfume(data) });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
