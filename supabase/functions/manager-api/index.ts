// Employee report sync + authenticated manager actions.
const ALLOWED_ORIGIN = "https://mahmoudkhairyy-cell.github.io";
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders() } });
}
function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
function isBlocked(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) { failures.delete(key); return false; }
  return entry.count >= MAX_FAILS;
}
function recordFailure(key: string) {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || now - entry.first > WINDOW_MS) failures.set(key, { count: 1, first: now });
  else entry.count += 1;
}
async function rpc(url: string, serviceKey: string, name: string, args: Record<string, unknown>) {
  return await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (origin !== ALLOWED_ORIGIN) return json({ error: "origin not allowed" }, 403);
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const key = clientKey(req);
  if (isBlocked(key)) return json({ error: "too many attempts, try later" }, 429);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "bad json" }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return json({ error: "bad json" }, 400); }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "server misconfigured" }, 500);

  if (body.action === "submit_report") {
    const branchId = body.branchId;
    const employee = body.employee;
    const branch = body.branch;
    const payload = body.payload;
    if (typeof branchId !== "string" || branchId.length < 8 || branchId.length > 80 ||
        typeof employee !== "string" || employee.trim().length < 2 ||
        typeof branch !== "string" || branch.trim().length < 2 ||
        !payload || typeof payload !== "object" || Array.isArray(payload) ||
        new TextEncoder().encode(JSON.stringify(payload)).length > 190000) {
      return json({ error: "invalid report" }, 400);
    }

    const areaManager = typeof (payload as Record<string, unknown>).areaManager === "string"
      ? ((payload as Record<string, unknown>).areaManager as string).trim()
      : "";
    if (!areaManager) return json({ error: "اختار مدير المنطقة قبل المزامنة" }, 400);

    // مدير المنطقة لازم يكون اسمًا حقيقيًا من جدول المديرين، مش قيمة يرسلها العميل وخلاص.
    const managerQuery = new URLSearchParams({ select: "name", name: `eq.${areaManager}`, limit: "1" });
    const managerRes = await fetch(`${url}/rest/v1/manager_areas?${managerQuery.toString()}`, {
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
    });
    if (!managerRes.ok) return json({ error: "تعذر التحقق من مدير المنطقة" }, 500);
    const managerRows = await managerRes.json();
    if (!Array.isArray(managerRows) || !managerRows.some((row) => row?.name === areaManager)) {
      return json({ error: "مدير المنطقة المختار غير موجود" }, 400);
    }

    // لا نسمح بإعادة استخدام معرّف محفوظ تحت مدير مختلف أو تقرير قديم بلا مدير.
    const idQuery = new URLSearchParams({ select: "payload", branch_id: `eq.${branchId}`, limit: "1" });
    const idRes = await fetch(`${url}/rest/v1/branch_reports?${idQuery.toString()}`, {
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
    });
    if (!idRes.ok) return json({ error: "تعذر التحقق من ملكية التقرير الحالي" }, 500);
    const idRows = await idRes.json();
    if (Array.isArray(idRows) && idRows.length > 0) {
      const existingManager = typeof idRows[0]?.payload?.areaManager === "string" ? idRows[0].payload.areaManager : "";
      if (existingManager !== areaManager) {
        return json({ error: "التقرير مرتبط بمدير آخر أو غير محدد المدير. تواصل مع المسؤول قبل نقله." }, 409);
      }
    }

    // Reuse an existing row only when employee + branch + manager all match.
    let effectiveBranchId = branchId;
    const query = new URLSearchParams({
      select: "branch_id",
      employee_name: `eq.${employee.trim().slice(0, 80)}`,
      branch_name: `eq.${branch.trim().slice(0, 80)}`,
      order: "updated_at.desc",
      limit: "1",
    });
    query.set("payload->>areaManager", `eq.${areaManager}`);
    const existing = await fetch(`${url}/rest/v1/branch_reports?${query.toString()}`, {
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
    });
    if (existing.ok) {
      const matches = await existing.json();
      if (Array.isArray(matches) && typeof matches[0]?.branch_id === "string") {
        effectiveBranchId = matches[0].branch_id;
      }
    }

    const res = await rpc(url, serviceKey, "submit_report", {
      p_branch_id: effectiveBranchId,
      p_employee: employee.trim().slice(0, 80),
      p_branch: branch.trim().slice(0, 80),
      p_payload: payload,
    });
    if (!res.ok) return json({ error: "report sync failed" }, 500);
    return json({ ok: true }, 200);
  }

  const actions: Record<string, { rpc: string; args: (b: Record<string, unknown>) => Record<string, unknown> }> = {
    reports: { rpc: "get_reports_for_password", args: (b) => ({ p_password: b.password }) },
    manager_name: { rpc: "get_manager_name", args: (b) => ({ p_password: b.password }) },
    delete: { rpc: "delete_report", args: (b) => ({ p_password: b.password, p_branch_id: b.branchId }) },
    change_password: { rpc: "change_password_any", args: (b) => ({ p_old: b.password, p_new: b.newPassword }) },
  };
  const action = typeof body.action === "string" ? actions[body.action] : undefined;
  if (!action) return json({ error: "unknown action" }, 400);
  if (typeof body.password !== "string" || body.password.length === 0 || body.password.length > 200) {
    return json({ error: "bad password" }, 400);
  }
  if (body.action === "change_password" &&
      (typeof body.newPassword !== "string" || body.newPassword.length < 8 || body.newPassword.length > 200)) {
    return json({ error: "new password must be 8 to 200 characters" }, 400);
  }

  const res = await rpc(url, serviceKey, action.rpc, action.args(body));
  const responseText = await res.text();
  if (!res.ok) {
    if (responseText.includes("wrong password")) {
      recordFailure(key);
      return json({ error: "wrong password" }, 401);
    }
    return json({ error: "request failed" }, 500);
  }
  failures.delete(key);
  return json(responseText ? JSON.parse(responseText) : null, 200);
});
