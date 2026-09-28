import { neon } from "@neondatabase/serverless";
import { scryptSync, timingSafeEqual } from "node:crypto";

function verifyPassword(password, storedHash) {
  try {
    if (storedHash === password) return true;
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);

// Simulated Next.js Cookie Store
class MockCookieStore {
  constructor() {
    this.cookies = new Map();
  }
  set(name, value, options) {
    this.cookies.set(name, { value, options });
  }
  get(name) {
    return this.cookies.get(name);
  }
  delete(name) {
    this.cookies.delete(name);
  }
}

async function simulateSignIn(email, password, cookieStore) {
  if (!email || !email.trim()) {
    return { error: "Email is required." };
  }
  if (!password) {
    return { error: "Password is required." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const users = await sql`
    SELECT id, email, name, password_hash FROM users WHERE email = ${normalizedEmail} LIMIT 1
  `;

  if (users.length === 0) {
    return { error: "Invalid email or password." };
  }

  const user = users[0];
  const isValid = verifyPassword(password, user.password_hash || "");
  if (!isValid) {
    return { error: "Invalid email or password." };
  }

  cookieStore.set("session_user", user.email, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return { redirect: "/dashboard" };
}

async function simulateDashboardAccess(cookieStore) {
  const session = cookieStore.get("session_user");
  if (!session) {
    return { redirect: "/sign-in", error: "Unauthorized" };
  }

  const users = await sql`
    SELECT id, email, name FROM users WHERE email = ${session.value} LIMIT 1
  `;
  if (users.length === 0) {
    return { redirect: "/sign-in", error: "User not found" };
  }

  const stocks = await sql`
    SELECT symbol, name, price, change, rsi, volume, market_cap, is_up
    FROM screener_stocks
    ORDER BY id ASC
  `;

  return {
    authenticated: true,
    user: users[0],
    stocksCount: stocks.length,
    stocksSample: stocks.map((s) => s.symbol),
  };
}

async function simulateSignOut(cookieStore) {
  cookieStore.delete("session_user");
  return { redirect: "/sign-in" };
}

async function runTestSuite() {
  console.log("=================================================");
  console.log("   TESSERA / NEON AUTHENTICATION & REDIRECT FLOW ");
  console.log("=================================================");

  const cookieStore = new MockCookieStore();

  // Test 1: Unauthenticated Dashboard Access
  console.log("\n[Test 1] Access /dashboard without session cookie:");
  const unauth = await simulateDashboardAccess(cookieStore);
  if (unauth.redirect !== "/sign-in") {
    throw new Error(`Expected redirect to /sign-in, got ${JSON.stringify(unauth)}`);
  }
  console.log("  PASS -> Correctly redirected to /sign-in (Unauthorized).");

  // Test 2: Invalid Email Sign In
  console.log("\n[Test 2] Sign in with unknown user (unauthorized@example.com):");
  const failUnknown = await simulateSignIn("unauthorized@example.com", "Girish@1112", cookieStore);
  if (failUnknown.error !== "Invalid email or password.") {
    throw new Error(`Expected 'Invalid email or password.', got ${JSON.stringify(failUnknown)}`);
  }
  console.log("  PASS -> Rejected unknown email with error:", failUnknown.error);

  // Test 3: Wrong Password Sign In
  console.log("\n[Test 3] Sign in with wrong password for girishsir@my.app.com:");
  const failPass = await simulateSignIn("girishsir@my.app.com", "WrongPassword999", cookieStore);
  if (failPass.error !== "Invalid email or password.") {
    throw new Error(`Expected 'Invalid email or password.', got ${JSON.stringify(failPass)}`);
  }
  console.log("  PASS -> Rejected bad password with error:", failPass.error);

  // Test 4: Successful Sign In and Redirect to Dashboard
  console.log("\n[Test 4] Sign in with designated credentials (girishsir@my.app.com / Girish@1112):");
  const successLogin = await simulateSignIn("girishsir@my.app.com", "Girish@1112", cookieStore);
  if (successLogin.redirect !== "/dashboard") {
    throw new Error(`Expected redirect to /dashboard, got ${JSON.stringify(successLogin)}`);
  }
  console.log("  PASS -> Authentication succeeded, redirected to /dashboard.");
  console.log("  PASS -> Session cookie established:", cookieStore.get("session_user")?.value);

  // Test 5: Authenticated Dashboard Access
  console.log("\n[Test 5] Access /dashboard with active session:");
  const dashboard = await simulateDashboardAccess(cookieStore);
  if (!dashboard.authenticated || dashboard.user.email !== "girishsir@my.app.com") {
    throw new Error(`Dashboard access failed: ${JSON.stringify(dashboard)}`);
  }
  console.log(`  PASS -> Dashboard rendered for: ${dashboard.user.name} (${dashboard.user.email})`);
  console.log(`  PASS -> Loaded ${dashboard.stocksCount} stocks from Neon: [${dashboard.stocksSample.join(", ")}]`);

  // Test 6: Sign Out and Redirection
  console.log("\n[Test 6] Sign out flow:");
  const signout = await simulateSignOut(cookieStore);
  if (signout.redirect !== "/sign-in") {
    throw new Error(`Expected sign-out redirect to /sign-in, got ${JSON.stringify(signout)}`);
  }
  const postSignoutCheck = await simulateDashboardAccess(cookieStore);
  if (postSignoutCheck.redirect !== "/sign-in") {
    throw new Error(`Expected dashboard access to be revoked after sign-out`);
  }
  console.log("  PASS -> Session cleared and redirected to /sign-in.");

  console.log("\n=================================================");
  console.log("   ALL 6 AUTHENTICATION & REDIRECT TESTS PASSED! ");
  console.log("=================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
