// Nova Desktop Companion — main process
// Executes computer control, file ops, and Playwright browser automation,
// with explicit user approval for every action.

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const crypto = require("crypto");
const { spawn, exec } = require("child_process");

const PORT = 43117;
const CONFIG_DIR = path.join(os.homedir(), ".nova-companion");
const TOKEN_FILE = path.join(CONFIG_DIR, "token");
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
let SESSION_TOKEN = fs.existsSync(TOKEN_FILE)
  ? fs.readFileSync(TOKEN_FILE, "utf8").trim()
  : null;
if (!SESSION_TOKEN) {
  SESSION_TOKEN = crypto.randomBytes(24).toString("hex");
  fs.writeFileSync(TOKEN_FILE, SESSION_TOKEN, { mode: 0o600 });
}

let mainWindow;
const pending = new Map(); // id -> { resolve, action }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 640,
    title: "Nova Desktop Companion",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("token", SESSION_TOKEN);
  });
}

// ---------- Action executors ----------

function expandHome(p) {
  if (!p) return p;
  if (p === "~" || p.startsWith("~/")) return path.join(os.homedir(), p.slice(1));
  return p;
}

function summarize(action) {
  switch (action.type) {
    case "open_app":  return `Open application: ${action.name}`;
    case "close_app": return `Close application: ${action.name}`;
    case "file_op":   return `File ${action.op}: ${action.path}${action.to ? " → " + action.to : ""}${action.query ? " (query: " + action.query + ")" : ""}`;
    case "automate_browser": return `Browser automation: ${action.goal || (action.steps?.length || 0) + " steps"}`;
    default: return `Unknown action: ${action.type}`;
  }
}

async function executeOpenApp(name) {
  const platform = process.platform;
  return new Promise((resolve, reject) => {
    let cmd, args;
    if (platform === "darwin") { cmd = "open"; args = ["-a", name]; }
    else if (platform === "win32") { cmd = "cmd"; args = ["/c", "start", "", name]; }
    else { cmd = "xdg-open"; args = [name]; }
    const proc = spawn(cmd, args, { stdio: "ignore", detached: true });
    proc.on("error", reject);
    proc.unref();
    setTimeout(() => resolve({ ok: true, message: `Launched ${name}` }), 300);
  });
}

async function executeCloseApp(name) {
  const platform = process.platform;
  return new Promise((resolve) => {
    let cmd;
    if (platform === "darwin") cmd = `osascript -e 'quit app "${name.replace(/"/g, '\\"')}"'`;
    else if (platform === "win32") cmd = `taskkill /IM "${name}" /F`;
    else cmd = `pkill -f "${name}"`;
    exec(cmd, (err) => {
      if (err) resolve({ ok: false, message: `Could not close ${name}: ${err.message}` });
      else resolve({ ok: true, message: `Closed ${name}` });
    });
  });
}

async function executeFileOp(action) {
  const p = expandHome(action.path);
  switch (action.op) {
    case "create_folder":
      fs.mkdirSync(p, { recursive: true });
      return { ok: true, message: `Created folder ${p}` };
    case "list": {
      const entries = fs.readdirSync(p, { withFileTypes: true })
        .map((e) => ({ name: e.name, dir: e.isDirectory() }));
      return { ok: true, message: `${entries.length} entries`, data: entries };
    }
    case "rename": {
      const to = expandHome(action.to);
      fs.renameSync(p, to);
      return { ok: true, message: `Renamed → ${to}` };
    }
    case "search": {
      const q = String(action.query || "").toLowerCase();
      const matches = [];
      const walk = (d, depth) => {
        if (depth > 4) return;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (e.name.toLowerCase().includes(q)) matches.push(full);
          if (e.isDirectory() && !e.name.startsWith(".")) {
            try { walk(full, depth + 1); } catch { /* skip */ }
          }
          if (matches.length > 200) return;
        }
      };
      walk(p, 0);
      return { ok: true, message: `${matches.length} matches`, data: matches.slice(0, 200) };
    }
    default:
      return { ok: false, message: `Unknown file op: ${action.op}` };
  }
}

