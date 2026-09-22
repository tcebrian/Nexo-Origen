import { getAuthSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getRestaurantOnboardingOptions } from "@/lib/restaurants/onboarding";

export async function GET() {
  const session = await getAuthSession();

  if (!session || !isSuperAdmin(session.perfil.rol)) {
    return Response.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    return Response.json(await getRestaurantOnboardingOptions());
  } catch (error) {
    console.error("[api/restaurants/onboarding/options]", error);
    return Response.json(
      { error: "No se pudieron cargar las opciones de alta." },
      { status: 500 }
    );
  }
}
