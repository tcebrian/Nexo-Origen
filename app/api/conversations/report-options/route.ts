import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { authorizeConversationsAccess } from "@/lib/conversations/access";
import { listReportOptions, reportAdapters } from "@/lib/conversations/report-delivery.server";

export const dynamic = "force-dynamic";

/** Opciones del selector "Informe de Nexo": tipos habilitados con sus formatos y periodos, restaurantes (con scope) y redes. */
export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const access = authorizeConversationsAccess(auth.session);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const scope = auth.session.scope;
    const options = await listReportOptions(scope, reportAdapters({ scope, origin: new URL(request.url).origin }));
    return NextResponse.json(options, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[conversations] report options failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "No se pudieron cargar las opciones de informe" }, { status: 500 });
  }
}
