import { NextResponse } from "next/server";
import { redis } from "@/lib/db";
import seed from "@/data/seed.json";

const KEY = "perfumes";

async function getAll() {
  if (!redis) return seed;
  const data = await redis.get(KEY);
  if (data == null) {
    await redis.set(KEY, seed);
    return seed;
  }
  return data;
}

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

export async function GET() {
  const perfumes = await getAll();
  return NextResponse.json({ perfumes });
}

export async function POST(request) {
  if (!redis) {
    return NextResponse.json(
      { error: "Banco de dados não configurado (variáveis de ambiente do Redis ausentes)." },
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

  const perfumes = await getAll();
  const now = Date.now();
  let record;

  if (body.id) {
    const idx = perfumes.findIndex((p) => p.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: "Perfume não encontrado" }, { status: 404 });
    }
    record = { ...perfumes[idx], ...body, updatedAt: now };
    perfumes[idx] = record;
  } else {
    const base = slugify(`${body.name}-${body.brand || ""}`);
    const existingIds = new Set(perfumes.map((p) => p.id));
    const id = uniqueId(base, existingIds);
    record = { ...body, id, createdAt: now, updatedAt: now };
    perfumes.push(record);
  }

  await redis.set(KEY, perfumes);
  return NextResponse.json({ perfume: record });
}
