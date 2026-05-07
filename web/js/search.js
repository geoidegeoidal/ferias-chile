/**
 * search.js — Fuzzy search + Nominatim geocoding with keyboard navigation.
 */
import {
  getAllFeatures,
  setFilters,
} from './data.js';
import { flyTo, showPopup, showAddressOnMap } from './map.js';

let _activeIndex = -1;
let _results = []; // mixed: features + nominatim addresses
let _nominatimAbort = null;

/**
 * Initialize search functionality.
 */
export function initSearch() {
  const input = document.getElementById('search-input');
  const container = document.getElementById('search-container');
  const resultsEl = document.getElementById('search-results');
  const clearBtn = document.getElementById('search-clear');

  if (!input || !container || !resultsEl) return;

  // Input handler (debounced)
  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const value = input.value.trim();

    container.classList.toggle('has-value', value.length > 0);
    abortNominatim();

    if (value.length < 2) {
      closeResults();
      setFilters({ searchText: '' });
      return;
    }

    debounceTimer = setTimeout(async () => {
      const local = searchLocal(value);
      const nominatim = await searchNominatim(value);
      _results = [...local, ...nominatim];
      renderResults(_results, value);
      setFilters({ searchText: value });
    }, 250);
  });

  // Clear button
  clearBtn?.addEventListener('click', () => {
    input.value = '';
    container.classList.remove('has-value');
    closeResults();
    setFilters({ searchText: '' });
    input.focus();
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (!resultsEl.classList.contains('is-open')) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        _activeIndex = Math.min(_activeIndex + 1, _results.length - 1);
        highlightResult();
        break;
      case 'ArrowUp':
        e.preventDefault();
        _activeIndex = Math.max(_activeIndex - 1, 0);
        highlightResult();
        break;
      case 'Enter':
        e.preventDefault();
        if (_activeIndex >= 0 && _results[_activeIndex]) {
          selectResult(_results[_activeIndex]);
        }
        break;
      case 'Escape':
        closeResults();
        input.blur();
        break;
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      closeResults();
    }
  });

  // Focus re-opens results
  input.addEventListener('focus', () => {
    if (_results.length > 0 && input.value.trim().length >= 2) {
      document.getElementById('search-results')?.classList.add('is-open');
    }
  });
}

/* ============================================================
   LOCAL SEARCH (ferias dataset)
   ============================================================ */

