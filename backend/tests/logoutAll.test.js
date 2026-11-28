
const assert = require("node:assert/strict");

const BASE_URL = "http://localhost:4000";

async function main() {
    // Login details environment variables se lo.
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;

    if (!email || !password) {
        throw new Error(
            "PowerShell mein TEST_EMAIL aur TEST_PASSWORD set karo."
        );
    }

    // 1. Login and capture session cookie locally.
    const loginResponse = await fetch(
        `${BASE_URL}/api/auth/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        }
    );

    const loginBody = await loginResponse.json();

    assert.equal(
        loginResponse.status,
        200,
        `Login failed: ${JSON.stringify(loginBody)}`
    );

    const setCookie = loginResponse.headers.get("set-cookie");

    assert.ok(setCookie, "Login response mein Set-Cookie nahi mila.");

    const cookie = setCookie.split(";")[0];

    assert.ok(
        cookie.startsWith("securevault_session="),
        "Expected session cookie nahi mili."
    );

    assert.ok(
        cookie.length > "securevault_session=".length,
        "Session cookie ki value empty hai."
    );

    console.log("PASS: Login successful; session cookie received.");

    // 2. Verify the session currently works.
    const meBefore = await fetch(
        `${BASE_URL}/api/auth/me`,
        {
            headers: { Cookie: cookie }
        }
    );

    assert.equal(
        meBefore.status,
        200,
        "Logout-all se pehle /me ko 200 dena chahiye."
    );

    console.log("PASS: Session logout-all se pehle valid hai.");

    // 3. Revoke all sessions using this authenticated cookie.
    const logoutAllResponse = await fetch(
        `${BASE_URL}/api/auth/logout-all`,
        {
            method: "POST",
            headers: { Cookie: cookie }
        }
    );

    const logoutAllBody = await logoutAllResponse.json();

    assert.equal(
        logoutAllResponse.status,
        200,
        `Logout-all failed: ${JSON.stringify(logoutAllBody)}`
    );

    console.log("PASS: Logout-all successful.");

    // 4. Reuse the original cookie, not the cleared cookie.
    const meAfter = await fetch(
        `${BASE_URL}/api/auth/me`,
        {
            headers: { Cookie: cookie }
        }
    );

    const meAfterBody = await meAfter.json();

    assert.equal(
        meAfter.status,
        401,
        "FAIL: Revoked session ko protected API ne reject nahi kiya."
    );

    assert.equal(
        meAfterBody.message,
        "Invalid or expired session.",
        `Unexpected response: ${JSON.stringify(meAfterBody)}`
    );

    console.log(
        "PASS: Original revoked session rejected with 401."
    );

    console.log("\nALL TESTS PASSED.");
}

main().catch((error) => {
    console.error("\nTEST FAILED:", error.message);
    process.exitCode = 1;
});
