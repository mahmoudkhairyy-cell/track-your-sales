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
// In-memory fallback, used only if the database counter is unreachable.
function isBlockedMemory(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) { failures.delete(key); return false; }
  return entry.count >= MAX_FAILS;
}
function recordFailureMemory(key: string) {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || now - entry.first > WINDOW_MS) failures.set(key, { count: 1, first: now });
  else entry.count += 1;
}
// Persistent counters in Postgres (migration 20261127110000): the limit
// survives edge-function cold starts and is shared across instances.
async function isBlocked(url: string, serviceKey: string, key: string): Promise<boolean> {
  try {
    const res = await rpc(url, serviceKey, "manager_api_is_blocked", { p_key: key, p_max: MAX_FAILS, p_window_ms: WINDOW_MS });
    if (res.ok) return (await res.json()) === true;
  } catch { /* fall back to the in-memory limiter */ }
  return isBlockedMemory(key);
}
async function recordFailure(url: string, serviceKey: string, key: string) {
  recordFailureMemory(key);
  try {
    await rpc(url, serviceKey, "manager_api_record_failure", { p_key: key, p_window_ms: WINDOW_MS });
  } catch { /* the in-memory entry above still counts this attempt */ }
}
async function clearFailures(url: string, serviceKey: string, key: string) {
  failures.delete(key);
  try {
    await rpc(url, serviceKey, "manager_api_clear_failures", { p_key: key });
  } catch { /* a later wrong attempt recreates the row */ }
}
async function rpc(url: string, serviceKey: string, name: string, args: Record<string, unknown>) {
  return await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
}

async function restRows(url: string, serviceKey: string, table: string, query: URLSearchParams) {
  const res = await fetch(`${url}/rest/v1/${table}?${query.toString()}`, {
    headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
  });
  if (!res.ok) throw new Error(`database read failed: ${table}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}
async function restUpsert(url: string, serviceKey: string, table: string, row: Record<string, unknown>, onConflict: string) {
  const query = new URLSearchParams({ on_conflict: onConflict });
  const res = await fetch(`${url}/rest/v1/${table}?${query.toString()}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`database write failed: ${table}`);
}
// Branch manager actions are protected by a per-branch password, verified
// against branch_manager_access with crypt() — same pattern as manager_areas.
async function verifyBranchManager(url: string, serviceKey: string, branch: string, password: unknown): Promise<"ok" | "wrong" | "error"> {
  if (typeof password !== "string" || password.length === 0 || password.length > 200) return "wrong";
  try {
    const res = await rpc(url, serviceKey, "verify_branch_manager", { p_branch: branch, p_password: password });
    if (res.ok) return "ok";
    const text = await res.text();
    return text.includes("wrong password") ? "wrong" : "error";
  } catch {
    return "error";
  }
}

