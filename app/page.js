"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function splitList(s) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function scoreOptions() {
  const opts = [];
  for (let v = 0; v <= 5; v += 0.5) opts.push(v);
  return opts;
}

const STATUS_OPTIONS = [
  { value: "possuo_split", label: "Possuo Split", icon: "🧪", kind: "possuo" },
  { value: "possuo_frasco", label: "Possuo Frasco", icon: "🧴", kind: "possuo" },
  { value: "desejo_split", label: "Desejo Split", icon: "✨", kind: "desejo" },
  { value: "desejo_frasco", label: "Desejo Frasco", icon: "🎁", kind: "desejo" },
];

function statusInfo(status) {
  return STATUS_OPTIONS.find((s) => s.value === status) || null;
}

function normalizeName(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TOAST_MS = 6000;

const SORT_OPTIONS = [
  { value: "my_score_desc", label: "Minha nota" },
  { value: "name_asc", label: "Nome (A–Z)" },
  { value: "brand_asc", label: "Marca (A–Z)" },
  { value: "year_desc", label: "Ano (recente)" },
  { value: "created_desc", label: "Adicionados recentemente" },
];

// Cor do cartão sem foto, derivada do primeiro acorde reconhecido.
const FAMILY_HUES = [
  [/citr|lemon|bergamot|orange|grapefruit/, 48],
  [/aquat|marine|fresh|ozon|water|salt|sea/, 195],
  [/fruit|berry|peach|apple|cherry|plum/, 355],
  [/rose|floral|flower|iris|violet|jasmin|peony|lily|tuberose/, 335],
  [/vanill|sweet|gourmand|caramel|honey|tonka|oriental|amber|balsam|coffee|chocolate/, 22],
  [/spic|cinnam|pepper|saffron|cardamom/, 8],
  [/leather|tobacco|smok|oud|incense|resin|animal/, 15],
  [/green|herb|aromatic|lavender|mint|fougere|tea/, 135],
  [/powder/, 290],
  [/musk/, 305],
  [/earth|moss|patchouli|mineral|chypre|oakmoss/, 95],
  [/wood|cedar|sandal|vetiver|cypress/, 30],
];

function familyHue(family) {
  const accords = splitList(family).map((a) => normalizeName(a));
  for (const a of accords) {
    for (const [re, hue] of FAMILY_HUES) if (re.test(a)) return hue;
  }
  let h = 0;
  const s = family || "";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function coverStyle(d) {
  return { "--h": familyHue(d.family) };
}

function coverInitial(d) {
  const src = (d.brand || d.name || "?").trim();
  return src.charAt(0).toUpperCase();
}

function matchesStatus(d, f) {
  if (!f) return true;
  if (f === "none") return !d.status;
  if (f === "possuo" || f === "desejo") {
    const info = statusInfo(d.status);
    return Boolean(info) && info.kind === f;
  }
  return d.status === f;
}

function statusFilterLabel(f) {
  if (f === "none") return "Não possuo";
  if (f === "possuo") return "Todos que possuo";
  if (f === "desejo") return "Todos que desejo";
  const info = statusInfo(f);
  return info ? `${info.icon} ${info.label}` : f;
}

export default function Page() {
  const [perfumes, setPerfumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [usage, setUsage] = useState(null);

  const [search, setSearch] = useState("");
  const [filterFamily, setFilterFamily] = useState("");
  const [filterNote, setFilterNote] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("my_score_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState("grid");

  const [modal, setModal] = useState(null); // { mode: 'view'|'form', perfume, autoSearch?, initialName? }
  const [toast, setToast] = useState(null); // { id, message, action? }
  const toastTimer = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("diario_view");
      if (saved === "grid" || saved === "list") setView(saved);
    } catch {}
  }, []);

  function changeView(v) {
    setView(v);
    try {
      localStorage.setItem("diario_view", v);
    } catch {}
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/perfumes")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setLoadError(data.error);
        else {
          setPerfumes(data.perfumes || []);
          setReadOnly(Boolean(data.readOnly));
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setUsage(data.usage || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(message, action) {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, action });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  function dismissToast() {
    clearTimeout(toastTimer.current);
    setToast(null);
  }

  const families = useMemo(
    () => Array.from(new Set(perfumes.map((p) => p.family).filter(Boolean))).sort(),
    [perfumes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const noteQ = filterNote.trim().toLowerCase();
    let list = perfumes.filter((d) => {
      if (q) {
        const hay = `${d.name || ""} ${d.brand || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterFamily && d.family !== filterFamily) return false;
      if (!matchesStatus(d, filterStatus)) return false;
      if (noteQ) {
        const allNotes = [...(d.top || []), ...(d.heart || []), ...(d.base || []), ...(d.myNotes || [])]
          .join(" | ")
          .toLowerCase();
        if (!allNotes.includes(noteQ)) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return (a.name || "").localeCompare(b.name || "");
        case "year_desc":
          return (b.year || 0) - (a.year || 0);
        case "brand_asc":
          return (a.brand || "").localeCompare(b.brand || "");
        case "created_desc":
          return (b.createdAt || 0) - (a.createdAt || 0);
        case "my_score_desc":
        default: {
          const av = typeof a.myScore === "number" ? a.myScore : -1;
          const bv = typeof b.myScore === "number" ? b.myScore : -1;
          return bv - av;
        }
      }
    });
    return list;
  }, [perfumes, search, filterFamily, filterNote, filterStatus, sortBy]);

  const stats = useMemo(() => {
    const total = perfumes.length;
    const scored = perfumes.filter((d) => typeof d.myScore === "number");
    const avg = scored.length ? scored.reduce((a, d) => a + d.myScore, 0) / scored.length : null;
    const famCount = {};
    perfumes.forEach((d) => {
      if (d.family) famCount[d.family] = (famCount[d.family] || 0) + 1;
    });
    let topFam = null;
    let topN = 0;
    Object.keys(famCount).forEach((f) => {
      if (famCount[f] > topN) {
        topN = famCount[f];
        topFam = f;
      }
    });
    const statusCount = {};
    STATUS_OPTIONS.forEach((s) => {
      statusCount[s.value] = perfumes.filter((d) => d.status === s.value).length;
    });
    return { total, avg, topFam, statusCount };
  }, [perfumes]);

  // "Já tenho?": o que a busca atual diz sobre posse, independente dos outros filtros.
  const lookup = useMemo(() => {
    const q = normalizeName(search);
    if (q.length < 2) return null;
    return perfumes.filter((p) => normalizeName(`${p.name} ${p.brand || ""}`).includes(q));
  }, [perfumes, search]);

  const activeTags = [];
  if (filterFamily) activeTags.push({ key: "family", label: filterFamily, clear: () => setFilterFamily("") });
  if (filterStatus) activeTags.push({ key: "status", label: statusFilterLabel(filterStatus), clear: () => setFilterStatus("") });
  if (filterNote.trim()) activeTags.push({ key: "note", label: `Nota: ${filterNote.trim()}`, clear: () => setFilterNote("") });

  function clearFilters() {
    setFilterFamily("");
    setFilterStatus("");
    setFilterNote("");
  }

  function clearAll() {
    clearFilters();
    setSearch("");
  }

  function openNew(name, autoSearch) {
    setModal({ mode: "form", perfume: null, initialName: name || "", autoSearch: Boolean(autoSearch) });
  }

  function goTab(status) {
    setFilterStatus(status);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const currentTab = !filterStatus
    ? "all"
    : filterStatus === "possuo" || filterStatus.startsWith("possuo_")
    ? "possuo"
    : filterStatus === "desejo" || filterStatus.startsWith("desejo_")
    ? "desejo"
    : "other";

  // Navegação entre perfumes dentro do detalhe (segue a lista filtrada/ordenada).
  const viewIndex =
    modal && modal.mode === "view" ? filtered.findIndex((p) => p.id === modal.perfume.id) : -1;

  function navigateDetail(delta) {
    if (viewIndex < 0) return;
    const next = filtered[viewIndex + delta];
    if (next) setModal({ mode: "view", perfume: next });
  }

  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (modal.mode !== "view") return;
      if (e.key === "Escape") {
        setModal(null);
        return;
      }
      const tag = ((e.target && e.target.tagName) || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowLeft") navigateDetail(-1);
      if (e.key === "ArrowRight") navigateDetail(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, filtered]);

  useEffect(() => {
    if (!modal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [Boolean(modal)]);

  async function saveDoc(body) {
    const res = await fetch("/api/perfumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Erro ao salvar.");
      return false;
    }
    setPerfumes((prev) => {
      const idx = prev.findIndex((p) => p.id === data.perfume.id);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = data.perfume;
        return copy;
      }
      return [...prev, data.perfume];
    });
    showToast(`"${data.perfume.name}" salvo ✓`);
    return true;
  }

  async function quickUpdateStatus(id, name, status, { silent } = {}) {
    // Atualização otimista: reflete na tela antes da resposta do servidor,
    // e desfaz se a chamada falhar.
    const prev = perfumes;
    const before = perfumes.find((p) => p.id === id);
    setPerfumes((list) => list.map((p) => (p.id === id ? { ...p, status } : p)));
    const res = await fetch("/api/perfumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, status }),
    });
    if (!res.ok) {
      setPerfumes(prev);
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Erro ao atualizar status.");
      return;
    }
    if (!silent) {
      const info = statusInfo(status);
      const oldStatus = before ? before.status || null : null;
      showToast(`${name} → ${info ? info.label : "Não possuo"} ✓`, {
        label: "Desfazer",
        onClick: () => quickUpdateStatus(id, name, oldStatus, { silent: true }),
      });
    }
  }

  async function deleteDoc(id, name) {
    if (!confirm(`Excluir "${name}" da coleção?`)) return;
    const target = perfumes.find((p) => p.id === id);
    const res = await fetch(`/api/perfumes/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Erro ao excluir.");
      return;
    }
    setPerfumes((prev) => prev.filter((p) => p.id !== id));
    setModal(null);
    if (target) {
      showToast(`"${target.name}" excluído.`, { label: "Desfazer", onClick: () => undoDelete(target) });
    }
  }

  async function undoDelete(perfume) {
    dismissToast();
    const res = await fetch("/api/perfumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(perfume),
    });
    const data = await res.json();
    if (res.ok) {
      setPerfumes((prev) => [...prev, data.perfume]);
    } else {
      alert(data.error || "Não foi possível desfazer a exclusão.");
    }
  }

  // Gestos no celular: deslizar para os lados navega, arrastar a alça para baixo fecha.
  const touchRef = useRef(null);
  function onTouchStart(e) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || !modal || modal.mode !== "view") return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) navigateDetail(dx < 0 ? 1 : -1);
  }
  function onHandleTouchEnd(e) {
    const start = touchRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    if (t.clientY - start.y > 70) {
      touchRef.current = null;
      setModal(null);
    }
  }

  const quotaPct = usage && usage.limit ? Math.min(100, Math.round((usage.count / usage.limit) * 100)) : 0;

  return (
    <div className="wrap">
      <header className="top">
        <div className="brandmark">
          <span className="eyebrow">Coleção pessoal</span>
          <h1>Diário Olfativo</h1>
        </div>
        <div className="stats">
          <Stat v={stats.total} l="Perfumes" mono />
          <Stat v={stats.avg != null ? stats.avg.toFixed(1) : "—"} l="Nota média" mono />
          <Stat
            v={stats.topFam || "—"}
            l="Família favorita"
            active={Boolean(stats.topFam) && filterFamily === stats.topFam}
            onClick={
              stats.topFam
                ? () => setFilterFamily((f) => (f === stats.topFam ? "" : stats.topFam))
                : undefined
            }
          />
        </div>
        <div className="status-chips">
          {STATUS_OPTIONS.map((s) => (
            <button
              type="button"
              key={s.value}
              className={`status-chip ${s.kind}${filterStatus === s.value ? " on" : ""}`}
              onClick={() => setFilterStatus((v) => (v === s.value ? "" : s.value))}
            >
              {s.icon} {s.label} <span className="num">{stats.statusCount[s.value] || 0}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="info-row">
        <details className="howto">
          <summary>Como funciona a busca automática</summary>
          <p>
            Em <b>+ Novo</b>, digite o nome e clique em <b>Buscar dados</b>: o site consulta a API da
            Fragella (mais de 74 mil fragrâncias) e preenche marca, ano, pirâmide de notas, acordes e
            avaliação. Depois é só completar sua nota, as notas que sentiu e sua impressão.
          </p>
        </details>
        {usage && (
          <div
            className={`quota${usage.count >= usage.limit ? " full" : ""}`}
            title="Buscas na Fragella usadas neste mês"
          >
            <span className="quota-bar">
              <span style={{ width: `${quotaPct}%` }} />
            </span>
            <span className="num">
              {usage.count}/{usage.limit}
            </span>
            <span>buscas este mês</span>
          </div>
        )}
      </div>

      {loadError && <div className="hint" style={{ borderColor: "var(--danger)" }}>Erro ao carregar: {loadError}</div>}
      {readOnly && (
        <div className="hint" style={{ borderColor: "var(--gold)" }}>
          <b>Banco de dados ainda não conectado.</b> Você está vendo os dados de exemplo, mas nada será
          salvo até que o Supabase seja configurado nas variáveis de ambiente do servidor.
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-row">
          <div className="searchbox">
            <span className="searchbox-icon" aria-hidden="true">
              🔎
            </span>
            <input
              id="search"
              className="field-input"
              type="search"
              placeholder="Já tenho? Busque por nome ou marca…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="searchbox-clear" onClick={() => setSearch("")} aria-label="Limpar busca">
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            className={`btn filter-btn${filtersOpen ? " on" : ""}`}
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            ⚙︎ Filtros
            {activeTags.length > 0 && <span className="count-badge">{activeTags.length}</span>}
          </button>
          <label className="sort-wrap">
            <span className="sort-label">Ordenar</span>
            <select className="field-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="view-toggle" role="group" aria-label="Modo de exibição">
            <button type="button" className={view === "grid" ? "on" : ""} onClick={() => changeView("grid")} title="Grade">
              ▦
            </button>
            <button type="button" className={view === "list" ? "on" : ""} onClick={() => changeView("list")} title="Lista compacta">
              ☰
            </button>
          </div>
          <button className="btn primary add-btn" onClick={() => openNew()}>
            + Novo
          </button>
        </div>

        {filtersOpen && (
          <div className="filter-panel">
            <label>
              Família olfativa
              <select className="field-input" value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}>
                <option value="">Todas</option>
                {families.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select className="field-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">Qualquer status</option>
                <option value="possuo">Todos que possuo</option>
                <option value="desejo">Todos que desejo</option>
                <option value="none">Não possuo</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.icon} {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nota olfativa
              <input
                className="field-input"
                type="text"
                placeholder="ex: baunilha"
                value={filterNote}
                onChange={(e) => setFilterNote(e.target.value)}
              />
            </label>
          </div>
        )}

        {activeTags.length > 0 && (
          <div className="active-tags">
            {activeTags.map((t) => (
              <button type="button" key={t.key} className="tag-chip" onClick={t.clear} title="Remover filtro">
                {t.label} <span aria-hidden="true">✕</span>
              </button>
            ))}
            <button type="button" className="link-btn" onClick={clearFilters}>
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {lookup && !loading && (
        <div className={`lookup ${lookup.length === 0 ? "none" : ""}`}>
          {lookup.length === 0 ? (
            <>
              <span>
                <b>&quot;{search.trim()}&quot;</b> não está na sua coleção.
              </span>
              <button type="button" className="btn small" onClick={() => openNew(search.trim())}>
                + Adicionar
              </button>
            </>
          ) : (
            <>
              {lookup.slice(0, 4).map((p) => {
                const info = statusInfo(p.status);
                return (
                  <button
                    type="button"
                    key={p.id}
                    className={`lookup-item ${info ? info.kind : "none"}`}
                    onClick={() => setModal({ mode: "view", perfume: p })}
                  >
                    <b>{p.name}</b>
                    <span>
                      {info
                        ? info.kind === "possuo"
                          ? `✅ ${info.label}`
                          : `${info.icon} ${info.label}`
                        : "Na coleção · não possuo"}
                    </span>
                  </button>
                );
              })}
              {lookup.length > 4 && <span className="lookup-more">+{lookup.length - 4} resultados</span>}
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className={view === "list" ? "list" : "grid"}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={view === "list" ? "row-item skeleton" : "card skeleton"} aria-hidden="true">
              <div className="sk-cover" />
              <div className="sk-line" />
              <div className="sk-line short" />
            </div>
          ))}
        </div>
      ) : perfumes.length === 0 ? (
        <div className="empty-state">
          <h3 style={{ fontStyle: "italic" }}>Nenhum perfume por aqui ainda</h3>
          <p>Comece adicionando o primeiro da sua coleção.</p>
          <button className="btn primary" onClick={() => openNew()}>
            + Novo perfume
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3 style={{ fontStyle: "italic" }}>Nada encontrado</h3>
          <p>Nenhum perfume bate com a busca e os filtros atuais.</p>
          <div className="empty-actions">
            <button className="btn" onClick={clearAll}>
              Limpar busca e filtros
            </button>
            {search.trim() && (
              <button className="btn primary" onClick={() => openNew(search.trim(), true)}>
                🔍 Buscar &quot;{search.trim()}&quot; na Fragella
              </button>
            )}
          </div>
        </div>
      ) : view === "list" ? (
        <div className="list">
          {filtered.map((d, i) => (
            <PerfumeRow
              key={d.id}
              d={d}
              index={i}
              onClick={() => setModal({ mode: "view", perfume: d })}
              onEdit={() => setModal({ mode: "form", perfume: d })}
              onStatusChange={(status) => quickUpdateStatus(d.id, d.name, status)}
            />
          ))}
        </div>
      ) : (
        <div className="grid">
          {filtered.map((d, i) => (
            <PerfumeCard
              key={d.id}
              d={d}
              index={i}
              onClick={() => setModal({ mode: "view", perfume: d })}
              onEdit={() => setModal({ mode: "form", perfume: d })}
              onStatusChange={(status) => quickUpdateStatus(d.id, d.name, status)}
            />
          ))}
        </div>
      )}

      <footer className="note">Seus dados ficam salvos neste site e sincronizam automaticamente.</footer>

      <nav className="bottom-nav" aria-label="Navegação principal">
        <button type="button" className={currentTab === "all" ? "on" : ""} onClick={() => goTab("")}>
          <span className="ic">📚</span>
          <span>Coleção</span>
        </button>
        <button type="button" className={currentTab === "possuo" ? "on" : ""} onClick={() => goTab("possuo")}>
          <span className="ic">🧴</span>
          <span>Tenho</span>
        </button>
        <button type="button" className="fab" onClick={() => openNew()} aria-label="Novo perfume">
          +
        </button>
        <button type="button" className={currentTab === "desejo" ? "on" : ""} onClick={() => goTab("desejo")}>
          <span className="ic">✨</span>
          <span>Desejos</span>
        </button>
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            const el = document.getElementById("search");
            if (el) el.focus({ preventScroll: true });
          }}
        >
          <span className="ic">🔎</span>
          <span>Buscar</span>
        </button>
      </nav>

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              className="btn small"
              onClick={() => {
                dismissToast();
                toast.action.onClick();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {modal && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="modal" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div
              className="sheet-handle"
              onTouchStart={onTouchStart}
              onTouchEnd={(e) => {
                e.stopPropagation();
                onHandleTouchEnd(e);
              }}
              onClick={() => setModal(null)}
              aria-hidden="true"
            >
              <span />
            </div>
            {modal.mode === "view" ? (
              <DetailView
                d={modal.perfume}
                position={viewIndex >= 0 ? { index: viewIndex, total: filtered.length } : null}
                onPrev={viewIndex > 0 ? () => navigateDetail(-1) : null}
                onNext={viewIndex >= 0 && viewIndex < filtered.length - 1 ? () => navigateDetail(1) : null}
                onClose={() => setModal(null)}
                onEdit={() => setModal({ mode: "form", perfume: modal.perfume })}
                onRefresh={() => setModal({ mode: "form", perfume: modal.perfume, autoSearch: true })}
                onDelete={() => deleteDoc(modal.perfume.id, modal.perfume.name)}
              />
            ) : (
              <FormView
                key={modal.perfume ? modal.perfume.id : "new"}
                existing={modal.perfume}
                initialName={modal.initialName}
                autoSearch={modal.autoSearch}
                allPerfumes={perfumes}
                usage={usage}
                onUsage={setUsage}
                onClose={() => setModal(null)}
                onSave={async (body) => {
                  const ok = await saveDoc(body);
                  if (ok) setModal(null);
                }}
                onSwitchExisting={(p) => setModal({ mode: "form", perfume: p })}
                onDelete={
                  modal.perfume ? () => deleteDoc(modal.perfume.id, modal.perfume.name) : null
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ v, l, mono, onClick, active }) {
  const content = (
    <>
      <span className={mono ? "v num" : "v"} style={!mono ? { fontSize: "1.05rem", fontStyle: "italic" } : undefined}>
        {v}
      </span>
      <span className="l">{l}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`stat clickable${active ? " on" : ""}`} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className="stat">{content}</div>;
}

function StatusMenu({ value, onChange, showLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const info = statusInfo(value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(v) {
    setOpen(false);
    if ((v || null) !== (value || null)) onChange(v);
  }

  return (
    <div className="status-menu" ref={ref}>
      <button
        type="button"
        className={`status-trigger ${info ? info.kind : "none"}${showLabel ? " with-label" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={info ? `${info.label} — clique para alterar` : "Definir status (possuo / desejo)"}
      >
        <span className="st-ic">{info ? info.icon : "＋"}</span>
        {showLabel && <span className="st-lbl">{info ? info.label : "Não possuo"}</span>}
      </button>
      {open && (
        <div className="status-pop" role="menu" onClick={(e) => e.stopPropagation()}>
          <button type="button" role="menuitem" className={!value ? "cur" : ""} onClick={() => pick(null)}>
            <span className="st-ic">∅</span> Não possuo
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              type="button"
              role="menuitem"
              key={s.value}
              className={`${s.kind}${value === s.value ? " cur" : ""}`}
              onClick={() => pick(s.value)}
            >
              <span className="st-ic">{s.icon}</span> {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function pyramidRow(tag, arr) {
  if (!arr || !arr.length) return null;
  return (
    <div className="row" key={tag}>
      <span className="tag">{tag}</span>
      <span className="notes">{arr.join(", ")}</span>
    </div>
  );
}

function Cover({ d, className }) {
  return d.imageUrl ? (
    <div className={`cover has-img ${className || ""}`}>
      <img src={d.imageUrl} alt="" loading="lazy" />
    </div>
  ) : (
    <div className={`cover fallback ${className || ""}`} style={coverStyle(d)} aria-hidden="true">
      <span>{coverInitial(d)}</span>
    </div>
  );
}

function AccordPills({ family, max }) {
  const list = splitList(family).slice(0, max);
  if (!list.length) return null;
  return (
    <div className="pill-row">
      {list.map((a, i) => (
        <span key={a} className={`pill${i === 0 ? " family" : ""}`}>
          {a}
        </span>
      ))}
    </div>
  );
}

function ScoreBadge({ score, small }) {
  return typeof score === "number" ? (
    <div className={`score-badge${small ? " sm" : ""}`}>{score.toFixed(1)}</div>
  ) : (
    <div className={`score-badge empty${small ? " sm" : ""}`}>?</div>
  );
}

function PerfumeCard({ d, index, onClick, onEdit, onStatusChange }) {
  const notesLine = [...(d.top || []), ...(d.heart || []), ...(d.base || [])].slice(0, 6).join(" · ");
  return (
    <div className="card" style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}>
      <button className="card-body" onClick={onClick}>
        <Cover d={d} />
        <div className="card-info">
          <h3>{d.name}</h3>
          <div className="brand">
            {d.brand || ""}
            {d.year ? ` · ${d.year}` : ""}
          </div>
          <AccordPills family={d.family} max={3} />
          {d.myImpression ? (
            <div className="impression">&quot;{d.myImpression}&quot;</div>
          ) : (
            notesLine && <div className="notes-line">{notesLine}</div>
          )}
        </div>
      </button>
      <div className="card-float tl">
        <StatusMenu value={d.status} onChange={onStatusChange} />
      </div>
      <div className="card-float tr">
        <ScoreBadge score={d.myScore} />
      </div>
      <button
        type="button"
        className="card-edit-btn"
        title="Editar perfume"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        ✏️
      </button>
    </div>
  );
}

function PerfumeRow({ d, index, onClick, onEdit, onStatusChange }) {
  return (
    <div className="row-item" style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}>
      <button className="row-main" onClick={onClick}>
        <Cover d={d} className="sm" />
        <div className="row-text">
          <h3>{d.name}</h3>
          <div className="brand">
            {d.brand || ""}
            {d.year ? ` · ${d.year}` : ""}
          </div>
        </div>
        <div className="row-pills">
          <AccordPills family={d.family} max={2} />
        </div>
      </button>
      <StatusMenu value={d.status} onChange={onStatusChange} showLabel />
      <ScoreBadge score={d.myScore} small />
      <button
        type="button"
        className="row-edit"
        title="Editar perfume"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        ✏️
      </button>
    </div>
  );
}

function LabeledChips(label, arr) {
  if (!arr || !arr.length) return null;
  return (
    <div key={label}>
      <div className="micro-label">{label}</div>
      <div className="chips">
        {arr.map((n) => (
          <span className="chip" key={n}>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

function DetailView({ d, position, onPrev, onNext, onClose, onEdit, onRefresh, onDelete }) {
  const hasPyramid = (d.top && d.top.length) || (d.heart && d.heart.length) || (d.base && d.base.length);
  const hasExtras = d.volume || (d.climate && d.climate.length) || (d.occasion && d.occasion.length) || d.alerts;
  const status = statusInfo(d.status);
  return (
    <div>
      <div className="detail-nav">
        <button type="button" className="nav-arrow" onClick={onPrev || undefined} disabled={!onPrev} title="Anterior (←)">
          ‹
        </button>
        <span className="nav-pos num">{position ? `${position.index + 1} / ${position.total}` : ""}</span>
        <button type="button" className="nav-arrow" onClick={onNext || undefined} disabled={!onNext} title="Próximo (→)">
          ›
        </button>
      </div>
      <div className="modal-head">
        <div>
          <h2>{d.name}</h2>
          <div className="sub">
            {d.brand || ""}
            {d.year ? ` · ${d.year}` : ""}
            {d.perfumer ? ` · ${d.perfumer}` : ""}
          </div>
        </div>
        <button className="close-x" onClick={onClose}>
          ✕
        </button>
      </div>

      {status && <div className={`status-ribbon inline ${status.kind}`}>{status.icon} {status.label}</div>}

      {d.imageUrl && (
        <div className="detail-image-wrap">
          <img src={d.imageUrl} alt={d.name} className="detail-image" />
        </div>
      )}

      {(d.family || typeof d.externalRating === "number") && (
        <div className="pill-row" style={{ marginTop: 8 }}>
          {d.family && <span className="pill family">{d.family}</span>}
          {typeof d.externalRating === "number" && (
            <span className="pill ext">
              {d.externalSource || "Externa"} {d.externalRating.toFixed(1)}
              {d.externalRatingCount ? ` (${d.externalRatingCount} votos)` : ""}
            </span>
          )}
        </div>
      )}

      <div className="section-label">Pirâmide olfativa</div>
      <div className="detail-pyramid">
        {d.top && d.top.length > 0 && (
          <div className="row">
            <span className="tag">Topo</span>
            <div className="chips">
              {d.top.map((n) => (
                <span className="chip" key={n}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}
        {d.heart && d.heart.length > 0 && (
          <div className="row">
            <span className="tag">Coração</span>
            <div className="chips">
              {d.heart.map((n) => (
                <span className="chip" key={n}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}
        {d.base && d.base.length > 0 && (
          <div className="row">
            <span className="tag">Fundo</span>
            <div className="chips">
              {d.base.map((n) => (
                <span className="chip" key={n}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}
        {!hasPyramid && <div style={{ color: "var(--ink-soft)", fontSize: ".85rem" }}>Sem pirâmide cadastrada ainda.</div>}
      </div>

      {d.externalUrl && (
        <div style={{ marginTop: 10, fontSize: ".8rem" }}>
          <a href={d.externalUrl} target="_blank" rel="noopener noreferrer">
            Ver ficha externa ↗
          </a>
        </div>
      )}

      <div className="section-label">Minha experiência</div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div className="micro-label">Minha nota</div>
          <div
            className={`score-badge${typeof d.myScore !== "number" ? " empty" : ""}`}
            style={{ marginTop: 6, width: 52, height: 52, fontSize: "1.15rem" }}
          >
            {typeof d.myScore === "number" ? d.myScore.toFixed(1) : "?"}
          </div>
        </div>
        {d.myNotes && d.myNotes.length > 0 && (
          <div style={{ flex: 1, minWidth: 180 }}>{LabeledChips("Notas que senti", d.myNotes)}</div>
        )}
      </div>
      {d.myImpression && <p style={{ fontStyle: "italic", marginTop: 12, lineHeight: 1.5 }}>&quot;{d.myImpression}&quot;</p>}

      {hasExtras && (
        <>
          <div className="section-label">Detalhes de uso</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {d.volume && (
              <div>
                <span className="micro-label" style={{ marginRight: 8 }}>
                  Volume/Formato
                </span>
                <span>{d.volume}</span>
              </div>
            )}
            {LabeledChips("Clima ideal", d.climate)}
            {LabeledChips("Ocasião de uso", d.occasion)}
            {d.alerts && (
              <div>
                <div className="micro-label">Alertas / o que incomodou</div>
                <p style={{ margin: "4px 0 0" }}>{d.alerts}</p>
              </div>
            )}
          </div>
        </>
      )}

      <div className="modal-actions">
        <button className="btn ghost" onClick={onDelete}>
          Excluir perfume
        </button>
        <div className="save-row">
          <button className="btn" onClick={onRefresh} title="Buscar de novo na Fragella para completar dados faltando (ex: foto)">
            🔍 Atualizar dados
          </button>
          <button className="btn" onClick={onEdit}>
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

function FormView({ existing, initialName, autoSearch, allPerfumes, onClose, onSave, onSwitchExisting, onDelete, usage, onUsage }) {
  const d = existing || {};
  const [name, setName] = useState(d.name || initialName || "");
  const [brand, setBrand] = useState(d.brand || "");
  const [perfumer, setPerfumer] = useState(d.perfumer || "");
  const [year, setYear] = useState(d.year || "");
  const [family, setFamily] = useState(d.family || "");
  const [top, setTop] = useState((d.top || []).join(", "));
  const [heart, setHeart] = useState((d.heart || []).join(", "));
  const [base, setBase] = useState((d.base || []).join(", "));
  const [imageUrl, setImageUrl] = useState(d.imageUrl || "");
  const [externalRating, setExternalRating] = useState(
    typeof d.externalRating === "number" ? d.externalRating : ""
  );
  const [externalUrl, setExternalUrl] = useState(d.externalUrl || "");
  const [externalSource, setExternalSource] = useState(d.externalSource || "");
  const [volume, setVolume] = useState(d.volume || "");
  const [climate, setClimate] = useState((d.climate || []).join(", "));
  const [occasion, setOccasion] = useState((d.occasion || []).join(", "));
  const [alerts, setAlerts] = useState(d.alerts || "");
  const [myNotes, setMyNotes] = useState((d.myNotes || []).join(", "));
  const [myImpression, setMyImpression] = useState(d.myImpression || "");
  const [myScore, setMyScore] = useState(typeof d.myScore === "number" ? d.myScore : null);
  const [status, setStatus] = useState(d.status || "");

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [dismissedDuplicate, setDismissedDuplicate] = useState(false);

  const quotaReached = usage && usage.count >= usage.limit;

  const duplicate = useMemo(() => {
    if (!allPerfumes || !name.trim()) return null;
    const target = normalizeName(name);
    if (!target) return null;
    return (
      allPerfumes.find((p) => p.id !== (existing && existing.id) && normalizeName(p.name) === target) || null
    );
  }, [allPerfumes, name, existing]);

  useEffect(() => {
    setDismissedDuplicate(false);
  }, [duplicate]);

  useEffect(() => {
    if (autoSearch && name.trim()) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch() {
    if (!name.trim() || quotaReached) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(name.trim())}`);
      const data = await res.json();
      if (data.usage) onUsage(data.usage);
      if (!res.ok) {
        setSearchError(data.error || "Erro na busca.");
        return;
      }
      if (!data.results || data.results.length === 0) {
        setSearchError("Nenhum resultado encontrado na Fragella para esse nome.");
        return;
      }
      setSearchResults(data.results);
    } catch (err) {
      setSearchError("Falha ao conectar com a busca.");
    } finally {
      setSearchLoading(false);
    }
  }

  function applyResult(r) {
    setName(r.name || name);
    setBrand(r.brand || brand);
    setYear(r.year || year);
    setFamily(Array.isArray(r.accords) ? r.accords.join(", ") : family);
    setTop((r.top || []).join(", "));
    setHeart((r.heart || []).join(", "));
    setBase((r.base || []).join(", "));
    setImageUrl(r.imageUrl || imageUrl);
    setExternalRating(typeof r.rating === "number" ? r.rating : externalRating);
    setExternalUrl(r.sourceUrl || externalUrl);
    setExternalSource("Fragella");
    setSearchResults(null);
  }

  function submit() {
    if (!name.trim()) return;
    onSave({
      id: existing ? existing.id : undefined,
      name: name.trim(),
      brand: brand.trim(),
      perfumer: perfumer.trim(),
      year: parseInt(year, 10) || null,
      family: family.trim(),
      top: splitList(top),
      heart: splitList(heart),
      base: splitList(base),
      imageUrl: imageUrl.trim() || null,
      externalSource: externalSource || null,
      externalRating: externalRating !== "" ? parseFloat(externalRating) : null,
      externalUrl: externalUrl.trim() || null,
      volume: volume.trim() || null,
      climate: splitList(climate),
      occasion: splitList(occasion),
      alerts: alerts.trim() || null,
      myNotes: splitList(myNotes),
      myImpression: myImpression.trim(),
      myScore,
      status: status || null,
    });
  }

  return (
    <div>
      <div className="modal-head">
        <div>
          <h2>{existing ? "Editar perfume" : "Novo perfume"}</h2>
          <div className="sub">
            {existing
              ? "Atualize os dados oficiais ou sua experiência."
              : "Digite o nome e clique em Buscar dados, ou preencha manualmente."}
          </div>
        </div>
        <button className="close-x" onClick={onClose}>
          ✕
        </button>
      </div>

      <label className={`status-select ${status ? statusInfo(status)?.kind : ""}`}>
        Status na coleção
        <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Não possuo</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.icon} {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="section-label">Dados oficiais</div>
      <div className="form-grid">
        <label className="full">
          Nome do perfume*
          <div className="name-search-row">
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} required />
            <button
              type="button"
              className="btn"
              onClick={runSearch}
              disabled={searchLoading || !name.trim() || quotaReached}
              title={quotaReached ? "Cota mensal da Fragella esgotada" : undefined}
            >
              {searchLoading ? "Buscando…" : "Buscar dados"}
            </button>
          </div>
          <span className="search-status">
            Mostra até 25 resultados por busca. Se não achar o certo, inclua a marca no nome
            (ex: &quot;Wild Vetiver Creed&quot;) e busque de novo.
          </span>
          {usage && (
            <span
              className={`search-status${quotaReached ? " error" : ""}`}
              style={{ marginTop: 4 }}
            >
              {usage.count}/{usage.limit} buscas usadas este mês
              {quotaReached ? " — cota esgotada, preencha manualmente ou espere o próximo mês." : ""}
            </span>
          )}
        </label>
        {duplicate && !dismissedDuplicate && (
          <div className="duplicate-warning full">
            <div>
              Você já tem <strong>{duplicate.name}</strong>
              {duplicate.brand ? ` — ${duplicate.brand}` : ""} na coleção.
            </div>
            <div className="duplicate-warning-actions">
              <button type="button" className="btn small primary" onClick={() => onSwitchExisting(duplicate)}>
                Editar o existente
              </button>
              <button type="button" className="btn small ghost" onClick={() => setDismissedDuplicate(true)}>
                Salvar mesmo assim (é diferente)
              </button>
            </div>
          </div>
        )}
        {searchError && <div className="search-status error full">{searchError}</div>}
        {searchResults && (
          <div className="search-results full">
            {searchResults.map((r, i) => (
              <button type="button" key={i} className="search-result-item" onClick={() => applyResult(r)}>
                <span>
                  <strong>{r.name}</strong> — {r.brand}
                </span>
                <span style={{ color: "var(--ink-soft)" }}>{r.year || ""}</span>
              </button>
            ))}
          </div>
        )}

        <label>
          Casa / Marca
          <input className="field-input" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </label>
        <label>
          Perfumista
          <input className="field-input" value={perfumer} onChange={(e) => setPerfumer(e.target.value)} />
        </label>
        <label>
          Ano de lançamento
          <input
            className="field-input"
            type="number"
            min="1900"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        <label>
          Família olfativa / acordes
          <input className="field-input" value={family} onChange={(e) => setFamily(e.target.value)} />
        </label>
        <label className="full">
          Notas de topo (separe por vírgula)
          <input className="field-input" value={top} onChange={(e) => setTop(e.target.value)} />
        </label>
        <label className="full">
          Notas de coração (separe por vírgula)
          <input className="field-input" value={heart} onChange={(e) => setHeart(e.target.value)} />
        </label>
        <label className="full">
          Notas de fundo (separe por vírgula)
          <input className="field-input" value={base} onChange={(e) => setBase(e.target.value)} />
        </label>
        <label>
          Nota externa (0–5)
          <input
            className="field-input"
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={externalRating}
            onChange={(e) => setExternalRating(e.target.value)}
          />
        </label>
        <label>
          Link da ficha externa
          <input className="field-input" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
        </label>
        <label className="full">
          Foto do frasco (link da imagem)
          <input className="field-input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        </label>
        {imageUrl && <img src={imageUrl} alt="" className="form-image-preview full" />}
      </div>

      <div className="section-label">Detalhes de uso</div>
      <div className="form-grid">
        <label>
          Volume / Formato
          <input
            className="field-input"
            placeholder="ex: Decant 5ml, Frasco 100ml"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          />
        </label>
        <label>
          Clima ideal (separe por vírgula)
          <input
            className="field-input"
            placeholder="ex: Verão, Primavera"
            value={climate}
            onChange={(e) => setClimate(e.target.value)}
          />
        </label>
        <label className="full">
          Ocasião de uso (separe por vírgula)
          <input
            className="field-input"
            placeholder="ex: Dia a dia, Noite / Festa"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
          />
        </label>
        <label className="full">
          Alertas / o que incomodou
          <input className="field-input" value={alerts} onChange={(e) => setAlerts(e.target.value)} />
        </label>
      </div>

      <div className="section-label">Minha experiência</div>
      <label className="full">
        Notas que eu senti (separe por vírgula)
        <input className="field-input" value={myNotes} onChange={(e) => setMyNotes(e.target.value)} />
      </label>
      <label className="full" style={{ marginTop: 10 }}>
        Minha impressão / sensação
        <textarea className="field-input" value={myImpression} onChange={(e) => setMyImpression(e.target.value)} />
      </label>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: ".78rem", color: "var(--ink-soft)", marginBottom: 2 }}>Minha nota</div>
        <div className="score-picker">
          {scoreOptions().map((v) => (
            <button
              type="button"
              key={v}
              className={myScore === v ? "on" : ""}
              onClick={() => setMyScore(myScore === v ? null : v)}
            >
              {v.toFixed(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="modal-actions">
        {existing ? (
          <button className="btn ghost" onClick={onDelete}>
            Excluir
          </button>
        ) : (
          <span />
        )}
        <div className="save-row">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={Boolean(duplicate && !dismissedDuplicate)}
            title={duplicate && !dismissedDuplicate ? "Resolva o aviso de duplicata acima antes de salvar" : undefined}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
