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
  const healthResponse = await fetch(`${API_URL}/api/health`);
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
    data: {
      message: string;
      magicLink?: string;
      token?: string;
    }
  };
  console.log("Response:", magicLinkData);
  console.log();

  // Get token directly from response in development mode
  const token = magicLinkData.data?.token;
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
  const verifyData = await verifyResponse.json() as {
    data: {
      token: string;
      user: { id: number; email: string; name: string };
    }
  };
  const { token: jwt, user } = verifyData.data;
  console.log("Verify status:", verifyResponse.status);
  console.log("JWT:", jwt);
  console.log("User:", user);
  console.log();

  // Test protected endpoints
  console.log("Testing protected endpoints...");
  
  // First get list of workspaces
  console.log("\nGetting workspaces list...");
  const workspacesResponse = await fetch(`${API_URL}/api/workspaces`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  console.log("Workspaces status:", workspacesResponse.status);
  const workspacesText = await workspacesResponse.text();
  
  try {
    const workspacesData = JSON.parse(workspacesText);
    console.log("Workspaces:", workspacesData);

    // Get first workspace details
    if (workspacesData.data?.length > 0) {
      const workspaceId = workspacesData.data[0].id;
      console.log("\nGetting workspace details...");
      const workspaceResponse = await fetch(`${API_URL}/api/workspaces/${workspaceId}`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      console.log("Workspace status:", workspaceResponse.status);
      const workspaceText = await workspaceResponse.text();
      
      try {
        const workspaceData = JSON.parse(workspaceText);
        console.log("Workspace:", workspaceData);
      } catch (error) {
        console.error("Failed to parse workspace response:", workspaceText);
        throw error;
      }
    }
  } catch (error) {
    console.error("Failed to parse workspaces response:", workspacesText);
    throw error;
  }
}

testEndpoints().catch(console.error);
