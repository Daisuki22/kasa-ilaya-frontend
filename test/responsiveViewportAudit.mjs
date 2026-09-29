const sizes = [
  [320, 568], [360, 640], [375, 667], [390, 844], [414, 896], [430, 932],
  [600, 800], [768, 1024], [820, 1180], [1024, 1366],
  [1280, 720], [1366, 768], [1440, 900], [1600, 900], [1920, 1080], [2560, 1440],
];
const mainRoutes = [
  ["guest", "/"], ["guest", "/About"], ["guest", "/Contact"], ["guest", "/Packages"],
  ["guest", "/BookingForm"], ["guest", "/MyBookings"],
  ["guest", "/ProfileSettings"], ["guest", "/Login"], ["guest", "/ForgotPassword"],
  ["guest", "/VerifyRegistrationOtp"], ["guest", "/ResetPassword"],
  ["super_admin", "/AdminDashboard"], ["super_admin", "/AdminCalendar"],
  ["super_admin", "/AdminPackages"],
  ["super_admin", "/AdminReport"], ["super_admin", "/AdminInquiries"],
  ["super_admin", "/AdminPaymentMonitoring"], ["super_admin", "/AdminPaymentQRCodes"],
  ["super_admin", "/AdminUserPermissions"], ["super_admin", "/AdminSecuritySettings"],
  ["super_admin", "/AdminSystemSettings"], ["super_admin", "/AdminPackageArchive"],
  ["super_admin", "/AdminActivityLogs"],
];
const focusedRoutes = new Set(["/", "/Packages", "/BookingForm", "/MyBookings", "/ProfileSettings", "/AdminDashboard", "/AdminCalendar", "/AdminReport"]);
const targets = await fetch("http://127.0.0.1:9225/json/list").then((response) => response.json());
const page = targets.find((target) => target.type === "page" && target.url.includes("127.0.0.1:5175"));
if (!page) throw new Error("Responsive audit Chrome tab was not found.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let nextId = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++nextId;
  pending.set(id, resolve);
  socket.send(JSON.stringify({ id, method, params }));
});
const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
const waitForApp = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ready = await send("Runtime.evaluate", {
      expression: "document.readyState === 'complete' && !!document.querySelector('main')",
      returnByValue: true,
    });
    if (ready.result?.result?.value) return;
    await wait(100);
  }
};

await send("Page.enable");
await send("Runtime.enable");
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: "localStorage.setItem('ki-authenticated:/api', 'true'); sessionStorage.setItem('ki-welcome-intro-shown', 'true');",
});

const results = [];
for (const [role, route] of mainRoutes) {
  await fetch(`http://127.0.0.1:10000/__set-role?role=${role}`);
  const routeSizes = focusedRoutes.has(route) ? sizes : [[320, 568], [390, 844], [768, 1024], [1024, 1366], [1366, 768], [1920, 1080]];
  for (const [width, height] of routeSizes) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 640 });
    await send("Page.navigate", { url: `http://127.0.0.1:5175${route}` });
    await waitForApp();
    await wait(220);
    const measured = await send("Runtime.evaluate", {
      expression: `JSON.stringify((()=>{
        const root=document.documentElement, body=document.body;
        const oldRoot=root.style.overflowX, oldBody=body.style.overflowX;
        root.style.overflowX="visible"; body.style.overflowX="visible";
        const width=innerWidth;
        const candidates=[...document.querySelectorAll("body *")].filter(el=>{
          const r=el.getBoundingClientRect(),s=getComputedStyle(el);
          if(!r.width||!r.height||s.display==="none"||s.visibility==="hidden")return false;
          if(el.closest("[aria-hidden=true]"))return false;
          if(el.closest(".overflow-x-auto, [style*=overflow-x]"))return false;
          return r.right>width+2||r.left < -2;
        }).slice(0,8).map(el=>{
          const r=el.getBoundingClientRect();
          return {tag:el.tagName,cls:String(el.className||"").slice(0,100),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};
        });
        const result={path:location.pathname,width,documentWidth:Math.max(root.scrollWidth,body.scrollWidth),overflow:Math.max(root.scrollWidth,body.scrollWidth)>width+2,candidates};
        root.style.overflowX=oldRoot; body.style.overflowX=oldBody;
        return result;
      })())`,
      returnByValue: true,
    });
    const value = JSON.parse(measured.result.result.value);
    results.push({ role, requestedRoute: route, ...value });
  }
}

const failures = results.filter((result) => result.overflow);
console.log(JSON.stringify({
  cases: results.length,
  sizes: [...new Set(results.map((result) => result.width))],
  overflowCases: failures,
  inaccessibleRoutes: results.filter((result) => result.path !== result.requestedRoute).map(({ requestedRoute, path, width }) => ({ requestedRoute, path, width })),
}, null, 2));
socket.close();
