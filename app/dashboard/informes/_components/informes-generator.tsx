"use client";

import { useState } from "react";
import { brands } from "@/app/dashboard/restaurantes/data";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import type { GenerateReportInput, ReportFormat, ReportType } from "@/lib/reports/types";
import { tenant } from "../../tenant";
import { btnPrimary, card, inputField, sectionPad, shell, textKicker, textTitle } from "./ui/informes-styles";

type RestaurantOption = {
  name: string;
  brand: BrandId;
};

type InformesGeneratorProps = {
  onGenerate: (input: GenerateReportInput) => void;
  generating?: boolean;
  restaurantOptions?: RestaurantOption[];
};

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "prevent", label: "Prevent" },
  { value: "restaurante", label: "Restaurante individual" },
];

export function InformesGenerator({
  onGenerate,
  generating,
  restaurantOptions = [],
}: InformesGeneratorProps) {
  const [type, setType] = useState<ReportType>("semanal");
  const [brand, setBrand] = useState<GenerateReportInput["brand"]>("todas");
  const [restaurant, setRestaurant] = useState("");
  const [format, setFormat] = useState<ReportFormat>("ejecutivo");
  const [sendEmail, setSendEmail] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();

    onGenerate({
      type,
      company: tenant.name,
      brand,
      restaurant,
      start,
      end,
      format,
      sendEmail,
      saveToLibrary,
    });
  }

  return (
    <div className={shell}>
      <div className={sectionPad}>
        <p className={textKicker}>Generar informe</p>
        <h2 className={`mt-1.5 ${textTitle}`}>Nuevo informe a medida</h2>
        <p className="mt-1 text-sm text-gray-500">Configura y genera en pocos clics.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 border-t border-white/[0.06] p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-gray-500">Tipo de informe</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReportType)}
              className={inputField}
            >
              {REPORT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs text-gray-500">Empresa</span>
            <input type="text" value={tenant.name} readOnly className={`${inputField} opacity-70`} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs text-gray-500">Marca</span>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value as GenerateReportInput["brand"])}
              className={inputField}
            >
              <option value="todas">Todas las marcas</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          {type === "restaurante" && (
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs text-gray-500">Restaurante</span>
              <select
                value={restaurant}
                onChange={(e) => setRestaurant(e.target.value)}
                className={inputField}
                required
              >
                <option value="">Seleccionar local</option>
                {restaurantOptions.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs text-gray-500">Desde</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputField}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs text-gray-500">Hasta</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputField}
            />
          </label>
        </div>

        <div className={`${card} space-y-3 px-4 py-4`}>
          <p className="text-xs font-medium text-gray-400">Opciones de salida</p>
          <label className="flex items-center gap-3 text-sm text-gray-300">
            <input
              type="radio"
              name="format"
              checked={format === "ejecutivo"}
              onChange={() => setFormat("ejecutivo")}
              className="accent-violet-500"
            />
            PDF ejecutivo
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-300">
            <input
              type="radio"
              name="format"
              checked={format === "operativo"}
              onChange={() => setFormat("operativo")}
              className="accent-violet-500"
            />
            PDF operativo
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="accent-violet-500"
            />
            Enviar por email
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={saveToLibrary}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
              className="accent-violet-500"
            />
            Guardar en biblioteca
          </label>
        </div>

        <button type="submit" disabled={generating} className={`${btnPrimary} w-full sm:w-auto`}>
          {generating ? "Generando…" : "Generar informe"}
        </button>
      </form>
    </div>
  );
}