function normalizeEmployeeIdentity(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function validPercent(value: unknown, max = 1000): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (origin !== ALLOWED_ORIGIN) return json({ error: "origin not allowed" }, 403);
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "server misconfigured" }, 500);

  const key = clientKey(req);
  if (await isBlocked(url, serviceKey, key)) return json({ error: "too many attempts, try later" }, 429);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "bad json" }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return json({ error: "bad json" }, 400); }

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

    // Reuse the same employee row even if the entered name differs only by
    // letter casing or repeated/leading/trailing whitespace.
    let effectiveBranchId = branchId;
    const query = new URLSearchParams({
      select: "branch_id,employee_name",
      branch_name: `eq.${branch.trim().slice(0, 80)}`,
      order: "updated_at.desc",
      limit: "100",
    });
    query.set("payload->>areaManager", `eq.${areaManager}`);
    const existing = await fetch(`${url}/rest/v1/branch_reports?${query.toString()}`, {
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
    });
    if (!existing.ok) return json({ error: "تعذر التحقق من سجل الموظف الحالي" }, 500);
    const matches = await existing.json();
    if (Array.isArray(matches)) {
      const normalizedEmployee = normalizeEmployeeIdentity(employee);
      const match = matches.find((row) =>
        typeof row?.branch_id === "string" &&
        typeof row?.employee_name === "string" &&
        normalizeEmployeeIdentity(row.employee_name) === normalizedEmployee
      );
      if (match?.branch_id) effectiveBranchId = match.branch_id;
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

  if (body.action === "branch_reports") {
    const branch = typeof body.branch === "string" ? body.branch.trim() : "";
    const month = typeof body.yearMonth === "string" ? body.yearMonth : "";
    if (branch.length < 2 || branch.length > 100 || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return json({ error: "فرع أو شهر غير صالح" }, 400);
    }
    const check = await verifyBranchManager(url, serviceKey, branch, body.password);
    if (check === "wrong") { await recordFailure(url, serviceKey, key); return json({ error: "wrong password" }, 401); }
    if (check === "error") return json({ error: "تعذر التحقق من كلمة المرور" }, 500);
    await clearFailures(url, serviceKey, key);
    try {
      const reportQuery = new URLSearchParams({
        select: "branch_id,employee_name,branch_name,payload,updated_at",
        branch_name: `eq.${branch}`,
        order: "employee_name.asc",
      });
      const [allBranchReports, monthly, overrides, audit] = await Promise.all([
        restRows(url, serviceKey, "branch_reports", reportQuery),
        restRows(url, serviceKey, "branch_manager_monthly", new URLSearchParams({
          select: "productivity_percent,updated_by,updated_at",
          branch_name: `eq.${branch}`,
          year_month: `eq.${month}`,
          limit: "1",
        })),
        restRows(url, serviceKey, "branch_manager_employee_overrides", new URLSearchParams({
          select: "employee_name,quality,updated_by,updated_at",
          branch_name: `eq.${branch}`,
          year_month: `eq.${month}`,
        })),
        restRows(url, serviceKey, "branch_manager_audit", new URLSearchParams({
          select: "id,employee_name,field_name,old_value,new_value,updated_by,updated_at",
          branch_name: `eq.${branch}`,
          year_month: `eq.${month}`,
          order: "updated_at.desc",
          limit: "100",
        })),
      ]);
      // Legacy reports created before yearMonth was added are included only
      // when their last sync timestamp falls inside the selected month.
      const reports = allBranchReports.filter((row) => {
        const payload = row?.payload && typeof row.payload === "object"
          ? row.payload as Record<string, unknown>
          : {};
        return payload.yearMonth === month ||
          (!payload.yearMonth && String(row?.updated_at ?? "").slice(0, 7) === month);
      });
      return json({ reports, productivity: monthly[0] ?? null, qualityOverrides: overrides, audit }, 200);
    } catch {
      return json({ error: "تعذر تحميل بيانات الفرع" }, 500);
    }
  }

  if (body.action === "save_branch_productivity") {
    const branch = typeof body.branch === "string" ? body.branch.trim() : "";
    const month = typeof body.yearMonth === "string" ? body.yearMonth : "";
    const managerName = typeof body.managerName === "string" ? body.managerName.trim() : "";
    const value = body.productivityPercent;
    if (branch.length < 2 || branch.length > 100 || managerName.length < 2 || managerName.length > 80 ||
        !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month) || !validPercent(value)) {
      return json({ error: "بيانات الإنتاجية غير صالحة" }, 400);
    }
    const check = await verifyBranchManager(url, serviceKey, branch, body.password);
    if (check === "wrong") { await recordFailure(url, serviceKey, key); return json({ error: "wrong password" }, 401); }
    if (check === "error") return json({ error: "تعذر التحقق من كلمة المرور" }, 500);
    try {
      await restUpsert(url, serviceKey, "branch_manager_monthly", {
        branch_name: branch, year_month: month, productivity_percent: value,
        updated_by: managerName, updated_at: new Date().toISOString(),
      }, "branch_name,year_month");
      return json({ ok: true }, 200);
    } catch {
      return json({ error: "تعذر حفظ الإنتاجية" }, 500);
    }
  }

  if (body.action === "save_branch_quality") {
    const branch = typeof body.branch === "string" ? body.branch.trim() : "";
    const employee = typeof body.employeeName === "string" ? body.employeeName.trim() : "";
    const month = typeof body.yearMonth === "string" ? body.yearMonth : "";
    const managerName = typeof body.managerName === "string" ? body.managerName.trim() : "";
    const quality = body.quality;
    const keys = ["kyc", "visits", "training", "pos", "csat"];
    if (branch.length < 2 || branch.length > 100 || employee.length < 2 || employee.length > 80 ||
        managerName.length < 2 || managerName.length > 80 || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month) ||
        !quality || typeof quality !== "object" || Array.isArray(quality) ||
        !keys.every((key) => validPercent((quality as Record<string, unknown>)[key], 100))) {
      return json({ error: "بيانات الجودة غير صالحة؛ كل بند لازم يكون من 0 إلى 100" }, 400);
    }
    const check = await verifyBranchManager(url, serviceKey, branch, body.password);
    if (check === "wrong") { await recordFailure(url, serviceKey, key); return json({ error: "wrong password" }, 401); }
    if (check === "error") return json({ error: "تعذر التحقق من كلمة المرور" }, 500);
    try {
      await restUpsert(url, serviceKey, "branch_manager_employee_overrides", {
        branch_name: branch, employee_name: employee, year_month: month,
        quality: Object.fromEntries(keys.map((key) => [key, (quality as Record<string, number>)[key]])),
        updated_by: managerName, updated_at: new Date().toISOString(),
      }, "branch_name,employee_name,year_month");
      return json({ ok: true }, 200);
    } catch {
      return json({ error: "تعذر حفظ الجودة" }, 500);
    }
  }

  if (body.action === "submit_contracts") {
    // دفع التعاقدات من جهاز موظف: بلا كلمة مرور، لكن بنفس تحقق submit_report
    // (مدير المنطقة لازم يكون اسمًا حقيقيًا من جدول المديرين).
    const branchId = body.branchId;
    const employee = body.employee;
    const branch = body.branch;
    const areaManager = body.areaManager;
    const contracts = body.contracts;
    const deletedIds = body.deletedIds;
    if (typeof branchId !== "string" || branchId.length < 8 || branchId.length > 80 ||
        typeof employee !== "string" || employee.trim().length < 2 ||
        typeof branch !== "string" || branch.trim().length < 2 ||
        typeof areaManager !== "string" || areaManager.trim().length < 2 ||
        !Array.isArray(contracts) || contracts.length > 500 ||
        (deletedIds !== undefined && (!Array.isArray(deletedIds) || deletedIds.length > 500))) {
      return json({ error: "invalid contracts payload" }, 400);
    }
    const managerQuery = new URLSearchParams({ select: "name", name: `eq.${areaManager.trim()}`, limit: "1" });
    const managerRes = await fetch(`${url}/rest/v1/manager_areas?${managerQuery.toString()}`, {
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
    });
    if (!managerRes.ok) return json({ error: "تعذر التحقق من مدير المنطقة" }, 500);
    const managerRows = await managerRes.json();
    if (!Array.isArray(managerRows) || !managerRows.some((row) => row?.name === areaManager.trim())) {
      return json({ error: "مدير المنطقة المختار غير موجود" }, 400);
    }
    for (const item of contracts as Record<string, unknown>[]) {
      const res = await rpc(url, serviceKey, "upsert_contract", {
        p_id: item.id,
        p_branch_id: branchId,
        p_employee: employee,
        p_branch: branch,
        p_area_manager: areaManager.trim(),
        p_client: item.client,
        p_status: item.status,
        p_contract_date: item.contractDate,
        p_sent_date: item.sentDate ?? null,
        p_note: item.note ?? null,
      });
      if (!res.ok) return json({ error: "contract sync failed" }, 500);
    }
    for (const id of (deletedIds ?? []) as unknown[]) {
      if (typeof id !== "string") continue;
      const res = await rpc(url, serviceKey, "delete_contract", { p_id: id, p_branch_id: branchId });
      if (!res.ok) return json({ error: "contract delete failed" }, 500);
    }
    return json({ ok: true }, 200);
  }

  if (body.action === "branch_contracts") {
    // مدير الفرع يشوف تعاقدات فرعه بكلمة مرور الفرع (نفس تحقق branch_reports).
    const branch = typeof body.branch === "string" ? body.branch.trim() : "";
    if (branch.length < 2 || branch.length > 100) {
      return json({ error: "فرع غير صالح" }, 400);
    }
    const check = await verifyBranchManager(url, serviceKey, branch, body.password);
    if (check === "wrong") { await recordFailure(url, serviceKey, key); return json({ error: "wrong password" }, 401); }
    if (check === "error") return json({ error: "تعذر التحقق من كلمة المرور" }, 500);
    await clearFailures(url, serviceKey, key);
    try {
      const rows = await restRows(url, serviceKey, "contracts", new URLSearchParams({
        select: "id,employee_name,branch_name,client_name,status,contract_date,sent_date,note,updated_at",
        branch_name: `eq.${branch}`,
        order: "contract_date.desc",
        limit: "1000",
      }));
      return json({ contracts: rows }, 200);
    } catch {
      return json({ error: "تعذر تحميل التعاقدات" }, 500);
    }
  }

  const actions: Record<string, { rpc: string; args: (b: Record<string, unknown>) => Record<string, unknown> }> = {
    reports: { rpc: "get_reports_for_password", args: (b) => ({ p_password: b.password }) },
    contracts: { rpc: "get_contracts_for_area_password", args: (b) => ({ p_password: b.password }) },
    delete_contract_area: { rpc: "delete_contract_for_area", args: (b) => ({ p_password: b.password, p_id: b.contractId }) },
    manager_name: { rpc: "get_manager_name", args: (b) => ({ p_password: b.password }) },
    delete: { rpc: "delete_report", args: (b) => ({ p_password: b.password, p_branch_id: b.branchId }) },
    change_password: { rpc: "change_password_any", args: (b) => ({ p_old: b.password, p_new: b.newPassword }) },
    team_leader_branch: { rpc: "get_branch_team_for_team_leader", args: (b) => ({ p_branch: b.branch, p_password: b.password }) },
    change_branch_password: { rpc: "change_branch_manager_password", args: (b) => ({ p_branch: b.branch, p_old: b.password, p_new: b.newPassword }) },
    set_team_leader_password: { rpc: "set_team_leader_password", args: (b) => ({ p_area_password: b.password, p_branch: b.branch, p_new_password: b.newPassword, p_updated_by: b.updatedBy }) },
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
      await recordFailure(url, serviceKey, key);
      return json({ error: "wrong password" }, 401);
    }
    return json({ error: "request failed" }, 500);
  }
  await clearFailures(url, serviceKey, key);
  let responseData: unknown = responseText ? JSON.parse(responseText) : null;
  if (body.action === "reports" && Array.isArray(responseData)) {
    try {
      const rows = responseData as Record<string, unknown>[];
      const monthKeys = [...new Set(rows.map((row) => (row.payload as Record<string, unknown> | undefined)?.yearMonth).filter((v): v is string => typeof v === "string"))];
      for (const month of monthKeys) {
        const [monthly, overrides] = await Promise.all([
          restRows(url, serviceKey, "branch_manager_monthly", new URLSearchParams({ select: "branch_name,year_month,productivity_percent,updated_by,updated_at", year_month: `eq.${month}` })),
          restRows(url, serviceKey, "branch_manager_employee_overrides", new URLSearchParams({ select: "branch_name,employee_name,year_month,quality,updated_by,updated_at", year_month: `eq.${month}` })),
        ]);
        for (const row of rows) {
          const payload = row.payload as Record<string, unknown> | undefined;
          if (!payload || payload.yearMonth !== month) continue;
          const override = overrides.find((item) => item.branch_name === row.branch_name && item.employee_name === row.employee_name);
          if (override) {
            payload.managerQuality = { quality: override.quality, updatedBy: override.updated_by, updatedAt: override.updated_at };
            const q = override.quality as Record<string, number>;
            const qualityPercent = ((Number(q.kyc) || 0) * 5 + (Number(q.visits) || 0) * 5 +
              (Number(q.training) || 0) * 2 + (Number(q.pos) || 0) + (Number(q.csat) || 0) * 2) / 15;
            const kpis = Array.isArray(payload.kpis) ? payload.kpis as Record<string, unknown>[] : [];
            const qualityKpi = kpis.find((item) => /quality|kyc/i.test(String(item.name ?? "")));
            if (qualityKpi) {
              qualityKpi.achieved = qualityPercent;
              qualityKpi.target = 100;
              qualityKpi.percent = qualityPercent;
            }
          }
          const productivity = monthly.find((item) => item.branch_name === row.branch_name);
          if (productivity) payload.branchManagerProductivity = { percent: productivity.productivity_percent, updatedBy: productivity.updated_by, updatedAt: productivity.updated_at };
        }
      }
    } catch {
      return json({ error: "تعذر تحميل تحديثات مديري الفروع" }, 500);
    }
  }
  return json(responseData, 200);
});
