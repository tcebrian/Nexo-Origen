import { describe, expect, it } from "node:test";
import { classifyReviewReason } from "./classify-reason";

describe("classifyReviewReason", () => {
  it("prioriza tiempo de espera sobre atención", () => {
    const reason = classifyReviewReason({
      comentario: "Tardaron mucho y el personal fue borde",
      resumen_ia: "Demora en el servicio y trato mejorable",
    });
    expect(reason).toBe("Tiempo de espera");
  });

  it("detecta exceso de tiempos aunque la IA diga calidad en la comida", () => {
    const reason = classifyReviewReason({
      comentario: "Exceso de tiempos de espera, inaceptable para un local así",
      analisis_ia: "Calidad en la comida",
      resumen_ia: "Problemas de calidad del producto",
    });
    expect(reason).toBe("Tiempo de espera");
  });

  it("no clasifica como calidad cuando solo se queja del tiempo de la comida", () => {
    const reason = classifyReviewReason({
      comentario: "La comida tardó demasiado en llegar a la mesa",
      analisis_ia: "Calidad producto|Comida",
    });
    expect(reason).toBe("Tiempo de espera");
  });

  it("detecta pedido incorrecto", () => {
    const reason = classifyReviewReason({
      comentario: "Nos trajeron un pedido incorrecto",
      analisis_ia: "Error en la comanda",
    });
    expect(reason).toBe("Pedido incorrecto");
  });

  it("detecta empleado mencionado cuando hay nombre en IA", () => {
    const reason = classifyReviewReason({
      comentario: "Todo bien",
      empleado_mencionado: "María",
    });
    expect(reason).toBe("Empleado mencionado");
  });

  it("devuelve sin comentario si no hay texto útil", () => {
    const reason = classifyReviewReason({
      comentario: "Sin comentario",
    });
    expect(reason).toBe("Sin comentario");
  });

  it("clasifica calidad producto cuando hay señales claras de comida", () => {
    const reason = classifyReviewReason({
      comentario: "La hamburguesa llegó fría y con mala calidad",
      resumen_ia: "Producto servido a temperatura incorrecta",
    });
    expect(reason).toBe("Calidad producto");
  });

  it("clasifica atención cuando la queja es del servicio, no del producto", () => {
    const reason = classifyReviewReason({
      comentario: "La calidad del servicio fue pésima, muy mal trato",
    });
    expect(reason).toBe("Atención al cliente");
  });

  it("detecta falta de producto", () => {
    const reason = classifyReviewReason({
      comentario: "No había patatas y estaban agotadas",
    });
    expect(reason).toBe("Falta de producto");
  });
});
