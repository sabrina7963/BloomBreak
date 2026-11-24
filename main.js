
const {
    app,
    BrowserWindow,
    ipcMain,
    Tray,
    Menu,
    Notification,
    screen,
    shell
} = require("electron");

const path = require("node:path");
const fs = require("node:fs");

// Handle Windows installer events
if (require("electron-squirrel-startup")) {
    app.quit();
    return;
}

// Prevent multiple instances of BloomBreak
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
    return;
}

// Windows application ID for native notifications
if (process.platform === "win32") {
    app.setAppUserModelId("com.squirrel.bloombreak.BloomBreak");
}

let mainWindow = null;
let tray = null;
let windowReady = false;
let pendingPhase = null;


// =================================
// CREATE BLOOMBREAK WINDOW
// =================================

function createWindow() {

    // Taller window for the garden, but never taller than the screen
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    const windowHeight = Math.min(800, workArea.height - 20);

    mainWindow = new BrowserWindow({
        width: 460,
        height: windowHeight,
        minWidth: 460,
        minHeight: Math.min(680, windowHeight),
        resizable: true,
        maximizable: false,
        autoHideMenuBar: true,
        title: "BloomBreak",

        icon: path.join(__dirname, "icons", "bloombreak.ico"),

        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,

            // Keep timers accurate while the window is hidden in the tray
            backgroundThrottling: false
        }
    });

    mainWindow.removeMenu();

    mainWindow.loadFile(
        path.join(__dirname, "index.html")
    );

    // Wait until the renderer is ready
    mainWindow.webContents.on("did-finish-load", () => {

        windowReady = true;

        if (pendingPhase) {
            mainWindow.webContents.send(
                "navigate-to-phase",
                pendingPhase
            );

            pendingPhase = null;
        }

    });

    // Hide instead of closing when X is clicked
    mainWindow.on("close", (event) => {

        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }

    });

    mainWindow.on("closed", () => {
        mainWindow = null;
        windowReady = false;
    });

}


// =================================
// SHOW BLOOMBREAK WINDOW
// =================================

function showWindow() {

    if (mainWindow && !mainWindow.isDestroyed()) {

        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }

        mainWindow.show();
        mainWindow.focus();

    }

    else {
        createWindow();
    }

}


// =================================
// OPEN SPECIFIC BLOOMBREAK PAGE
// =================================

function openPhase(phase) {

    pendingPhase = phase;

    showWindow();

    if (
        mainWindow &&
        !mainWindow.isDestroyed() &&
        windowReady
    ) {

        mainWindow.webContents.send(
            "navigate-to-phase",
            phase
        );

        pendingPhase = null;

    }

}


// =================================
// HANDLE SECOND APPLICATION INSTANCE
// =================================

app.on("second-instance", () => {

    showWindow();

});


// =================================
// CREATE SYSTEM TRAY ICON
// =================================

function createTray() {

    tray = new Tray(
        path.join(__dirname, "icons", "bloombreak.ico")
    );

    tray.setToolTip("BloomBreak");

    const contextMenu = Menu.buildFromTemplate([

        {
            label: "Open BloomBreak",
            click: () => {
                showWindow();
            }
        },

        {
            type: "separator"
        },

        {
            label: "Quit BloomBreak",
            click: () => {
                app.quit();
            }
        }

    ]);

    tray.setContextMenu(contextMenu);

    tray.on("click", () => {
        showWindow();
    });

}


// =================================
// DESKTOP NOTIFICATIONS
// =================================

ipcMain.handle(
    "show-phase-notification",
    (event, phase, silent) => {

        if (!Notification.isSupported()) {
            return false;
        }

        let notificationContent;
        let destination;

        if (phase === "break") {

            notificationContent = {
                title: "BloomBreak 🌱",
                body: "Your plant needs water! Time for a break. 💧"
            };

            destination = "water";

        }

        else if (phase === "work") {

            notificationContent = {
                title: "BloomBreak 🌱",
                body: "Your plant is feeling better! Time to get back to work."
            };

            destination = "approval";

        }

        else {
            return false;
        }

        const notification = new Notification({

            title: notificationContent.title,
            body: notificationContent.body,

            // The app plays its own chime when sound is enabled
            silent: silent === true

        });

        notification.on("click", () => {

            openPhase(destination);

        });

        notification.show();

        return true;

    }
);


// =================================
// WINDOWS STARTUP SETTINGS
// =================================

// Squirrel installs the real app in app-x.y.z\ and puts a small
// launcher stub one folder up. Starting the stub always opens the
// newest installed version, so Windows startup should point there.

function getStartupOptions() {

    if (!app.isPackaged) {

        return {
            path: process.execPath,
            args: [app.getAppPath()]
        };

    }

    const stubPath = path.resolve(
        path.dirname(process.execPath),
        "..",
        path.basename(process.execPath)
    );

    if (fs.existsSync(stubPath)) {

        return {
            path: stubPath,
            args: []
        };

    }

    return {
        path: process.execPath,
        args: []
    };

}


function setStartup(enabled) {

    app.setLoginItemSettings({
        openAtLogin: enabled,
        ...getStartupOptions()
    });

}


