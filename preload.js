const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bloomAPI", {

    getStartup: () =>
        ipcRenderer.invoke("get-startup-setting"),

    setStartup: (enabled) =>
        ipcRenderer.invoke("set-startup-setting", enabled),

    showPhaseNotification: (phase, silent) =>
        ipcRenderer.invoke("show-phase-notification", phase, silent === true),

    getCustomThemes: () =>
        ipcRenderer.invoke("get-custom-themes"),

    openThemesFolder: () =>
        ipcRenderer.invoke("open-themes-folder"),

    getAppInfo: () =>
        ipcRenderer.invoke("get-app-info"),

    onNavigateToPhase: (callback) => {

        ipcRenderer.on("navigate-to-phase", (event, phase) => {
            callback(phase);
        });

    }

});
