export interface AccessEnv {
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
}
export class AuthUnavailable extends Error {}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid JWT encoding");
  return Uint8Array.from(
    atob(
      value
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "="),
    ),
    (char) => char.charCodeAt(0),
  );
}
function part(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decode(value)));
}
export async function verifyAccessJwt(
  request: Request,
  env: AccessEnv,
): Promise<Record<string, unknown> | null> {
  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN)
    throw new AuthUnavailable("Access configuration unavailable");
  const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(issuer);
  } catch {
    throw new AuthUnavailable("Invalid Access configuration");
  }
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname.endsWith(".cloudflareaccess.com") ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new AuthUnavailable("Invalid Access configuration");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 16384) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const [head, body, signature] = parts;
    const header = part(head),
      payload = part(body);
    const now = Math.floor(Date.now() / 1000);
    if (
      header.alg !== "RS256" ||
      typeof header.kid !== "string" ||
      !header.kid ||
      header.kid.length > 256
    )
      return null;
    if (
      payload.iss !== issuer ||
      !Array.isArray(payload.aud) ||
      !payload.aud.includes(env.ACCESS_AUD) ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= now ||
      typeof payload.iat !== "number" ||
      !Number.isFinite(payload.iat) ||
      payload.iat > now + 60 ||
      payload.iat >= payload.exp ||
      (payload.nbf !== undefined &&
        (typeof payload.nbf !== "number" ||
          !Number.isFinite(payload.nbf) ||
          payload.nbf > now))
    )
      return null;
    let response: Response;
    try {
      response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new AuthUnavailable("Authentication service unavailable");
    }
    if (!response.ok)
      throw new AuthUnavailable("Authentication service unavailable");
    let certs: { keys?: (JsonWebKey & { kid?: string })[] };
    try {
      certs = await response.json();
    } catch {
      throw new AuthUnavailable("Authentication service unavailable");
    }
    if (!Array.isArray(certs.keys))
      throw new AuthUnavailable("Authentication service unavailable");
    const key = certs.keys.find(
      (key) =>
        key.kid === header.kid &&
        key.kty === "RSA" &&
        key.alg === "RS256" &&
        key.n &&
        key.e &&
        (!key.use || key.use === "sig"),
    );
    if (!key) return null;
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: key.n, e: key.e },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        publicKey,
        decode(signature),
        new TextEncoder().encode(`${head}.${body}`),
      ))
    )
      return null;
    return payload;
  } catch (error) {
    if (error instanceof AuthUnavailable) throw error;
    return null;
  }
}
