const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let backendProcess = null;
let backendPort = 5000;

function isDev() {
  return !app.isPackaged;
}

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      findFreePort(startPort + 1).then(resolve, reject);
    });
    server.listen(startPort, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function waitForHttp(port, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/", timeout: 1500 },
        (res) => {
          res.resume();
          resolve();
        }
      );
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Backend did not start on port ${port} within ${timeoutMs}ms`));
          return;
        }
        setTimeout(attempt, 300);
      });
      req.on("timeout", () => {
        req.destroy();
      });
    };
    attempt();
  });
}

function resolveBackend() {
  if (isDev()) {
    const venvPython = path.join(__dirname, ".venv", "Scripts", "python.exe");
    const fallbackPython = process.platform === "win32" ? "python" : "python3";
    const cmd = fs.existsSync(venvPython) ? venvPython : fallbackPython;
    return { cmd, args: [path.join(__dirname, "app.py")], cwd: __dirname };
  }

  const backendExe = path.join(process.resourcesPath, "backend", "backend.exe");
  return { cmd: backendExe, args: [], cwd: path.dirname(backendExe) };
}

function startBackend(port) {
  const { cmd, args, cwd } = resolveBackend();
  if (isDev() === false && !fs.existsSync(cmd)) {
    throw new Error(`Packaged Flask backend not found at:\n${cmd}`);
  }

  backendProcess = spawn(cmd, args, {
    cwd,
    windowsHide: true,
    env: {
      ...process.env,
      PORTATLAS_PORT: String(port),
      PORTATLAS_HOST: "127.0.0.1",
      PORTATLAS_DEBUG: "0",
      PYTHONUNBUFFERED: "1",
      PYTHONIOENCODING: "utf-8",
    },
  });

  backendProcess.stdout?.on("data", (chunk) => {
    process.stdout.write(`[backend] ${chunk}`);
  });
  backendProcess.stderr?.on("data", (chunk) => {
    process.stderr.write(`[backend] ${chunk}`);
  });
  backendProcess.on("exit", (code, signal) => {
    backendProcess = null;
    if (mainWindow && !mainWindow.isDestroyed() && code && code !== 0) {
      dialog.showErrorBox(
        "PortAtlas backend exited",
        `The Flask backend stopped unexpectedly (code ${code}, signal ${signal || "none"}).`
      );
    }
  });
}

function stopBackend() {
  if (!backendProcess || !backendProcess.pid) {
    return;
  }
  const pid = backendProcess.pid;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    backendProcess.kill("SIGTERM");
  }
  backendProcess = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "PortAtlas Recon Dashboard",
    backgroundColor: "#0b0f14",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "loading.html"));
}

async function boot() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  await app.whenReady();
  createWindow();

  try {
    backendPort = await findFreePort(5000);
    startBackend(backendPort);
    await waitForHttp(backendPort);
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(`http://127.0.0.1:${backendPort}`);
    }
  } catch (err) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox("PortAtlas failed to start", String(err.message || err));
    }
    app.quit();
  }
}

app.on("before-quit", () => {
  stopBackend();
});

app.on("window-all-closed", () => {
  stopBackend();
  app.quit();
});

boot();
