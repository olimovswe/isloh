'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('islohNative', {
  platform: process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux',
  dataDir: ipcRenderer.sendSync('data-dir'),
  loadData: () => ipcRenderer.invoke('load'),
  saveData: s => ipcRenderer.invoke('save', s),
  backup: (s, day) => ipcRenderer.invoke('backup', s, day),
  saveWallpaper: (buf, mime) => ipcRenderer.invoke('wall-save', buf, mime),
  deleteWallpaper: () => ipcRenderer.invoke('wall-del'),
  saveFile: (name, text) => ipcRenderer.invoke('save-file', name, text),
  getAutostart: () => ipcRenderer.invoke('autostart-get'),
  setAutostart: on => ipcRenderer.invoke('autostart-set', on),
  openDataDir: () => ipcRenderer.invoke('open-data'),
  onShow: cb => ipcRenderer.on('shown', () => cb()),
});
