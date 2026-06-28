import "server-only";

import { loadPeriodDataServer } from "@/lib/supabase/period-api.server";
import { createRestaurantsRepository } from "../restaurants-repository-shared";

export const supabaseRestaurantsRepository = createRestaurantsRepository(loadPeriodDataServer);
