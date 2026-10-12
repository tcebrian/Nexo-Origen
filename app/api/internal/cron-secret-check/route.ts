import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isSuperAdmin, normalizeRole } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DIAGNÓSTICO TEMPORAL, solo super_admin: ¿qué valor de CRON_SECRET ve este despliegue?
 * Devuelve únicamente si está configurado, su longitud y los 8 primeros caracteres de su SHA-256, para
 * compararlos con el secreto que usa el cron sin exponerlo. Nunca devuelve el secreto. Se retirará al terminar.
 */
export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  if (!isSuperAdmin(normalizeRole(auth.session.perfil.rol))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const secret = process.env.CRON_SECRET;
  const configured = typeof secret === "string" && secret.length > 0;

  return NextResponse.json(
    {
      configured,
      length: configured ? secret.length : 0,
      sha256_prefix: configured ? createHash("sha256").update(secret).digest("hex").slice(0, 8) : null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