async function executeBrowser(action) {
  let playwright;
  try { playwright = require("playwright"); }
  catch { return { ok: false, message: "Playwright not installed. Run `npm install` in desktop/." }; }
  const steps = Array.isArray(action.steps) ? action.steps : [];
  if (steps.length === 0) return { ok: false, message: "No steps provided." };
  const browser = await playwright.chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const results = [];
  try {
    for (const step of steps) {
      switch (step.action) {
        case "goto": await page.goto(step.url, { waitUntil: "domcontentloaded" }); results.push(`goto ${step.url}`); break;
        case "click": await page.click(step.selector); results.push(`click ${step.selector}`); break;
        case "type": await page.fill(step.selector, step.text ?? ""); results.push(`type ${step.selector}`); break;
        case "wait": await page.waitForTimeout(Number(step.ms) || 500); results.push(`wait ${step.ms}ms`); break;
        case "screenshot": {
          const sp = expandHome(step.path || path.join(os.homedir(), "nova-screenshot.png"));
          await page.screenshot({ path: sp, fullPage: true });
          results.push(`screenshot → ${sp}`);
          break;
        }
        case "extract": {
          const text = await page.locator(step.selector).first().innerText();
          results.push(`extract ${step.selector}: ${text.slice(0, 200)}`);
          break;
        }
        default: results.push(`(skipped unknown: ${step.action})`);
      }
    }
    return { ok: true, message: "Browser flow complete", data: results };
  } catch (e) {
    return { ok: false, message: `Browser flow failed: ${e.message}`, data: results };
  } finally {
    await browser.close();
  }
}

async function runAction(action) {
  try {
    switch (action.type) {
      case "open_app": return await executeOpenApp(action.name);
      case "close_app": return await executeCloseApp(action.name);
      case "file_op": return await executeFileOp(action);
      case "automate_browser": return await executeBrowser(action);
      default: return { ok: false, message: `Unsupported action type: ${action.type}` };
    }
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// ---------- Approval flow ----------

async function requestApproval(action) {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  const id = crypto.randomBytes(8).toString("hex");
  const promise = new Promise((resolve) => pending.set(id, resolve));
  mainWindow?.webContents.send("incoming-action", { id, action, summary: summarize(action) });
  return promise; // resolves to { approved: boolean }
}

ipcMain.handle("approve-action", async (_e, { id, approved }) => {
  const resolve = pending.get(id);
  if (resolve) { pending.delete(id); resolve({ approved }); }
});

ipcMain.handle("run-local-action", async (_e, action) => {
  const { approved } = await requestApproval(action);
  if (!approved) return { ok: false, message: "User denied." };
  return await runAction(action);
});

ipcMain.handle("get-token", () => SESSION_TOKEN);
ipcMain.handle("open-token-folder", () => shell.openPath(CONFIG_DIR));

// ---------- Local HTTP server ----------

function startServer() {
  const server = http.createServer(async (req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
    if (req.url === "/health") { res.writeHead(200, cors); return res.end(JSON.stringify({ ok: true })); }
    if (req.url !== "/action" || req.method !== "POST") {
      res.writeHead(404, cors); return res.end("Not found");
    }
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${SESSION_TOKEN}`) {
      res.writeHead(401, cors); return res.end("Unauthorized");
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let action;
      try { action = JSON.parse(body); }
      catch { res.writeHead(400, cors); return res.end("Invalid JSON"); }
      const { approved } = await requestApproval(action);
      if (!approved) {
        res.writeHead(200, { ...cors, "content-type": "application/json" });
        return res.end(JSON.stringify({ ok: false, message: "User denied." }));
      }
      const result = await runAction(action);
      res.writeHead(200, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify(result));
    });
  });
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Nova Companion listening on http://127.0.0.1:${PORT}`);
  });
}

app.whenReady().then(() => {
  createWindow();
  startServer();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
