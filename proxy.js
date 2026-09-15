import { NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|login).*)"],
};

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // A própria rota de login precisa ficar acessível sem estar autenticado.
  if (pathname === "/api/login") return NextResponse.next();

  const secret = process.env.SITE_PASSWORD;
  if (!secret) {
    // Sem senha configurada: o site fica aberto (modo antigo). Evita travar
    // quem ainda não configurou a variável de ambiente.
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  const valid = await verifySessionCookieValue(cookie, secret);
  if (valid) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
