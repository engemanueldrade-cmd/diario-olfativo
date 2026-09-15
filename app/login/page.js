"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível entrar.");
        return;
      }
      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form onSubmit={submit} className="modal" style={{ maxWidth: 360, margin: 0 }}>
        <span className="eyebrow">Coleção pessoal</span>
        <h1 style={{ fontSize: "1.7rem", fontStyle: "italic", marginTop: 6, marginBottom: 18 }}>Diário Olfativo</h1>
        <label>
          Senha
          <input
            className="field-input"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="search-status error" style={{ marginTop: 8 }}>{error}</div>}
        <button className="btn primary" type="submit" disabled={loading || !password} style={{ marginTop: 16, width: "100%" }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="wrap">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
