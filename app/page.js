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

const UNDO_WINDOW_MS = 6000;

export default function Page() {
  const [perfumes, setPerfumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [usage, setUsage] = useState(null);

  const [search, setSearch] = useState("");
  const [filterFamily, setFilterFamily] = useState("");
  const [filterNote, setFilterNote] = useState("");
  const [sortBy, setSortBy] = useState("my_score_desc");

  const [modal, setModal] = useState(null); // { mode: 'view'|'form', perfume }
  const [toast, setToast] = useState(null); // { perfume }
  const undoTimer = useRef(null);

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

  useEffect(() => () => clearTimeout(undoTimer.current), []);

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
        case "my_score_desc":
        default: {
          const av = typeof a.myScore === "number" ? a.myScore : -1;
          const bv = typeof b.myScore === "number" ? b.myScore : -1;
          return bv - av;
        }
      }
    });
    return list;
  }, [perfumes, search, filterFamily, filterNote, sortBy]);

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
    return { total, avg, topFam };
  }, [perfumes]);

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
    return true;
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

    clearTimeout(undoTimer.current);
    setToast(target ? { perfume: target } : null);
    if (target) {
      undoTimer.current = setTimeout(() => setToast(null), UNDO_WINDOW_MS);
    }
  }

  async function undoDelete() {
    if (!toast) return;
    clearTimeout(undoTimer.current);
    const { perfume } = toast;
    setToast(null);
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
          <Stat v={stats.topFam || "—"} l="Família favorita" />
        </div>
      </header>

      <div className="hint">
        <b>Busca automática:</b> digite o nome no formulário de{" "}
        <b>+ Novo perfume</b> e clique em <b>Buscar dados</b> — o site consulta a
        API da Fragella (mais de 74 mil fragrâncias) e preenche marca, ano,
        pirâmide de notas, acordes e avaliação. Depois é só completar sua nota,
        as notas que você sentiu e sua impressão pessoal.
        {usage && (
          <>
            {" "}
            <span style={{ color: usage.count >= usage.limit ? "var(--danger)" : "var(--gold)", fontWeight: 600 }}>
              {usage.count}/{usage.limit} buscas usadas este mês.
            </span>
          </>
        )}
      </div>

      {loadError && <div className="hint" style={{ borderColor: "var(--danger)" }}>Erro ao carregar: {loadError}</div>}
      {readOnly && (
        <div className="hint" style={{ borderColor: "var(--gold)" }}>
          <b>Banco de dados ainda não conectado.</b> Você está vendo os dados de exemplo, mas nada será
          salvo até que o Supabase seja configurado nas variáveis de ambiente do servidor.
        </div>
      )}

      <div className="controls">
        <input
          id="search"
          className="field-input"
          type="text"
          placeholder="Buscar por nome ou marca…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="field-input" value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}>
          <option value="">Toda família olfativa</option>
          {families.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <input
          className="field-input"
          type="text"
          placeholder="Filtrar por nota (ex: baunilha)"
          style={{ flex: "0 0 220px" }}
          value={filterNote}
          onChange={(e) => setFilterNote(e.target.value)}
        />
        <select className="field-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="my_score_desc">Minha nota (maior primeiro)</option>
          <option value="name_asc">Nome (A–Z)</option>
          <option value="year_desc">Ano (mais recente)</option>
          <option value="brand_asc">Marca (A–Z)</option>
        </select>
        <button className="btn primary" onClick={() => setModal({ mode: "form", perfume: null })}>
          + Novo perfume
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <h3 style={{ fontStyle: "italic" }}>Carregando…</h3>
        </div>
      ) : (
        <div className="grid">
          {perfumes.length === 0 ? (
            <div className="empty-state">
              <h3 style={{ fontStyle: "italic" }}>Nenhum perfume por aqui ainda</h3>
              <p>Clique em &quot;+ Novo perfume&quot; para começar.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3 style={{ fontStyle: "italic" }}>Nada encontrado</h3>
              <p>Ajuste a busca ou os filtros.</p>
            </div>
          ) : (
            filtered.map((d) => (
              <PerfumeCard key={d.id} d={d} onClick={() => setModal({ mode: "view", perfume: d })} />
            ))
          )}
        </div>
      )}

      <footer className="note">Seus dados ficam salvos neste site e sincronizam automaticamente.</footer>

      {toast && (
        <div className="toast">
          <span>&quot;{toast.perfume.name}&quot; excluído.</span>
          <button className="btn small" onClick={undoDelete}>
            Desfazer
          </button>
        </div>
      )}

      {modal && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="modal">
            {modal.mode === "view" ? (
              <DetailView
                d={modal.perfume}
                onClose={() => setModal(null)}
                onEdit={() => setModal({ mode: "form", perfume: modal.perfume })}
                onDelete={() => deleteDoc(modal.perfume.id, modal.perfume.name)}
              />
            ) : (
              <FormView
                existing={modal.perfume}
                usage={usage}
                onUsage={setUsage}
                onClose={() => setModal(null)}
                onSave={async (body) => {
                  const ok = await saveDoc(body);
                  if (ok) setModal(null);
                }}
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

function Stat({ v, l, mono }) {
  return (
    <div className="stat">
      <span className={mono ? "v num" : "v"} style={!mono ? { fontSize: "1.05rem", fontStyle: "italic" } : undefined}>
        {v}
      </span>
      <span className="l">{l}</span>
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

function PerfumeCard({ d, onClick }) {
  return (
    <button className="card" onClick={onClick}>
      <div className="card-top">
        {d.imageUrl ? (
          <img src={d.imageUrl} alt="" className="card-thumb" />
        ) : (
          <div className="card-thumb placeholder" aria-hidden="true">
            ⚱
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{d.name}</h3>
          <div className="brand">
            {d.brand || ""}
            {d.year ? ` · ${d.year}` : ""}
          </div>
        </div>
        {typeof d.myScore === "number" ? (
          <div className="score-badge">{d.myScore.toFixed(1)}</div>
        ) : (
          <div className="score-badge empty">?</div>
        )}
      </div>
      <div className="pill-row">
        {d.family && <span className="pill family">{d.family}</span>}
        {typeof d.externalRating === "number" && (
          <span className="pill ext">
            {d.externalSource || "Externa"} {d.externalRating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="pyramid">
        {pyramidRow("Topo", d.top)}
        {pyramidRow("Coração", d.heart)}
        {pyramidRow("Fundo", d.base)}
      </div>
      {d.myImpression && <div className="impression">&quot;{d.myImpression}&quot;</div>}
    </button>
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

function DetailView({ d, onClose, onEdit, onDelete }) {
  const hasPyramid = (d.top && d.top.length) || (d.heart && d.heart.length) || (d.base && d.base.length);
  const hasExtras = d.volume || (d.climate && d.climate.length) || (d.occasion && d.occasion.length) || d.alerts;
  return (
    <div>
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
          <button className="btn" onClick={onEdit}>
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

function FormView({ existing, onClose, onSave, onDelete, usage, onUsage }) {
  const d = existing || {};
  const [name, setName] = useState(d.name || "");
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

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchResults, setSearchResults] = useState(null);

  const quotaReached = usage && usage.count >= usage.limit;

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
          <button className="btn primary" onClick={submit}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
