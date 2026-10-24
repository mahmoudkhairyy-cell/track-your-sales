import { createHash, timingSafeEqual } from "node:crypto";

export type DeploymentEnvironment = {
  [key: string]: string | undefined;
  VERCEL?: string;
  PUBLIC_DEPLOYMENT?: string;
  WORKSPACE_USERNAME?: string;
  WORKSPACE_PASSWORD?: string;
};

export type DeploymentAccess =
  | { allowed: true; protected: boolean }
  | { allowed: false; status: 401 | 503; message: string };

/**
 * Public deployments must never silently fall back to the open preview mode.
 * Vercel is detected independently of PUBLIC_DEPLOYMENT, including preview deployments.
 * Supplying a password also enables the gate on a self-hosted server.
 */
export function deploymentProtectionEnabled(env: DeploymentEnvironment = process.env): boolean {
  return env.VERCEL === "1" || env.PUBLIC_DEPLOYMENT === "true" || Boolean(env.WORKSPACE_PASSWORD);
}

export function deploymentAccess(
  authorization: string | null,
  env: DeploymentEnvironment = process.env,
): DeploymentAccess {
  if (!deploymentProtectionEnabled(env)) return { allowed: true, protected: false };

  const username = env.WORKSPACE_USERNAME || "mahmoud";
  const password = env.WORKSPACE_PASSWORD;
  if (
    !password ||
    password.trim().length < 24 ||
    password.length > 256 ||
    !/^[a-zA-Z0-9._-]{1,64}$/.test(username)
  ) {
    return {
      allowed: false,
      status: 503,
      message: "الرابط مقفول لحد ما المالك يضبط كلمة حماية قوية في إعدادات الاستضافة. بياناتك مش معروضة للزوار.",
    };
  }

  const denied: DeploymentAccess = {
    allowed: false,
    status: 401,
    message: "الرابط خاص. استخدم اسم المستخدم وكلمة الحماية اللي اتضبطوا في الاستضافة.",
  };
  if (!authorization || authorization.length > 4096) return denied;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization.trim());
  if (!match) return denied;

  const submitted = Buffer.from(match[1], "base64");
  const expected = Buffer.from(`${username}:${password}`, "utf8");
  // Hash to a constant length before comparison. Never log either credential.
  const submittedHash = createHash("sha256").update(submitted).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(submittedHash, expectedHash) ? { allowed: true, protected: true } : denied;
}

/** Native browser credentials must not authorize a write from another origin. */
export function sameOriginWrite(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  // CLI requests are allowed; they still have to pass the credential check.
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const destination = new URL(request.url);
    const host = request.headers.get("host") || destination.host;
    return ["http:", "https:"].includes(source.protocol) && source.host === host;
  } catch {
    return false;
  }
}
