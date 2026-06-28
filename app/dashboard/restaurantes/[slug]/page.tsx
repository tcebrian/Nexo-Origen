import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { isRestauranteSlugInScope } from "@/lib/auth/restaurant-guard";
import { RestaurantDetailPage } from "./_components/restaurant-detail-page";

export default async function RestaurantDetailRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getAuthSession();

  if (session && !(await isRestauranteSlugInScope(session.scope, slug))) {
    redirect("/dashboard");
  }

  return <RestaurantDetailPage slug={slug} />;
}
