'use strict';
/* macOS: Apple dasturchi sertifikati bo'lmagani uchun ilovani "ad-hoc" imzolaymiz.
   Busiz Apple Silicon (M1–M4) Mac'larda ilova "shikastlangan" deb ochilmaydi. */
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  const appPath = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
