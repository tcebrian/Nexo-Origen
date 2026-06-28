import { SectionPage } from "../_components/section-page";

export default function AjustesPage() {
  return (
    <SectionPage
      title="Configuración"
      description="Ajustes de cuenta, preferencias y notificaciones de tu red."
      related={[
        { label: "Inicio", href: "/dashboard", description: "Vuelve al panel principal de tu red." },
        { label: "Alertas", href: "/dashboard/alertas", description: "Gestiona cómo recibes las incidencias." },
      ]}
    />
  );
}
