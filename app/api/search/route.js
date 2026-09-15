import { NextResponse } from "next/server";
import { incrementSearchUsage } from "@/lib/db";

const FRAGELLA_BASE = "https://api.fragella.com/api/v1";
const MONTHLY_LIMIT = parseInt(process.env.FRAGELLA_MONTHLY_LIMIT, 10) || 20;

// A Fragella às vezes varia o formato das chaves entre versões da API —
// por isso cada campo tenta algumas variações plausíveis antes de desistir.
function pickNotes(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((n) => (typeof n === "string" ? n : n && (n.name || n.Name)))
    .filter(Boolean);
}

function normalize(item) {
  const notes = item.Notes || item.notes || {};
  return {
    externalId: item._id || item.id || null,
    name: item.Name || item.name || "",
    brand: item.Brand || item.brand || "",
    year: item.Year || item.year || null,
    accords: item["Main Accords"] || item.mainAccords || item.accords || [],
    top: pickNotes(notes.Top || notes.top),
    heart: pickNotes(notes.Middle || notes.middle || notes.Heart || notes.heart),
    base: pickNotes(notes.Base || notes.base),
    rating:
      item.rating != null && item.rating !== "" ? Number(item.rating) : null,
    imageUrl: item["Image URL"] || item.imageUrl || null,
    sourceUrl: item["Purchase URL"] || item.purchaseUrl || null,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "Informe um nome para buscar" }, { status: 400 });
  }

  const apiKey = process.env.FRAGELLA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FRAGELLA_API_KEY não configurada no servidor (variável de ambiente ausente)." },
      { status: 500 }
    );
  }

  const url = `${FRAGELLA_BASE}/fragrances?search=${encodeURIComponent(q)}&limit=6`;
  let res;
  try {
    res = await fetch(url, { headers: { "x-api-key": apiKey } });
  } catch (err) {
    return NextResponse.json({ error: "Falha de rede ao contatar a Fragella." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `A Fragella respondeu ${res.status}.`, detail: detail.slice(0, 500) },
      { status: 502 }
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Resposta da Fragella não é um JSON válido." }, { status: 502 });
  }

  const list = Array.isArray(data) ? data : data.results || data.fragrances || data.data || [];
  const results = list.map(normalize);

  const usage = await incrementSearchUsage();
  return NextResponse.json({
    results,
    usage: usage ? { ...usage, limit: MONTHLY_LIMIT } : null,
  });
}
