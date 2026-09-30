/**
 * Sensor teks sebelum dicatat (IntegrationLog, console). Murni agar mudah diuji.
 * Menghapus: header Bearer, kunci berawalan sk-/pk-/rk-, parameter query rahasia,
 * token panjang tak bermakna, dan alamat email (data pribadi).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const REDACTED = "[disensor]";

export function redactSecrets(text: string, maxLength = 300): string {
  let out = text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, REDACTED)
    .replace(
      /([?&](?:access_token|token|key|api_key|apikey|secret|client_secret|sig|signature|password)=)[^&\s"']+/gi,
      `$1${REDACTED}`,
    )
    .replace(/("?(?:access_token|api_key|apikey|client_secret|password|secret|token)"?\s*[:=]\s*"?)[^"\s,}&?[]+/gi, `$1${REDACTED}`)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, REDACTED)
    .replace(/[A-Za-z0-9_-]{32,}/g, (match) => (UUID.test(match) ? match : REDACTED));
  out = out.replace(/\s+/g, " ").trim();
  return out.length > maxLength ? `${out.slice(0, maxLength - 1)}…` : out;
}
