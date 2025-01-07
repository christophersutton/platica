import { fetch } from "bun";

const API_URL = process.env["API_URL"] || "http://localhost:3000";
const TEST_EMAIL = process.env["TEST_EMAIL"] || "test@example.com";

if (!process.env["TEST_EMAIL"])
  console.warn(
    "⚠️  Warning: TEST_EMAIL not set in environment, using default value"
  );

async function testEndpoints() {
  console.log("🧪 Starting endpoint tests...\n");

  // Test health endpoint
  console.log("Testing health endpoint...");
  const healthResponse = await fetch(`${API_URL}/health`);
  console.log("Health status:", healthResponse.status);
  console.log("Response:", await healthResponse.json());
  console.log();

  // Request magic link
  console.log("Requesting magic link...");
  const magicLinkResponse = await fetch(`${API_URL}/api/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL }),
  });
  console.log("Magic link status:", magicLinkResponse.status);
  const magicLinkData = await magicLinkResponse.json() as {
    message: string;
    magicLink?: string;
    token?: string;
  };
  console.log("Response:", magicLinkData);
  console.log();

  // Get token directly from response in development mode
  const token = magicLinkData.token;
  if (!token) {
    throw new Error("No token received from magic link endpoint");
  }
  console.log("Token:", token);
  console.log();

  // Verify token and get JWT
  console.log("Verifying token...");
  const verifyResponse = await fetch(`${API_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const { token: jwt, user } = (await verifyResponse.json()) as {
    token: string;
    user: { id: number; email: string; name: string };
  };
  console.log("Verify status:", verifyResponse.status);
  console.log("JWT:", jwt);
  console.log("User:", user);
  console.log();

  // Test protected endpoint
  console.log("Testing protected endpoint...");
  const channelsResponse = await fetch(
    `${API_URL}/api/read/workspaces/1/channels`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  );
  console.log("Protected endpoint status:", channelsResponse.status);
  console.log("Response:", await channelsResponse.json());
}

testEndpoints().catch(console.error);
