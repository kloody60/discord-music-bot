const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('app', {
  state: () => ipcRenderer.invoke('state'),
  saveToken: t => ipcRenderer.invoke('save-token', t),
  downloadYtdlp: () => ipcRenderer.invoke('download-ytdlp'),
  openDashboard: () => ipcRenderer.invoke('open-dashboard'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  version: () => ipcRenderer.invoke('version'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
});
