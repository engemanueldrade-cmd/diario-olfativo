import { NextResponse } from "next/server";
import { COOKIE_NAME, MAX_AGE_SECONDS, createSessionCookieValue } from "@/lib/auth";

export async function POST(request) {
  const secret = process.env.SITE_PASSWORD;
  if (!secret) {
    return NextResponse.json({ error: "SITE_PASSWORD não configurada no servidor." }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (body.password !== secret) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const value = await createSessionCookieValue(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