function searchLocal(query) {
  const q = normalize(query);
  const features = getAllFeatures();
  const scored = [];

  for (const f of features) {
    const p = f.properties;
    const fields = [
      { text: p.nombre, weight: 3 },
      { text: p.comuna, weight: 2 },
      { text: p.region, weight: 1.5 },
      { text: p.direccion, weight: 1 },
      { text: p.calle_principal, weight: 1 },
    ];

    let bestScore = 0;
    for (const { text, weight } of fields) {
      if (!text) continue;
      const n = normalize(text);
      if (n.includes(q)) {
        const pos = n.indexOf(q);
        const posBonus = pos === 0 ? 2 : 1;
        bestScore = Math.max(bestScore, weight * posBonus * 10);
      } else {
        const words = q.split(/\s+/);
        const allPresent = words.every(w => n.includes(w));
        if (allPresent) {
          bestScore = Math.max(bestScore, weight * 5);
        }
      }
    }

    if (bestScore > 0) {
      scored.push({ feature: f, score: bestScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map(s => ({ type: 'feria', data: s.feature }));
}

/* ============================================================
   NOMINATIM SEARCH (OpenStreetMap geocoding)
   ============================================================ */

async function searchNominatim(query) {
  // Only query Nominatim for address-like queries or if no local results
  // But we'll always show up to 3 suggestions to help discovery
  const controller = new AbortController();
  _nominatimAbort = controller;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Chile')}&format=json&countrycodes=cl&limit=4&accept-language=es`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FeriasChile/1.0 (https://geoidegeoidal.github.io/ferias-chile/)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return [];
    const results = await response.json();
    return results.map(r => ({
      type: 'address',
      data: {
        display_name: r.display_name,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        icon: r.icon,
      },
    }));
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('[Nominatim] Error:', err);
    return [];
  } finally {
    _nominatimAbort = null;
  }
}

function abortNominatim() {
  if (_nominatimAbort) {
    _nominatimAbort.abort();
    _nominatimAbort = null;
  }
}

/* ============================================================
   RENDER RESULTS
   ============================================================ */

function renderResults(results, query) {
  const resultsEl = document.getElementById('search-results');
  if (!resultsEl) return;

  _activeIndex = -1;

  if (results.length === 0) {
    resultsEl.innerHTML = `
      <div class="search-result-item" style="color: var(--text-tertiary); cursor: default;">
        No se encontraron resultados para "${escapeHtml(query)}"
      </div>
    `;
    resultsEl.classList.add('is-open');
    return;
  }

  // Split sections
  const ferias = results.filter(r => r.type === 'feria');
  const addresses = results.filter(r => r.type === 'address');

  let html = '';

  if (ferias.length > 0) {
    html += ferias.map((r, i) => {
      const p = r.data.properties;
      const globalIdx = results.indexOf(r);
      return `
        <div class="search-result-item" data-index="${globalIdx}" role="option">
          <div class="search-result-item__icon">🏪</div>
          <div class="search-result-item__body">
            <div class="search-result-item__name">${highlightMatch(p.nombre, query)}</div>
            <div class="search-result-item__meta">${highlightMatch(p.comuna, query)}, ${p.region} · ${p.dias_texto || ''}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (addresses.length > 0) {
    if (ferias.length > 0) {
      html += `<div class="search-result-divider"><span>Direcciones</span></div>`;
    }
    html += addresses.map((r, i) => {
      const a = r.data;
      const globalIdx = results.indexOf(r);
      const shortName = a.display_name.split(',')[0];
      const rest = a.display_name.split(',').slice(1, 3).join(', ');
      return `
        <div class="search-result-item search-result-item--address" data-index="${globalIdx}" role="option">
          <div class="search-result-item__icon">📍</div>
          <div class="search-result-item__body">
            <div class="search-result-item__name">${highlightMatch(shortName, query)}</div>
            <div class="search-result-item__meta">${escapeHtml(rest)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  resultsEl.innerHTML = html;

  // Click handlers
  resultsEl.querySelectorAll('.search-result-item[data-index]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      if (results[idx]) selectResult(results[idx]);
    });
  });

  resultsEl.classList.add('is-open');
}

function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text || '');
  const escaped = escapeHtml(text);
  const words = query.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return escaped;

  const sorted = [...words].sort((a, b) => b.length - a.length);
  const pattern = sorted
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const regex = new RegExp(`(${pattern})`, 'gi');
  return escaped.replace(regex, (match) => `<mark>${match}</mark>`);
}

function highlightResult() {
  const resultsEl = document.getElementById('search-results');
  if (!resultsEl) return;

  resultsEl.querySelectorAll('.search-result-item').forEach((el, i) => {
    el.classList.toggle('is-active', i === _activeIndex);
    if (i === _activeIndex) {
      el.scrollIntoView({ block: 'nearest' });
    }
  });
}

function selectResult(result) {
  closeResults();

  const input = document.getElementById('search-input');
  if (!input) return;

  if (result.type === 'feria') {
    const feature = result.data;
    input.value = feature.properties.nombre;
    document.getElementById('search-container')?.classList.add('has-value');

    const coords = feature.geometry.coordinates;
    flyTo(coords[0], coords[1], 16);
    setTimeout(() => showPopup(feature), 1300);
  } else if (result.type === 'address') {
    const a = result.data;
    input.value = a.display_name.split(',')[0];
    document.getElementById('search-container')?.classList.add('has-value');

    flyTo(a.lon, a.lat, 16);
    showAddressOnMap(a.lon, a.lat, a.display_name);
  }
}

function closeResults() {
  document.getElementById('search-results')?.classList.remove('is-open');
  _activeIndex = -1;
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
