const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nova", {
  onToken: (cb) => ipcRenderer.on("token", (_e, t) => cb(t)),
  onIncomingAction: (cb) => ipcRenderer.on("incoming-action", (_e, payload) => cb(payload)),
  approve: (id, approved) => ipcRenderer.invoke("approve-action", { id, approved }),
  runLocal: (action) => ipcRenderer.invoke("run-local-action", action),
  getToken: () => ipcRenderer.invoke("get-token"),
  openTokenFolder: () => ipcRenderer.invoke("open-token-folder"),
});
