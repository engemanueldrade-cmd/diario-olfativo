import { NextResponse } from "next/server";
import { redis } from "@/lib/db";

const KEY = "perfumes";

export async function DELETE(_request, { params }) {
  if (!redis) {
    return NextResponse.json(
      { error: "Banco de dados não configurado (variáveis de ambiente do Redis ausentes)." },
      { status: 500 }
    );
  }
  const { id } = await params;
  const perfumes = (await redis.get(KEY)) || [];
  const next = perfumes.filter((p) => p.id !== id);
  if (next.length === perfumes.length) {
    return NextResponse.json({ error: "Perfume não encontrado" }, { status: 404 });
  }
  await redis.set(KEY, next);
  return NextResponse.json({ ok: true });
}
