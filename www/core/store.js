'use strict';
/* Ma'lumotlarni saqlash qatlami.
   Kompyuter dasturida (Electron) — foydalanuvchi papkasidagi JSON fayl va kunlik zaxiralar.
   Telefonda va brauzerda — IndexedDB (qurilmaning o'zida). */
(function (root) {
  const native = root.islohNative || null;
  const DB_NAME = 'isloh';

  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbGet(key) {
    const db = await idb();
    return new Promise((res, rej) => {
      const r = db.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbSet(key, val) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      if (val === undefined) tx.objectStore('kv').delete(key); else tx.objectStore('kv').put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  let wallUrl = null;
  const Store = {
    isNative: !!native,
    platform: native ? native.platform : (root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform() ? 'android' : 'web'),
    dataDir: native ? native.dataDir : null,

    async load() {
      if (native) {
        const s = await native.loadData();
        return s ? JSON.parse(s) : null;
      }
      const s = await idbGet('db');
      return s ? JSON.parse(s) : null;
    },
    async save(obj) {
      const s = JSON.stringify(obj);
      if (native) return native.saveData(s);
      return idbSet('db', s);
    },
    async backup(obj, day) {
      if (native) return native.backup(JSON.stringify(obj), day);
      return null;
    },
    async setWallpaper(file) {
      if (native) return native.saveWallpaper(await file.arrayBuffer(), file.type);
      await idbSet('wallpaper', file);
    },
    async deleteWallpaper() {
      if (native) return native.deleteWallpaper();
      await idbSet('wallpaper', undefined);
    },
    async wallpaperURL(version) {
      if (!version) return '';
      if (native) return `app://isloh/wallpaper?v=${version}`;
      const blob = await idbGet('wallpaper');
      if (!blob) return '';
      if (wallUrl) URL.revokeObjectURL(wallUrl);
      wallUrl = URL.createObjectURL(blob);
      return wallUrl;
    },
  };
  root.Store = Store;
})(window);
