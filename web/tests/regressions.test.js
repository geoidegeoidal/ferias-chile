import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

// Load the real modules with browser/platform dependencies replaced by small fixtures.
async function loadModule(file, imports, globals) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, ...globals });
  const source = await readFile(new URL(`../js/${file}`, import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, {
    context,
    initializeImportMeta(meta) { meta.env = { PROD: false }; },
  });
  await module.link((name) => {
    assert.ok(name in imports, `Unmocked dependency: ${name}`);
    const values = imports[name];
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

function dom() {
  const elements = new Map();
  const document = {
    getElementById(id) { return elements.get(id) ?? null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement() { return element(); },
    head: { appendChild() {} },
  };
  function element(id) {
    const classes = new Set();
    const attrs = new Map();
    const handlers = new Map();
    const el = {
      style: {}, dataset: {}, textContent: '', value: '', hidden: false,
      classList: {
        contains: (name) => classes.has(name),
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        toggle(name, force = !classes.has(name)) {
          if (force) classes.add(name); else classes.delete(name);
          return force;
        },
      },
      setAttribute: (name, value) => attrs.set(name, value),
      getAttribute: (name) => attrs.get(name),
      addEventListener(name, callback) { handlers.set(name, callback); },
      fire(name, event = {}) { handlers.get(name)?.({ preventDefault() {}, ...event }); },
      querySelectorAll() { return []; },
      querySelector: (name) => elements.get(name),
      appendChild() {}, focus() { document.activeElement = el; },
      remove() {},
    };
    let html;
    Object.defineProperty(el, 'innerHTML', {
      get: () => html ?? el.textContent.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
      set: (value) => { html = value; },
    });
    if (id) elements.set(id, el);
    return el;
  }
  return { document, element };
}

test('theme swaps preserve filtered ferias and geolocation above the basemap', async () => {
  const { document, element } = dom();
  const button = element('btn-theme-toggle');
  let map;
  class Map {
    constructor(options) { this.options = options; this.events = {}; map = this; }
    addControl() {}
    on(name, fn) { this.events[name] = fn; }
    setStyle(url, options) { this.url = url; this.transform = options.transformStyle; }
    getImage() { return this.image; }
    addImage(id, data) { this.addedImage = { id, data }; }
  }
  const saved = new globalThis.Map();
  const api = await loadModule('map.js', {
    'maplibre-gl': { default: { Map, AttributionControl: class {} } },
    'maplibre-gl/dist/maplibre-gl.css': {},
    './data.js': { getFilteredGeoJSON() {}, onFilterChange() {}, isOpenToday() {}, getTodayName() {}, getMaxPuestos() {} },
  }, { document, localStorage: { setItem: (key, value) => saved.set(key, value) } });
  api.initMap({});
  assert.equal(map.options.style, 'https://tiles.openfreemap.org/styles/dark');
  const ferias = { type: 'geojson', data: { features: [{ id: 'filtered' }] } };
  const accuracy = { type: 'geojson', data: { coordinates: [-70.65, -33.45] } };
  const previous = {
    sources: { ferias, 'geo-accuracy': accuracy, old: { type: 'vector' } },
    layers: [{ id: 'old', source: 'old' }, { id: 'clusters', source: 'ferias' }, { id: 'geo-accuracy', source: 'geo-accuracy' }],
  };
  const next = { sources: { openmaptiles: { type: 'vector' } }, layers: [{ id: 'background', type: 'background' }] };
  for (const theme of ['light', 'dark', 'light']) {
    api.toggleMapStyle();
    const style = map.transform(previous, next);
    assert.strictEqual(style.sources.ferias, ferias);
    assert.strictEqual(style.sources['geo-accuracy'], accuracy);
    assert.deepEqual(Array.from(style.layers, (layer) => layer.id), ['background', 'clusters', 'geo-accuracy']);
    assert.equal(saved.get('ferias-map-theme'), theme);
    assert.equal(button.classList.contains('is-light'), theme === 'light');
  }
  map.image = { data: new Uint8Array(4), pixelRatio: 1, sdf: false };
  map.events.styleimagemissing({ id: 'circle-11' });
  assert.strictEqual(map.addedImage.data, map.image.data);
});

test('maximum slider decreases from its unlimited state and reports the current value', async () => {
  const { document, element } = dom();
  for (const id of ['puestos-slider', 'puestos-handle-min', 'puestos-handle-max', 'puestos-fill', 'puestos-val-min', 'puestos-val-max']) element(id);
  const filters = { region: '', comuna: '', dias: [], puestosMin: 0, puestosMax: 0 };
  let notify;
  const api = await loadModule('filters.js', {
    './data.js': {
      getRegionsOrdered: () => [], getComunasByRegion: () => [],
      getFilters: () => ({ ...filters }), setFilters: (updates) => { Object.assign(filters, updates); notify?.([], filters); },
      clearFilters() {}, getFilteredFeatures: () => [], getAllFeatures: () => [],
      onFilterChange: (callback) => { notify = callback; }, getTodayName: () => 'Domingo', getPuestoRange: () => ({ min: 0, max: 738 }),
    }, './map.js': { fitToFeatures() {}, flyToChile() {} },
  }, { document });
  api.initFilters();
  const maximum = document.getElementById('puestos-handle-max');
  maximum.fire('keydown', { key: 'ArrowLeft' });
  assert.equal(filters.puestosMax, 731);
  assert.equal(maximum.getAttribute('aria-valuenow'), '731');
  assert.equal(document.getElementById('puestos-val-max').textContent, '731');
  maximum.fire('keydown', { key: 'ArrowRight' });
  assert.equal(filters.puestosMax, 0);
  assert.equal(maximum.getAttribute('aria-valuenow'), '738');
});

test('closed panels are inert, Escape restores focus, and map failures offer retry', async () => {
  const { document, element } = dom();
  for (const id of ['sidebar-toggle', 'sidebar', 'sidebar-backdrop', 'filter-region', 'btn-stats', 'stats-panel', 'btn-close-stats', 'loading-overlay', 'retry-loading', '.loading-text', '.loading-spinner']) element(id);
  const events = {};
  const media = { matches: true, addEventListener(name, callback) { this.change = callback; } };
  let reloads = 0;
  await loadModule('app.js', {
    './data.js': { loadData: async () => ({ geojson: { metadata: {} } }), getGeoJSON() {} },
    './map.js': { initMap: () => ({ on: (name, callback) => { events[name] = callback; }, once: (name, callback) => { events[name] = callback; } }) },
    './filters.js': { initFilters() {} }, './search.js': { initSearch() {} },
    './stats.js': { initStats() {} }, './onboarding.js': { initOnboarding() {}, startTour() {} },
  }, { document, navigator: {}, window: { matchMedia: () => media, location: { reload() { reloads++; } } } });
  events.error();
  assert.equal(document.getElementById('retry-loading').hidden, false);
  assert.match(document.getElementById('.loading-text').textContent, /mapa/);
  document.getElementById('retry-loading').fire('click');
  assert.equal(reloads, 1);
  events.load();
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  assert.equal(sidebar.inert, true);
  toggle.fire('click');
  assert.equal(sidebar.inert, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  sidebar.fire('keydown', { key: 'Escape' });
  assert.equal(sidebar.inert, true);
  assert.strictEqual(document.activeElement, toggle);
  media.matches = false;
  media.change();
  assert.equal(sidebar.inert, false);
  const stats = document.getElementById('stats-panel');
  const statsButton = document.getElementById('btn-stats');
  assert.equal(stats.inert, true);
  statsButton.fire('click');
  assert.equal(stats.inert, false);
  stats.fire('keydown', { key: 'Escape' });
  assert.equal(stats.inert, true);
  assert.strictEqual(document.activeElement, statsButton);
});

test('local search does not wait for geocoding and clearing discards its late response', async () => {
  const { document, element } = dom();
  for (const id of ['search-input', 'search-container', 'search-results', 'search-clear']) element(id);
  const filters = {};
  const timers = [];
  let resolveGeocoding;
  let request;
  const api = await loadModule('search.js', {
    './data.js': { getAllFeatures: () => [{ properties: { nombre: 'Feria Santiago', comuna: 'Santiago', region: 'Metropolitana' } }], setFilters: (updates) => Object.assign(filters, updates) },
    './map.js': { flyTo() {}, showPopup() {}, showAddressOnMap() {} },
  }, {
    document, AbortController,
    setTimeout: (callback) => { timers.push(callback); return callback; }, clearTimeout() {},
    fetch: (url, options) => { request = options; return new Promise((resolve) => { resolveGeocoding = resolve; }); },
  });
  api.initSearch();
  const input = document.getElementById('search-input');
  input.value = 'Santiago';
  input.fire('input');
  const pending = timers.pop()();
  assert.equal(filters.searchText, 'Santiago');
  assert.ok(document.getElementById('search-results').classList.contains('is-open'));
  document.getElementById('search-clear').fire('click');
  assert.equal(request.signal.aborted, true);
  resolveGeocoding({ ok: true, json: async () => [] });
  await pending;
  assert.equal(filters.searchText, '');
  assert.equal(document.getElementById('search-results').classList.contains('is-open'), false);
});
