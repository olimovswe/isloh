'use strict';
/* Interfeys va dastur yadrosi orasidagi yagona ko'prik */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('isloh', {
  api: (method, path, body, token) => ipcRenderer.invoke('isloh:api', method, path, body, token),
  onEvent: fn => ipcRenderer.on('isloh:event', (_e, ev) => fn(ev)),
});
