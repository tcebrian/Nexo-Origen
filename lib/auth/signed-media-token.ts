import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Autorización firmada para URLs de medios que descarga un tercero (p. ej. Twilio) sin sesión.
 *
 * En lugar de poner el secreto compartido en la URL, la URL lleva `exp.firma`:
 *  - ligada a UN recurso concreto (`scope` + `resourceId`): no sirve para otra reseña ni otra ruta;
 *  - con caducidad corta (por defecto 15 min);
 *  - la firma es HMAC-SHA256 con una clave DERIVADA del secreto (separación de dominio), así que el
 *    secreto original nunca viaja y la firma no sirve como cabecera del webhook.
 */

export const MEDIA_TOKEN_DEFAULT_TTL_SECONDS = 15 * 60;

function derivedKey(secret: string): Buffer {
  return createHmac("sha256", secret).update("nexo:signed-media-token:v1").digest();
}

function sign(secret: string, scope: string, resourceId: string | number, exp: number): string {
  return createHmac("sha256", derivedKey(secret)).update(`${scope}:${resourceId}:${exp}`).digest("hex");
}

/** Comparación en tiempo constante (también cuando las longitudes difieren). */
export function secretsMatch(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!received || !expected) return false;
  const key = Buffer.from("nexo:secret-compare");
  const a = createHmac("sha256", key).update(received).digest();
  const b = createHmac("sha256", key).update(expected).digest();
  return timingSafeEqual(a, b);
}

export function createMediaToken(input: {
  secret: string;
  scope: string;
  resourceId: string | number;
  nowMs?: number;
  ttlSeconds?: number;
}): string {
  const nowMs = input.nowMs ?? Date.now();
  const exp = Math.floor(nowMs / 1000) + (input.ttlSeconds ?? MEDIA_TOKEN_DEFAULT_TTL_SECONDS);
  return `${exp}.${sign(input.secret, input.scope, input.resourceId, exp)}`;
}

export function verifyMediaToken(input: {
  token: string | null | undefined;
  secret: string | null | undefined;
  scope: string;
  resourceId: string | number;
  nowMs?: number;
}): boolean {
  if (!input.token || !input.secret) return false;
  const match = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(input.token);
  if (!match) return false;
  const exp = Number(match[1]);
  if (exp < Math.floor((input.nowMs ?? Date.now()) / 1000)) return false;
  return secretsMatch(match[2], sign(input.secret, input.scope, input.resourceId, exp));
}
