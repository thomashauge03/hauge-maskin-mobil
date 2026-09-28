/* Påbudt oppdatering: når må appen oppdateres, når kan den, og når er den
   ny nok? Kjøres med `npm test`. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* www/oppdatering.js er et vanlig nettleserskript som henger seg på window,
   som resten av appen. Vi kjører det i en tom kontekst med bare det. */
function last() {
  const kode = fs.readFileSync(path.join(__dirname, '..', 'www', 'oppdatering.js'), 'utf8');
  const window = {};
  vm.runInNewContext(kode, { window });
  return window.HM_OPPDATERING;
}

const { vurder, nyareEnn } = last();

test('må oppdatere når minimum er nyere enn den installerte', () => {
  const svar = vurder({ installert: '1.15.0', info: { versjon: '1.16.0', minimum: '1.16.0' }, huska: null });
  assert.equal(svar.tilstand, 'maa');
});

test('kan oppdatere når det finnes noe nyere, men minimum er nådd', () => {
  const svar = vurder({ installert: '1.15.0', info: { versjon: '1.16.0', minimum: '1.15.0' }, huska: null });
  assert.equal(svar.tilstand, 'kan');
});

test('ingenting å gjøre når den installerte er nyeste', () => {
  const svar = vurder({ installert: '1.16.0', info: { versjon: '1.16.0', minimum: '1.16.0' }, huska: null });
  assert.equal(svar.tilstand, 'ok');
});

test('versjon.json uten minimum tvinger ingen', () => {
  const svar = vurder({ installert: '1.14.1', info: { versjon: '1.16.0' }, huska: null });
  assert.equal(svar.tilstand, 'kan');
});

test('uten nett står en påbudt oppdatering fra sist', () => {
  const svar = vurder({ installert: '1.15.0', info: null, huska: '1.16.0' });
  assert.equal(svar.tilstand, 'maa');
});

test('uten nett og uten noe husket slipper alle inn', () => {
  const svar = vurder({ installert: '1.15.0', info: null, huska: null });
  assert.equal(svar.tilstand, 'ok');
});

test('et ferskt svar går foran det som var husket', () => {
  // Minimum senket etter et dårlig slipp: folk skal slippe inn igjen
  const svar = vurder({ installert: '1.15.0', info: { versjon: '1.16.0', minimum: '1.15.0' }, huska: '1.16.0' });
  assert.equal(svar.tilstand, 'kan');
  assert.equal(svar.minimum, '1.15.0');
});

test('uten nett blir det som var husket stående', () => {
  const svar = vurder({ installert: '1.15.0', info: null, huska: '1.14.0' });
  assert.equal(svar.minimum, '1.14.0');
});

test('et ferskt svar uten minimum glemmer det som var husket', () => {
  const svar = vurder({ installert: '1.15.0', info: { versjon: '1.15.0' }, huska: '1.16.0' });
  assert.equal(svar.tilstand, 'ok');
  assert.equal(svar.minimum, null);
});

test('et ødelagt minimum stenger ingen ute', () => {
  const svar = vurder({ installert: '1.15.0', info: { versjon: '1.15.0', minimum: 'tull' }, huska: null });
  assert.equal(svar.tilstand, 'ok');
});

test('et minimum over nyeste versjon blir tatt ned til nyeste', () => {
  // En skrivefeil – 1.61.0 for 1.16.0 – skal ikke kreve en versjon som ikke finnes
  const svar = vurder({ installert: '1.16.0', info: { versjon: '1.16.0', minimum: '1.61.0' }, huska: null });
  assert.equal(svar.tilstand, 'ok');
  assert.equal(svar.minimum, '1.16.0');
});

test('1.10.0 er nyere enn 1.9.0 – tallene sammenlignes, ikke teksten', () => {
  assert.equal(nyareEnn('1.10.0', '1.9.0'), true);
  assert.equal(nyareEnn('1.9.0', '1.10.0'), false);
});
