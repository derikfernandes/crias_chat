"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { formatMeetingDateStr } from "@/lib/meetings";
import type { Meeting, MeetingItem } from "@/lib/firestore-types";
import MeetingCard from "./MeetingCard";

type MeetingWithItems = Meeting & { items: MeetingItem[] };

function meetingToDate(m: Meeting): Date {
  const raw = m.data as
    | Date
    | string
    | { toDate?: () => Date; seconds?: number; nanoseconds?: number }
    | null
    | undefined;
  if (raw instanceof Date) return raw;
  if (raw && typeof (raw as any).toDate === "function") {
    return (raw as { toDate: () => Date }).toDate();
  }
  if (raw && typeof (raw as any).seconds === "number") {
    const r = raw as { seconds: number; nanoseconds?: number };
    return new Date(r.seconds * 1000 + (r.nanoseconds ?? 0) / 1_000_000);
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }
  return new Date(0);
}

const styles: Record<string, React.CSSProperties> = {
  filterBox: {
    marginBottom: "1.25rem",
    position: "relative",
  },
  filterLabel: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.4rem",
  },
  filterRow: {
    display: "flex",
    alignItems: "stretch",
    gap: "0",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.25)",
    overflow: "hidden",
  },
  filterInput: {
    flex: 1,
    padding: "0.6rem 0.85rem",
    border: "none",
    background: "transparent",
    color: "#eee",
    fontSize: "1rem",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  },
  filterClearBtn: {
    padding: "0.5rem 0.55rem",
    border: "none",
    borderLeft: "1px solid rgba(255,255,255,0.15)",
    background: "transparent",
    color: "#888",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.9rem",
  },
  filterArrowBtn: {
    padding: "0.5rem 0.75rem",
    border: "none",
    borderLeft: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.06)",
    color: "#4ecdc4",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s ease",
  },
  optionsDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: "0.25rem",
    maxHeight: "220px",
    overflowY: "auto",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(26,26,46,0.98)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    zIndex: 50,
  },
  optionItem: {
    padding: "0.5rem 0.85rem",
    fontSize: "0.95rem",
    color: "#ddd",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  optionItemLast: {
    borderBottom: "none",
  },
  optionItemHover: {
    background: "rgba(78, 205, 196, 0.15)",
    color: "#4ecdc4",
  },
  optionItemSelected: {
    background: "rgba(78, 205, 196, 0.22)",
    color: "#4ecdc4",
    fontWeight: 600,
  },
  stats: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    marginBottom: "1.5rem",
  },
  statsBadge: {
    padding: "0.5rem 0.9rem",
    borderRadius: "10px",
    background: "rgba(78, 205, 196, 0.2)",
    border: "1px solid rgba(78, 205, 196, 0.4)",
    color: "#4ecdc4",
    fontSize: "0.85rem",
    fontWeight: 600,
  },
  statsBadgeAccent: {
    padding: "0.5rem 0.9rem",
    borderRadius: "10px",
    background: "#4ecdc4",
    border: "1px solid rgba(78, 205, 196, 0.6)",
    color: "#1a1a2e",
    fontSize: "0.85rem",
    fontWeight: 700,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  filterHint: {
    fontSize: "0.85rem",
    color: "#888",
    marginTop: "0.5rem",
  },
  filterDateRow: {
    display: "flex",
    alignItems: "stretch",
    gap: "0.75rem",
    flexWrap: "wrap",
    marginTop: "0.5rem",
    padding: "0.5rem 0.75rem",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.25)",
  },
  filterDateGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    minWidth: "140px",
  },
  filterDateInput: {
    padding: "0.45rem 0.65rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.3)",
    color: "#eee",
    fontSize: "0.95rem",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  selectedAssuntosRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
    marginTop: "0.35rem",
  },
  selectedAssuntoChip: {
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    border: "1px solid rgba(78,205,196,0.6)",
    background: "rgba(78,205,196,0.12)",
    color: "#4ecdc4",
    fontSize: "0.8rem",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    cursor: "pointer",
  },
  selectedAssuntoClearAll: {
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#999",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
};

