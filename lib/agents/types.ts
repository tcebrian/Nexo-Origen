export type AgentMode = "piloto" | "activo" | "pausado";

export type AgentRestaurant = {
  id: number;
  nombre: string;
  ciudad: string | null;
};

export type AgentControlItem = {
  id: string;
  nombre: string;
  todosRestaurantes: boolean;
  restauranteIds: number[];
  restaurantes: AgentRestaurant[];
  activo: boolean;
  alertas: boolean;
  modo: AgentMode;
  resumenDiario: boolean;
  resumenHora: string;
  timezone: string;
  actualizadoEn: string | null;
  conversationCount: number;
  lastActivity: string | null;
  lastConversationState: string | null;
};

export type AgentControlSnapshot = {
  agents: AgentControlItem[];
  restaurants: AgentRestaurant[];
};

export type AgentControlUpdateInput = {
  id: string;
  todosRestaurantes: boolean;
  restauranteIds: number[];
  activo: boolean;
  alertas: boolean;
  modo: AgentMode;
  resumenDiario: boolean;
  resumenHora: string;
  timezone: string;
};