// Older versions registered app-x.y.z\BloomBreak.exe directly.
// Move such entries to the launcher stub.
function migrateStartupEntry() {

    if (process.platform !== "win32" || !app.isPackaged) {
        return;
    }

    const options = getStartupOptions();

    if (options.path === process.execPath) {
        return;
    }

    const oldEntry = app.getLoginItemSettings({
        path: process.execPath,
        args: []
    });

    if (oldEntry.openAtLogin) {
        setStartup(true);
    }

}


ipcMain.handle("get-startup-setting", () => {

    if (process.platform !== "win32") {

        return {
            enabled: false,
            available: false
        };

    }

    return {
        enabled: app.getLoginItemSettings(getStartupOptions()).openAtLogin,
        available: true
    };

});


ipcMain.handle("set-startup-setting", (event, enabled) => {

    if (
        process.platform !== "win32" ||
        typeof enabled !== "boolean"
    ) {
        return false;
    }

    setStartup(enabled);

    return true;

});


// =================================
// CUSTOM THEMES
// =================================

const THEME_KEYS = [
    "primary",
    "primary_hover",
    "primary_active",
    "gradient_start",
    "gradient_end",
    "text",
    "secondary_text",
    "border",
    "background",
    "surface",
    "secondary_background",
    "secondary_hover",
    "secondary_active"
];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const EXAMPLE_THEME = {
    name: "Midnight Mint",
    colors: {
        primary: "#3E8E7E",
        primary_hover: "#357A6C",
        primary_active: "#2C665A",
        gradient_start: "#4FA593",
        gradient_end: "#2C665A",
        text: "#23302D",
        secondary_text: "#6B7C78",
        border: "#CFE3DE",
        background: "#FFFFFF",
        surface: "#F6FBFA",
        secondary_background: "#E7F2EF",
        secondary_hover: "#DCECE8",
        secondary_active: "#D0E5E0"
    }
};

const THEMES_README = [
    "BloomBreak custom themes",
    "========================",
    "",
    "Put one .json file per theme in this folder, then reopen Settings.",
    "",
    "Format:",
    "{",
    "  \"name\": \"My theme\",",
    "  \"colors\": {",
    "    \"primary\": \"#3E8E7E\",",
    "    ...",
    "  }",
    "}",
    "",
    "Supported color keys: " + THEME_KEYS.join(", "),
    "Colors must be 6-digit hex values like #A1B2C3. Missing keys use the default theme.",
    ""
].join("\r\n");


function getThemesFolder() {
    return path.join(app.getPath("userData"), "themes");
}


function ensureThemesFolder() {

    const folder = getThemesFolder();

    if (!fs.existsSync(folder)) {

        fs.mkdirSync(folder, { recursive: true });

        fs.writeFileSync(
            path.join(folder, "midnight-mint.json"),
            JSON.stringify(EXAMPLE_THEME, null, 4)
        );

        fs.writeFileSync(
            path.join(folder, "README.txt"),
            THEMES_README
        );

    }

    return folder;

}


function readCustomThemes() {

    const folder = ensureThemesFolder();
    const themes = [];

    const files = fs.readdirSync(folder)
        .filter((file) => file.toLowerCase().endsWith(".json"))
        .slice(0, 50);

    for (const file of files) {

        try {

            const filePath = path.join(folder, file);

            if (fs.statSync(filePath).size > 64 * 1024) {
                continue;
            }

            const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

            if (
                !data ||
                typeof data.name !== "string" ||
                !data.colors ||
                typeof data.colors !== "object"
            ) {
                continue;
            }

            const colors = {};

            for (const key of THEME_KEYS) {
                if (typeof data.colors[key] === "string" && HEX_COLOR.test(data.colors[key])) {
                    colors[key] = data.colors[key];
                }
            }

            if (!colors.primary) {
                continue;
            }

            themes.push({
                id: path.basename(file, path.extname(file)).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60),
                name: data.name.trim().slice(0, 40) || "Custom theme",
                colors
            });

        } catch (error) {
            console.error("Could not read theme " + file + ":", error);
        }

    }

    return themes;

}


ipcMain.handle("get-custom-themes", () => {

    try {
        return readCustomThemes();
    } catch (error) {
        console.error("Could not load custom themes:", error);
        return [];
    }

});


ipcMain.handle("open-themes-folder", async () => {

    const result = await shell.openPath(ensureThemesFolder());

    return result === "";

});


// =================================
// APP INFORMATION
// =================================

ipcMain.handle("get-app-info", () => {

    return {
        version: app.getVersion(),
        packaged: app.isPackaged
    };

});


// =================================
// START APPLICATION
// =================================

app.whenReady().then(() => {

    // First launch right after installation: enable Windows startup
    if (
        process.platform === "win32" &&
        process.argv.includes("--squirrel-firstrun")
    ) {
        setStartup(true);
    }

    else {
        migrateStartupEntry();
    }

    createWindow();

    createTray();

    app.on("activate", () => {
        showWindow();
    });

});


// =================================
// ALLOW COMPLETE APPLICATION EXIT
// =================================

app.on("before-quit", () => {

    app.isQuitting = true;

});
