import { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import Store from "electron-store";

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();

app.disableHardwareAcceleration();

let mainWindow = null;
let loginWindow = null;

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 600,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "resources", "icon.png"),
    resizable: false,
  });

  const loginPath = path.join(__dirname, "login.html");
  console.log("Loading login page from:", loginPath);
  loginWindow.loadFile(loginPath);
}

async function createMainWindow(serverHost) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "resources", "icon.png"),
  });

  const url = serverHost.startsWith("http")
    ? serverHost
    : `https://${serverHost}`;

  console.log("Loading URL:", url);
  mainWindow.loadURL(url);

  app.setName("Cybertools Hub Desktop");

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
  }

  buildMenu(serverHost);

  const { default: initializeShortcuts } = await import("./shortcuts.cjs");
  initializeShortcuts(globalShortcut, mainWindow);
}

function initialize() {
  const savedHost = store.get("serverHost");
  console.log("Saved host:", savedHost);
  if (savedHost) {
    createMainWindow(savedHost);
  } else {
    createLoginWindow();
  }
}

app.whenReady().then(() => {
  console.log("App is ready");
  initialize();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    initialize();
  }
});

ipcMain.on("submit-server-host", (event, serverHost) => {
  console.log("Saving server host:", serverHost);

  if (serverHost.startsWith("http://")) {
    dialog
      .showMessageBox({
        type: "warning",
        title: "Security Warning",
        message:
          "You are using an HTTP connection, which is insecure. Data transmitted over HTTP is not encrypted and can be intercepted by third parties. It is highly recommended to use HTTPS for a secure connection.",
        buttons: ["Continue", "Cancel"],
      })
      .then((result) => {
        if (result.response === 0) {
          store.set("serverHost", serverHost);
          createMainWindow(serverHost);
        } else {
          console.log("User cancelled due to security warning.");
          event.sender.send("clear-server-host-input");
        }
      });
  } else {
    store.set("serverHost", serverHost);
    createMainWindow(serverHost);
  }
});

ipcMain.on("reset-server", () => {
  console.log("Resetting server configuration");
  store.delete("serverHost");
  if (mainWindow) {
    mainWindow.close();
  }
  createLoginWindow();
});

// Error handling
process.on("uncaughtException", (error) => {
  console.error("An uncaught error occurred:", error);
});

app.on("render-process-gone", (event, webContents, details) => {
  console.error("Render process gone:", details);
});

app.on("child-process-gone", (event, details) => {
  console.error("Child process gone:", details);
});

function buildMenu(serverHost) {
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        process.platform === "darwin" ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Cybertools Hub",
      submenu: [
        {
          label: "Disconnect from host",
          click: async () => {
            const result = await dialog.showMessageBox({
              type: "question",
              buttons: ["Disconnect", "Cancel"],
              defaultId: 1,
              title: "Disconnect Confirmation",
              message: `Are you sure you want to disconnect from the server?\n\n${serverHost}`,
            });

            if (result.response === 0) {
              console.log("Resetting server configuration from menu");
              store.delete("serverHost");
              if (mainWindow) {
                mainWindow.close();
              }
              createLoginWindow();
            }
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(process.platform === "darwin"
          ? [
              { role: "pasteAndMatchStyle" },
              { role: "delete" },
              { role: "selectAll" },
              { type: "separator" },
              {
                label: "Speech",
                submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
              },
            ]
          : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(process.platform === "darwin"
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Keyboard Shortcuts",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Keyboard Shortcuts",
              message: `
                Cmd/Ctrl+N: Start a new chat
                Cmd/Ctrl+Shift+S: Toggle sidebar
                Cmd/Ctrl+Shift+P: Toggle private chat

                Ctrl+K: Scroll up
                Ctrl+J: Scroll down
                Ctrl+U: Scroll to top
                Ctrl+D: Scroll to bottom
              `,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
