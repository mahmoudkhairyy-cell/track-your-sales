import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { deploymentAccess, deploymentProtectionEnabled, sameOriginWrite } from "../src/lib/deployment-access";
import { proxy } from "../src/proxy";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

// Random ephemeral fixture, never written to a file, database, or log.
const password = randomBytes(32).toString("base64url");
const authorization = `Basic ${Buffer.from(`mahmoud:${password}`).toString("base64")}`;
const hosted = { VERCEL: "1", WORKSPACE_USERNAME: "mahmoud", WORKSPACE_PASSWORD: password };

check("Local use is unchanged unless protection is enabled", () => {
  assert.deepEqual(deploymentAccess(null, {}), { allowed: true, protected: false });
});
check("Vercel always enables the gate, even with PUBLIC_DEPLOYMENT=false", () => {
  assert.equal(deploymentProtectionEnabled({ VERCEL: "1", PUBLIC_DEPLOYMENT: "false" }), true);
  const result = deploymentAccess(null, { VERCEL: "1", PUBLIC_DEPLOYMENT: "false" });
  assert.ok(!result.allowed && result.status === 503);
});
check("Missing or weak hosting credentials fail closed", () => {
  for (const value of [undefined, "", "short", " ".repeat(40)]) {
    const result = deploymentAccess(null, { PUBLIC_DEPLOYMENT: "true", WORKSPACE_PASSWORD: value });
    assert.ok(!result.allowed && result.status === 503);
  }
});
check("An explicit password protects self-hosted deployments too", () => {
  assert.equal(deploymentProtectionEnabled({ WORKSPACE_PASSWORD: password }), true);
});
check("Only the exact username and password are accepted", () => {
  assert.deepEqual(deploymentAccess(authorization, hosted), { allowed: true, protected: true });
  for (const header of [null, "Basic !!!", "Bearer no", `Basic ${Buffer.from("other:wrong").toString("base64")}`]) {
    const result = deploymentAccess(header, hosted);
    assert.ok(!result.allowed && result.status === 401);
  }
});
check("Cross-origin browser writes are rejected", () => {
  assert.equal(sameOriginWrite(new Request("https://sales.example/api/entries", {
    method: "POST", headers: { Origin: "https://other.example" },
  })), false);
  assert.equal(sameOriginWrite(new Request("https://sales.example/api/entries", {
    method: "POST", headers: { Origin: "https://sales.example" },
  })), true);
});

const keys = ["VERCEL", "PUBLIC_DEPLOYMENT", "WORKSPACE_USERNAME", "WORKSPACE_PASSWORD"] as const;
const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
try {
  process.env.VERCEL = "1";
  process.env.PUBLIC_DEPLOYMENT = "true";
  process.env.WORKSPACE_USERNAME = "mahmoud";
  process.env.WORKSPACE_PASSWORD = password;

  check("Pages and all personal data APIs require credentials", () => {
    for (const path of ["/home", "/more", "/wiki", "/api/dashboard", "/api/entries", "/api/backup/export", "/api/profile"]) {
      const response = proxy(new NextRequest(`https://sales.example${path}`));
      assert.equal(response.status, 401, path);
      assert.match(response.headers.get("WWW-Authenticate") || "", /^Basic /);
      assert.match(response.headers.get("Cache-Control") || "", /no-store/);
    }
  });
  check("Create, update, delete, restore and clear routes cannot bypass the gate", () => {
    for (const [method, path] of [
      ["POST", "/api/entries"], ["PATCH", "/api/entries/test"], ["DELETE", "/api/entries/test"],
      ["POST", "/api/backup/restore"], ["POST", "/api/months/2026-10/clear"],
    ]) {
      assert.equal(proxy(new NextRequest(`https://sales.example${path}`, { method })).status, 401);
    }
  });
  check("Authenticated requests pass without exposing credentials", () => {
    const response = proxy(new NextRequest("https://sales.example/api/dashboard", { headers: { authorization } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("X-Frame-Options"), "DENY");
    assert.equal(JSON.stringify(Array.from(response.headers.entries())).includes(password), false);
  });
  check("Authenticated cross-origin writes still fail", () => {
    const response = proxy(new NextRequest("https://sales.example/api/entries", {
      method: "POST", headers: { authorization, origin: "https://other.example" },
    }));
    assert.equal(response.status, 403);
  });
  check("Only the minimal health endpoint bypasses the gate", () => {
    assert.equal(proxy(new NextRequest("https://sales.example/api/health")).status, 200);
    assert.equal(proxy(new NextRequest("https://sales.example/api/health/extra")).status, 401);
    assert.equal(proxy(new NextRequest("https://sales.example/api/health", { method: "POST" })).status, 401);
  });
  check("Old project ZIPs, including encoded filenames, are not published", () => {
    for (const path of ["/targetx-merged.zip", "/targetx-merged%2Ezip", "/download/targetx-merged.zip"]) {
      assert.equal(proxy(new NextRequest(`https://sales.example${path}`, { headers: { authorization } })).status, 404);
    }
  });
  check("Removing deployment credentials closes the app, not opens it", () => {
    delete process.env.WORKSPACE_PASSWORD;
    assert.equal(proxy(new NextRequest("https://sales.example/home")).status, 503);
    assert.equal(proxy(new NextRequest("https://sales.example/api/backup/export")).status, 503);
  });
} finally {
  for (const key of keys) {
    const value = before[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
console.log(`${passed}/${passed} deployment protection checks passed. No database or external hosting writes.`);
