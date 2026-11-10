// دالة خادم لشاشة المدير: بتتحقق من كلمة المرور وبتنفذ العمليات بصلاحية الخادم،
// والدوال نفسها مش مفتوحة للزوار. فيها حد لعدد المحاولات الفاشلة لكل عنوان IP.

const ALLOWED_ORIGIN = "https://mahmoudkhairyy-cell.github.io";
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// ملاحظة: الحد ده في الذاكرة، وبيتصفر لما الدالة تتعاد تشغيلها. ده تحسين مش حماية كاملة.
const failures = new Map<string, { count: number; first: number }>();

function corsHeaders(_origin: string | null) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function isBlocked(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILS;
}

function recordFailure(key: string) {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    failures.set(key, { count: 1, first: now });
  } else {
    entry.count += 1;
  }
}

const ACTIONS: Record<string, { rpc: string; args: (b: Record<string, string>) => Record<string, string> }> = {
  reports: { rpc: "get_reports_for_password", args: (b) => ({ p_password: b.password }) },
  manager_name: { rpc: "get_manager_name", args: (b) => ({ p_password: b.password }) },
  delete: { rpc: "delete_report", args: (b) => ({ p_password: b.password, p_branch_id: b.branchId }) },
  change_password: { rpc: "change_password_any", args: (b) => ({ p_old: b.password, p_new: b.newPassword }) },
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, origin);

  const key = clientKey(req);
  if (isBlocked(key)) return json({ error: "too many attempts, try later" }, 429, origin);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400, origin);
  }

  const action = ACTIONS[body.action];
  if (!action) return json({ error: "unknown action" }, 400, origin);
  if (typeof body.password !== "string" || body.password.length === 0 || body.password.length > 200) {
    return json({ error: "bad password" }, 400, origin);
  }
  if (body.action === "change_password") {
    if (typeof body.newPassword !== "string" || body.newPassword.length < 8 || body.newPassword.length > 200) {
      return json({ error: "new password must be 8 to 200 characters" }, 400, origin);
    }
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "server misconfigured" }, 500, origin);

  const res = await fetch(`${url}/rest/v1/rpc/${action.rpc}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action.args(body)),
  });

  const text = await res.text();
  if (!res.ok) {
    if (text.includes("wrong password")) {
      recordFailure(key);
      return json({ error: "wrong password" }, 401, origin);
    }
    return json({ error: "request failed" }, 500, origin);
  }

  failures.delete(key);
  return json(text ? JSON.parse(text) : null, 200, origin);
});
