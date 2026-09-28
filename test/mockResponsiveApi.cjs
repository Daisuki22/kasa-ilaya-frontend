const http = require("node:http");

let role = "super_admin";

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost:10000");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (url.pathname === "/__set-role") {
    role = url.searchParams.get("role") || "guest";
    res.end(JSON.stringify({ role }));
    return;
  }

  if (url.pathname.endsWith("/auth.php") && url.searchParams.get("action") === "me") {
    res.end(JSON.stringify({
      id: "responsive-test-user",
      email: "responsive.test@example.com",
      full_name: "Responsive Test User",
      role,
      app_role: role,
    }));
    return;
  }

  if (url.pathname.endsWith("/auth.php")) {
    res.end(JSON.stringify({ enabled: false, valid: true }));
    return;
  }

  if (url.pathname.includes("entities.php") && url.searchParams.get("action") === "availability") {
    res.end(JSON.stringify({ booking_dates: [], manual_schedule_dates: [] }));
    return;
  }

  if (url.pathname.includes("entities.php")) {
    res.end(JSON.stringify([]));
    return;
  }

  res.end(JSON.stringify({ success: true }));
}).listen(10000, "127.0.0.1", () => {
  process.stdout.write("Responsive audit API mock listening on 127.0.0.1:10000\n");
});
