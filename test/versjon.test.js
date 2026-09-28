/* Versjonsnummeret står to steder, og påbudt oppdatering sammenligner mot
   det i app.js. Glemmer et slipp å endre det ene, ville alle som installerer
   den nye APK-en blitt stengt ute til minimum ble senket. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rot = path.join(__dirname, '..');

test('VERSJON i app.js er den samme som versionName i build.gradle', () => {
  const app = fs.readFileSync(path.join(rot, 'www', 'app.js'), 'utf8');
  const gradle = fs.readFileSync(path.join(rot, 'android', 'app', 'build.gradle'), 'utf8');
  const iApp = (app.match(/^const VERSJON = '([^']+)';/m) || [])[1];
  const iGradle = (gradle.match(/versionName "([^"]+)"/) || [])[1];
  assert.ok(iApp, 'fant ikke VERSJON i app.js');
  assert.equal(iApp, iGradle);
});
