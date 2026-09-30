/* Fra sider.json til lista appen viser. Kjøres med `npm test`. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function last() {
  const kode = fs.readFileSync(path.join(__dirname, '..', 'www', 'sidelista.js'), 'utf8');
  const window = {};
  vm.runInNewContext(kode, { window, URL });
  return window.HM_SIDER;
}

const { lesSider, trygdAdresse, bareMine, normaliser, treffer } = last();
const side = (ekstra) => ({ id: 'rorlager', name: 'Rørlager', url: 'https://rorlager.vercel.app/', ...ekstra });

test('bare https slipper gjennom', () => {
  const lista = lesSider({ pages: [
    side(),
    side({ id: 'a', url: 'http://192.168.0.245/' }),
    side({ id: 'b', url: 'javascript:alert(1)' }),
    side({ id: 'c', url: 'tull' })
  ] });
  assert.deepEqual(lista.map((s) => s.id), ['rorlager']);
});

test('sider merket pc står ikke på telefonen', () => {
  assert.deepEqual(lesSider({ pages: [side({ plattform: 'pc' })] }), []);
});

test('skjulte sider står ikke', () => {
  assert.deepEqual(lesSider({ pages: [side({ hidden: true })] }), []);
});

test('nøkkelknappen er på når feltet mangler', () => {
  assert.equal(lesSider({ pages: [side()] })[0].nokkel, true);
});

test('nøkkelknappen er av bare når feltet er false', () => {
  assert.equal(lesSider({ pages: [side({ nokkel: false })] })[0].nokkel, false);
  assert.equal(lesSider({ pages: [side({ nokkel: 'false' })] })[0].nokkel, true);
});

test('både { pages } og en bar array blir lest', () => {
  assert.equal(lesSider([side()]).length, 1);
  assert.equal(lesSider({ pages: [side()] }).length, 1);
  // Lengden, ikke deepEqual: den tomme lista lages inne i vm-konteksten og
  // har en annen Array.prototype enn testens. I nettleseren finnes bare én.
  assert.equal(lesSider(null).length, 0);
});

test('manglende gruppe og farge får standardverdier', () => {
  const s = lesSider({ pages: [side()] })[0];
  assert.equal(s.group, 'Annet');
  assert.equal(s.color, '#e2001a');
});

test('trygdAdresse gir null for alt som ikke er https', () => {
  assert.equal(trygdAdresse('http://x.no'), null);
  assert.equal(trygdAdresse('https://x.no/a'), 'https://x.no/a');
});

const tre = () => lesSider({ pages: [side({ id: 'a', name: 'A' }), side({ id: 'b', name: 'B' }), side({ id: 'c', name: 'C' })] });

test('bare sidene navet gir, i lista sin rekkefølge', () => {
  assert.equal(bareMine(tre(), ['c', 'a'], false).map((s) => s.id).join(','), 'a,c');
});

test('ingen sider gitt betyr ingen sider – ikke hele lista', () => {
  assert.equal(bareMine(tre(), [], false).length, 0);
  assert.equal(bareMine(tre(), null, false).length, 0);
});

test('adminer ser alt', () => {
  assert.equal(bareMine(tre(), [], true).length, 3);
});

test('en id som ikke står i fila, blir ikke til noe', () => {
  assert.equal(bareMine(tre(), ['finnes-ikke'], false).length, 0);
});

test('søket: æ, ø, å og de gamle skrivemåtene', () => {
  assert.equal(normaliser('Bjørn'), normaliser('bjoern'));
  assert.equal(normaliser('Håkon'), normaliser('HAAKON'));
  const s = side({ name: 'Rørlager', group: 'Lager', help: 'Rør og deler' });
  assert.ok(treffer(s, 'rorlager'));
  assert.ok(treffer(s, 'lager deler'));
  assert.ok(!treffer(s, 'lager tripletex'));
  assert.ok(treffer(s, ''));
});
