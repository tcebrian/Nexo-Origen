import { getAuthSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { createRestaurantFromNexo } from "@/lib/restaurants/onboarding";
import type { RestaurantOnboardingInput } from "@/lib/restaurants/onboarding-types";
import { rateLimitAuthenticatedUser } from "@/lib/security/rate-limit.server";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || !isSuperAdmin(session.perfil.rol)) {
    return Response.json({ error: "No autorizado." }, { status: 403 });
  }

  const limited = await rateLimitAuthenticatedUser("restaurant-onboarding-create", session.userId);
  if (limited) return limited;

  try {
    const body = (await request.json()) as RestaurantOnboardingInput;
    return Response.json(await createRestaurantFromNexo(body), { status: 201 });
  } catch (error) {
    console.error("[api/restaurants/onboarding/create]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el restaurante.",
      },
      { status: 400 }
    );
  }
}