export default function GerenciamentoList({
  meetings,
}: {
  meetings: MeetingWithItems[];
}) {
  const [filterAssunto, setFilterAssunto] = useState("");
  const [filterTema, setFilterTema] = useState("");
  const [selectedAssuntos, setSelectedAssuntos] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<string[]>([]);
  const [filterDataDe, setFilterDataDe] = useState("");
  const [filterDataAte, setFilterDataAte] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [temaOptionsOpen, setTemaOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const temaOptionsRef = useRef<HTMLDivElement>(null);

  const assuntosUnicos = useMemo(() => {
    const set = new Set<string>();
    meetings.forEach((m) => {
      const a = (m.assunto ?? "").trim();
      if (a) set.add(a);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [meetings]);

  const temasUnicos = useMemo(() => {
    const set = new Set<string>();
    meetings.forEach((m) => {
      const t = (m.tema ?? "").trim();
      if (t) set.add(t);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [meetings]);

  useEffect(() => {
    if (!optionsOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        optionsRef.current &&
        !optionsRef.current.contains(e.target as Node)
      ) {
        setOptionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [optionsOpen]);

  useEffect(() => {
    if (!temaOptionsOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        temaOptionsRef.current &&
        !temaOptionsRef.current.contains(e.target as Node)
      ) {
        setTemaOptionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [temaOptionsOpen]);

  const filtered = useMemo(() => {
    let list = meetings;

    const qAssunto = filterAssunto.trim().toLowerCase();
    if (qAssunto) {
      list = list.filter((m) =>
        (m.assunto ?? "").toLowerCase().includes(qAssunto)
      );
    }

    const qTema = filterTema.trim().toLowerCase();
    if (qTema) {
      list = list.filter((m) =>
        (m.tema ?? "").toLowerCase().includes(qTema)
      );
    }

    if (selectedTemas.length > 0) {
      const selectedLower = selectedTemas.map((s) => s.toLowerCase());
      list = list.filter((m) =>
        selectedLower.includes((m.tema ?? "").trim().toLowerCase())
      );
    }

    if (selectedAssuntos.length > 0) {
      const selectedLower = selectedAssuntos.map((s) => s.toLowerCase());
      list = list.filter((m) =>
        selectedLower.includes((m.assunto ?? "").trim().toLowerCase())
      );
    }

    const de = filterDataDe.trim();
    const ate = filterDataAte.trim();
    if (de || ate) {
      list = list.filter((m) => {
        const d = meetingToDate(m);
        const t = d.getTime();

        if (de) {
          const [y, mm, dd] = de.split("-").map(Number);
          const start = new Date(y, mm - 1, dd, 0, 0, 0, 0).getTime();
          if (t < start) return false;
        }
        if (ate) {
          const [y, mm, dd] = ate.split("-").map(Number);
          const end = new Date(y, mm - 1, dd, 23, 59, 59, 999).getTime();
          if (t > end) return false;
        }
        return true;
      });
    }

    return list;
  }, [meetings, filterAssunto, filterTema, selectedTemas, filterDataDe, filterDataAte]);

  const totalItens = filtered.reduce((acc, m) => acc + m.items.length, 0);
  const totalAcoes = filtered.reduce(
    (acc, m) =>
      acc +
      m.items.filter(
        (it) => (it.type as "note" | "action" | undefined) === "action"
      ).length,
    0
  );

  return (
    <>
      <div style={styles.filterBox} ref={optionsRef}>
        <label htmlFor="filter-assunto" style={styles.filterLabel}>
          Filtrar por assunto
        </label>
        <div style={styles.filterRow}>
          <input
            id="filter-assunto"
            type="text"
            value={filterAssunto}
            onChange={(e) => setFilterAssunto(e.target.value)}
            placeholder="Digite parte do assunto ou abra as opções..."
            style={styles.filterInput}
          />
          {filterAssunto && (
            <button
              type="button"
              onClick={() => setFilterAssunto("")}
              style={styles.filterClearBtn}
              title="Limpar filtro de assunto"
              aria-label="Limpar filtro de assunto"
            >
              ×
            </button>
          )}
          <button
            type="button"
            onClick={() => setOptionsOpen((o) => !o)}
            style={{
              ...styles.filterArrowBtn,
              transform: optionsOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
            title={optionsOpen ? "Fechar opções" : "Ver opções de assunto"}
            aria-expanded={optionsOpen}
            aria-haspopup="listbox"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        {optionsOpen && assuntosUnicos.length > 0 && (
          <div
            style={styles.optionsDropdown}
            role="listbox"
            aria-label="Assuntos disponíveis"
          >
            {assuntosUnicos.map((assunto, i) => (
              <div
                key={assunto}
                role="option"
                tabIndex={0}
                style={{
                  ...styles.optionItem,
                  ...(selectedAssuntos.includes(assunto)
                    ? styles.optionItemSelected
                    : {}),
                  ...(i === assuntosUnicos.length - 1
                    ? styles.optionItemLast
                    : {}),
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(78, 205, 196, 0.15)";
                  e.currentTarget.style.color = "#4ecdc4";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.color = "#ddd";
                }}
                onClick={() => {
                  setSelectedAssuntos((prev) =>
                    prev.includes(assunto)
                      ? prev.filter((s) => s !== assunto)
                      : [...prev, assunto]
                  );
                }}
              >
                {assunto}
              </div>
            ))}
          </div>
        )}
        {optionsOpen && assuntosUnicos.length === 0 && (
          <div
            style={{
              ...styles.optionsDropdown,
              padding: "0.75rem 0.85rem",
              color: "#888",
              fontSize: "0.9rem",
            }}
          >
            Nenhum assunto cadastrado.
          </div>
        )}
        {filterAssunto.trim() && (
          <p style={styles.filterHint}>
            Mostrando {filtered.length}{" "}
            {filtered.length === 1 ? "ata" : "atas"} que contêm &quot;
            {filterAssunto.trim()}&quot; no assunto.
          </p>
        )}
        {selectedAssuntos.length > 0 && (
          <div style={styles.selectedAssuntosRow}>
            {selectedAssuntos.map((assunto) => (
              <button
                key={assunto}
                type="button"
                onClick={() =>
                  setSelectedAssuntos((prev) =>
                    prev.filter((s) => s !== assunto)
                  )
                }
                style={styles.selectedAssuntoChip}
              >
                <span>{assunto}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            {selectedAssuntos.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedAssuntos([])}
                style={styles.selectedAssuntoClearAll}
              >
                Limpar seleção
              </button>
            )}
          </div>
        )}
      </div>

      <div style={styles.filterBox} ref={temaOptionsRef}>
        <label htmlFor="filter-tema" style={styles.filterLabel}>
          Filtrar por tema
        </label>
        <div style={styles.filterRow}>
          <input
            id="filter-tema"
            type="text"
            value={filterTema}
            onChange={(e) => setFilterTema(e.target.value)}
            placeholder="Digite parte do tema ou abra as opções..."
            style={styles.filterInput}
            onFocus={() => setTemaOptionsOpen(true)}
          />
          {filterTema && (
            <button
              type="button"
              onClick={() => setFilterTema("")}
              style={styles.filterClearBtn}
              title="Limpar filtro de tema"
              aria-label="Limpar filtro de tema"
            >
              ×
            </button>
          )}
          <button
            type="button"
            onClick={() => setTemaOptionsOpen((o) => !o)}
            style={{
              ...styles.filterArrowBtn,
              transform: temaOptionsOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
            title={temaOptionsOpen ? "Fechar opções" : "Ver opções de tema"}
            aria-expanded={temaOptionsOpen}
            aria-haspopup="listbox"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        {temaOptionsOpen && temasUnicos.length > 0 && (
          <div
            style={styles.optionsDropdown}
            role="listbox"
            aria-label="Temas disponíveis"
          >
            {temasUnicos
              .filter((t) =>
                filterTema.trim()
                  ? t.toLowerCase().includes(filterTema.trim().toLowerCase())
                  : true
              )
              .map((tema, i, arr) => (
                <div
                  key={tema}
                  role="option"
                  tabIndex={0}
                  style={{
                    ...styles.optionItem,
                    ...(selectedTemas.includes(tema)
                      ? styles.optionItemSelected
                      : {}),
                    ...(i === arr.length - 1 ? styles.optionItemLast : {}),
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "rgba(78, 205, 196, 0.15)";
                    e.currentTarget.style.color = "#4ecdc4";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = selectedTemas.includes(tema)
                      ? "rgba(78, 205, 196, 0.22)"
                      : "";
                    e.currentTarget.style.color = selectedTemas.includes(tema)
                      ? "#4ecdc4"
                      : "#ddd";
                  }}
                  onClick={() => {
                    setSelectedTemas((prev) =>
                      prev.includes(tema)
                        ? prev.filter((s) => s !== tema)
                        : [...prev, tema]
                    );
                  }}
                >
                  {tema}
                </div>
              ))}
            {temasUnicos.filter((t) =>
              filterTema.trim()
                ? t.toLowerCase().includes(filterTema.trim().toLowerCase())
                : true
            ).length === 0 && (
              <div
                style={{
                  padding: "0.75rem 0.85rem",
                  color: "#888",
                  fontSize: "0.9rem",
                }}
              >
                Nenhum tema cadastrado.
              </div>
            )}
          </div>
        )}
        {filterTema.trim() && (
          <p style={styles.filterHint}>
            Mostrando {filtered.length}{" "}
            {filtered.length === 1 ? "ata" : "atas"} que contêm &quot;
            {filterTema.trim()}&quot; no tema.
          </p>
        )}
        {selectedTemas.length > 0 && (
          <div style={styles.selectedAssuntosRow}>
            {selectedTemas.map((tema) => (
              <button
                key={tema}
                type="button"
                onClick={() =>
                  setSelectedTemas((prev) => prev.filter((s) => s !== tema))
                }
                style={styles.selectedAssuntoChip}
              >
                <span>{tema}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            {selectedTemas.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedTemas([])}
                style={styles.selectedAssuntoClearAll}
              >
                Limpar temas
              </button>
            )}
          </div>
        )}
        {temasUnicos.length > 0 && (
          <p style={styles.filterHint}>
            Temas cadastrados: {temasUnicos.join(", ")}
          </p>
        )}
      </div>

      <div style={styles.filterBox}>
        <label style={styles.filterLabel}>Filtrar por data</label>
        <div style={styles.filterDateRow}>
          <div style={styles.filterDateGroup}>
            <span style={{ color: "#888", fontSize: "0.85rem" }}>De</span>
            <input
              id="filter-data-de"
              type="date"
              value={filterDataDe}
              onChange={(e) => setFilterDataDe(e.target.value)}
              style={styles.filterDateInput}
            />
          </div>
          <div style={styles.filterDateGroup}>
            <span style={{ color: "#888", fontSize: "0.85rem" }}>Até</span>
            <input
              id="filter-data-ate"
              type="date"
              value={filterDataAte}
              onChange={(e) => setFilterDataAte(e.target.value)}
              style={styles.filterDateInput}
            />
          </div>
          {(filterDataDe || filterDataAte) && (
            <button
              type="button"
              onClick={() => {
                setFilterDataDe("");
                setFilterDataAte("");
              }}
              style={{
                padding: "0.4rem 0.7rem",
                fontSize: "0.85rem",
                color: "#4ecdc4",
                background: "transparent",
                border: "1px solid rgba(78,205,196,0.5)",
                borderRadius: "999px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Limpar datas
            </button>
          )}
        </div>
      </div>

      <div style={styles.stats}>
        <span style={styles.statsBadge}>
          {filtered.length}{" "}
          {filtered.length === 1 ? "reunião" : "reuniões"}
        </span>
        <span style={styles.statsBadge}>
          {totalItens} itens no total
        </span>
        <span style={styles.statsBadgeAccent}>
          {totalAcoes} {totalAcoes === 1 ? "ação" : "ações"}
        </span>
      </div>

      <div style={styles.list}>
        {filtered.length === 0 ? (
          <p style={{ color: "#888", textAlign: "center", padding: "2rem" }}>
            {filterAssunto.trim() || filterDataDe || filterDataAte
              ? "Nenhuma ata corresponde aos filtros."
              : "Nenhuma reunião."}
          </p>
        ) : (
          filtered.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              formattedDate={formatMeetingDateStr(meeting)}
            />
          ))
        )}
      </div>
    </>
  );
}
