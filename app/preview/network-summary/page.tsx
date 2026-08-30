"use client";

import { useState } from "react";
import { NETWORK_REPORT_GROUPS, type NetworkReportGroupId } from "@/lib/reports/network-summary/brand-groups";
import type { ReportPeriodSlug } from "@/lib/reports/period-ranges";

const GROUP_OPTIONS = Object.values(NETWORK_REPORT_GROUPS);
const PERIODO_OPTIONS: { value: ReportPeriodSlug; label: string }[] = [
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
];

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const SCALE = 0.62;

export default function PreviewNetworkSummaryPage() {
  const [grupo, setGrupo] = useState<NetworkReportGroupId>("bk");
  const [periodo, setPeriodo] = useState<ReportPeriodSlug>("semanal");
  const [reloadKey, setReloadKey] = useState(0);

  const src = `/templates/network-summary/${periodo}/${grupo}`;

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", background: "#0c0a12", minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ color: "#ddd", fontSize: 13 }}>
          Marca{" "}
          <select
            value={grupo}
            onChange={(e) => setGrupo(e.target.value as NetworkReportGroupId)}
            style={{ padding: "4px 8px" }}
          >
            {GROUP_OPTIONS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ color: "#ddd", fontSize: 13 }}>
          Periodo{" "}
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as ReportPeriodSlug)}
            style={{ padding: "4px 8px" }}
          >
            {PERIODO_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          style={{ padding: "5px 12px", cursor: "pointer" }}
        >
          Recargar
        </button>

        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#9ac", fontSize: 13 }}
        >
          Abrir a tamaño real ↗
        </a>
      </div>

      <div
        style={{
          width: DESIGN_WIDTH * SCALE,
          height: DESIGN_HEIGHT * SCALE,
          overflow: "hidden",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <iframe
          key={`${grupo}-${periodo}-${reloadKey}`}
          src={src}
          title="network-summary-preview"
          style={{
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            border: "none",
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}
