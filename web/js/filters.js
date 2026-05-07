/**
 * filters.js — Sidebar filter controls and UI wiring.
 */
import {
  getRegionsOrdered,
  getComunasByRegion,
  getFilters,
  setFilters,
  clearFilters,
  getFilteredFeatures,
  getAllFeatures,
  onFilterChange,
  getTodayName,
  getPuestoRange,
} from './data.js';
import { fitToFeatures, flyToChile } from './map.js';

// Region centroids (approximate, for fly-to on region select)
const REGION_CENTROIDS = {
  'Arica y Parinacota': [-70.0, -18.5],
  'Tarapaca': [-69.7, -20.2],
  'Antofagasta': [-69.6, -23.6],
  'Atacama': [-70.0, -27.4],
  'Coquimbo': [-71.0, -30.0],
  'Valparaiso': [-71.3, -33.0],
  'Metropolitana de Santiago': [-70.65, -33.45],
  "Libertador General Bernardo O'Higgins": [-71.0, -34.2],
  'Maule': [-71.2, -35.4],
  'Nuble': [-72.0, -36.6],
  'Biobio': [-72.7, -37.0],
  'La Araucania': [-72.5, -38.7],
  'Los Rios': [-72.6, -39.8],
  'Los Lagos': [-72.5, -41.5],
  'Aysen del General Carlos Ibanez del Campo': [-72.5, -45.5],
  'Magallanes y de la Antartica Chilena': [-71.0, -53.0],
};

/**
 * Initialize filter controls.
 */
export function initFilters() {
  populateRegions();
  populateComunas('');
  setupDayFilter();
  setupPuestosSlider();
  setupEventListeners();
  markTodayPill();

  // Subscribe to filter changes → update counts
  onFilterChange(updateFilterUI);

  // Initial UI
  updateFilterUI(getFilteredFeatures(), getFilters());
}

/** Populate region dropdown */
function populateRegions() {
  const select = document.getElementById('filter-region');
  if (!select) return;

  const regions = getRegionsOrdered();
  const allFeatures = getAllFeatures();

  // Count ferias per region
  const counts = {};
  for (const f of allFeatures) {
    const r = f.properties.region;
    counts[r] = (counts[r] || 0) + 1;
  }

  select.innerHTML = '<option value="">Todas las regiones</option>';
  for (const region of regions) {
    const opt = document.createElement('option');
    opt.value = region;
    opt.textContent = `${region} (${counts[region] || 0})`;
    select.appendChild(opt);
  }
}

/** Populate comuna dropdown based on selected region */
function populateComunas(region) {
  const select = document.getElementById('filter-comuna');
  if (!select) return;

  const comunas = getComunasByRegion(region);
  const allFeatures = getAllFeatures();

  // Count ferias per comuna (within region if filtered)
  const counts = {};
  for (const f of allFeatures) {
    if (region && f.properties.region !== region) continue;
    const c = f.properties.comuna;
    counts[c] = (counts[c] || 0) + 1;
  }

  select.innerHTML = '<option value="">Todas las comunas</option>';
  for (const comuna of comunas) {
    const opt = document.createElement('option');
    opt.value = comuna;
    opt.textContent = `${comuna} (${counts[comuna] || 0})`;
    select.appendChild(opt);
  }
}

/** Setup day filter pills */
function setupDayFilter() {
  const container = document.getElementById('day-filter');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const pill = e.target.closest('.day-pill');
    if (!pill) return;

    pill.classList.toggle('is-active');

    // Collect active days
    const activeDays = [];
    container.querySelectorAll('.day-pill.is-active').forEach(p => {
      activeDays.push(p.dataset.day);
    });

    setFilters({ dias: activeDays });
  });
}

/** Mark today's pill with a dot */
function markTodayPill() {
  const today = getTodayName();
  const container = document.getElementById('day-filter');
  if (!container) return;

  container.querySelectorAll('.day-pill').forEach(pill => {
    if (pill.dataset.day === today) {
      pill.classList.add('is-today');
    }
  });
}

/** Puestos range slider state */
let _sliderDragging = null;

/** Setup the dual-handle puestos range slider */
function setupPuestosSlider() {
  const slider = document.getElementById('puestos-slider');
  const handleMin = document.getElementById('puestos-handle-min');
  const handleMax = document.getElementById('puestos-handle-max');
  const fill = document.getElementById('puestos-fill');
  const valMin = document.getElementById('puestos-val-min');
  const valMax = document.getElementById('puestos-val-max');

  if (!slider || !handleMin || !handleMax) return;

  const range = getPuestoRange();
  const maxVal = range.max;

  valMax.textContent = maxVal.toLocaleString('es-CL');

  function updateHandles() {
    const filters = getFilters();
    const minPercent = maxVal > 0 ? (filters.puestosMin / maxVal) * 100 : 0;
    const maxPercent = filters.puestosMax > 0
      ? (filters.puestosMax / maxVal) * 100
      : 100;

    handleMin.style.left = `${minPercent}%`;
    handleMax.style.left = `${maxPercent}%`;
    fill.style.left = `${minPercent}%`;
    fill.style.width = `${maxPercent - minPercent}%`;
    valMin.textContent = filters.puestosMin.toLocaleString('es-CL');

    const label = document.getElementById('puestos-range-label');
    if (label && (filters.puestosMin > 0 || filters.puestosMax > 0)) {
      label.textContent = `(${filters.puestosMin}–${filters.puestosMax > 0 ? filters.puestosMax : maxVal})`;
    } else if (label) {
      label.textContent = '';
    }
  }

  function getHandleValue(clientX) {
    const rect = slider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    return Math.round((percent / 100) * maxVal);
  }

  // Mouse events
  function onMouseDown(e, handle) {
    e.preventDefault();
    _sliderDragging = handle;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!_sliderDragging) return;
    const val = getHandleValue(e.clientX);
    const current = getFilters();

    if (_sliderDragging === 'min') {
      const newVal = Math.min(val, current.puestosMax || maxVal);
      setFilters({ puestosMin: newVal > range.min ? newVal : 0 });
    } else {
      const newVal = Math.max(val, current.puestosMin || range.min);
      setFilters({ puestosMax: newVal < maxVal ? newVal : 0 });
    }
    updateHandles();
  }

  function onMouseUp() {
    _sliderDragging = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  handleMin.addEventListener('mousedown', (e) => onMouseDown(e, 'min'));
  handleMax.addEventListener('mousedown', (e) => onMouseDown(e, 'max'));

  // Touch events
  function onTouchStart(e, handle) {
    e.preventDefault();
    _sliderDragging = handle;
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }

  function onTouchMove(e) {
    if (!_sliderDragging) return;
    const val = getHandleValue(e.touches[0].clientX);
    const current = getFilters();

    if (_sliderDragging === 'min') {
      const newVal = Math.min(val, current.puestosMax || maxVal);
      setFilters({ puestosMin: newVal > range.min ? newVal : 0 });
    } else {
      const newVal = Math.max(val, current.puestosMin || range.min);
      setFilters({ puestosMax: newVal < maxVal ? newVal : 0 });
    }
    updateHandles();
  }

  function onTouchEnd() {
    _sliderDragging = null;
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  }

  handleMin.addEventListener('touchstart', (e) => onTouchStart(e, 'min'));
  handleMax.addEventListener('touchstart', (e) => onTouchStart(e, 'max'));

  // Click on track to jump
  slider.addEventListener('mousedown', (e) => {
    if (e.target !== slider && !e.target.classList.contains('puestos-slider__track') && !e.target.classList.contains('puestos-slider__fill')) return;
    const val = getHandleValue(e.clientX);
    const current = getFilters();
    const mid = ((current.puestosMin || range.min) + (current.puestosMax || maxVal)) / 2;
    if (val < mid) {
      setFilters({ puestosMin: val > range.min ? val : 0 });
    } else {
      setFilters({ puestosMax: val < maxVal ? val : 0 });
    }
    updateHandles();
  });

  // Arrow key support for handles
  [handleMin, handleMax].forEach((handle, idx) => {
    handle.addEventListener('keydown', (e) => {
      const isMin = idx === 0;
      const step = Math.max(1, Math.round(maxVal / 100));
      const current = getFilters();
      const key = e.key;

      if (key === 'ArrowLeft' || key === 'ArrowDown') {
        e.preventDefault();
        if (isMin) {
          const newVal = Math.max(current.puestosMin - step, range.min);
          setFilters({ puestosMin: newVal > range.min ? newVal : 0 });
        } else {
          const newVal = Math.max(current.puestosMax - step, current.puestosMin || range.min);
          setFilters({ puestosMax: newVal < maxVal ? newVal : 0 });
        }
        updateHandles();
      } else if (key === 'ArrowRight' || key === 'ArrowUp') {
        e.preventDefault();
        if (isMin) {
          const newVal = Math.min(current.puestosMin + step, current.puestosMax || maxVal);
          setFilters({ puestosMin: newVal > range.min ? newVal : 0 });
        } else {
          const newVal = Math.min(current.puestosMax + step, maxVal);
          setFilters({ puestosMax: newVal < maxVal ? newVal : 0 });
        }
        updateHandles();
      }
    });
  });

  updateHandles();
}

/** Build active filter badges */
function updateActiveFilterBadges(filters) {
  const section = document.getElementById('active-filters-section');
  const container = document.getElementById('active-filters');
  if (!section || !container) return;

  const badges = [];

  if (filters.region) {
    badges.push({ label: filters.region, key: 'region', icon: '📍' });
  }
  if (filters.comuna) {
    badges.push({ label: filters.comuna, key: 'comuna', icon: '🏘️' });
  }
  if (filters.dias.length > 0) {
    const dayAbbr = filters.dias.map(d => {
      const map = { Lunes: 'Lu', Martes: 'Ma', Miércoles: 'Mi', Jueves: 'Ju', Viernes: 'Vi', Sábado: 'Sá', Domingo: 'Do' };
      return map[d] || d;
    }).join(', ');
    badges.push({ label: dayAbbr, key: 'dias', icon: '📅' });
  }
  if (filters.puestosMin > 0 || filters.puestosMax > 0) {
    const range = getPuestoRange();
    const min = filters.puestosMin > 0 ? filters.puestosMin.toLocaleString('es-CL') : '0';
    const max = filters.puestosMax > 0 ? filters.puestosMax.toLocaleString('es-CL') : range.max.toLocaleString('es-CL');
    badges.push({ label: `${min}–${max} puestos`, key: 'puestos', icon: '🏪' });
  }

  if (badges.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  container.innerHTML = badges.map(b => `
    <button class="filter-badge" data-filter-key="${b.key}" aria-label="Quitar filtro: ${b.label}">
      <span class="filter-badge__icon">${b.icon}</span>
      <span class="filter-badge__label">${b.label}</span>
      <svg class="filter-badge__close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `).join('');

  // Click handler for badge removal
  container.querySelectorAll('.filter-badge').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.filterKey;
      clearSingleFilter(key);
    });
  });
}

/** Clear a single filter by key */
function clearSingleFilter(key) {
  switch (key) {
    case 'region': {
      setFilters({ region: '', comuna: '' });
      const sel = document.getElementById('filter-region');
      if (sel) sel.value = '';
      populateComunas('');
      break;
    }
    case 'comuna': {
      setFilters({ comuna: '' });
      const sel = document.getElementById('filter-comuna');
      if (sel) sel.value = '';
      break;
    }
    case 'dias': {
      setFilters({ dias: [] });
      document.querySelectorAll('.day-pill.is-active').forEach(p => p.classList.remove('is-active'));
      break;
    }
    case 'puestos': {
      setFilters({ puestosMin: 0, puestosMax: 0 });
      updatePuestosSlider();
      break;
    }
  }
}

/** Force-update puesto slider UI */
function updatePuestosSlider() {
  const handleMin = document.getElementById('puestos-handle-min');
  const handleMax = document.getElementById('puestos-handle-max');
  const fill = document.getElementById('puestos-fill');
  const valMin = document.getElementById('puestos-val-min');
  const valMax = document.getElementById('puestos-val-max');

  if (!handleMin || !handleMax || !fill) return;

  const range = getPuestoRange();
  const maxVal = range.max;
  const filters = getFilters();

  const minPercent = maxVal > 0 ? (filters.puestosMin / maxVal) * 100 : 0;
  const maxPercent = filters.puestosMax > 0
    ? (filters.puestosMax / maxVal) * 100
    : 100;

  handleMin.style.left = `${minPercent}%`;
  handleMax.style.left = `${maxPercent}%`;
  fill.style.left = `${minPercent}%`;
  fill.style.width = `${maxPercent - minPercent}%`;

  if (valMin) valMin.textContent = filters.puestosMin.toLocaleString('es-CL');
  if (valMax) valMax.textContent = (filters.puestosMax > 0 ? filters.puestosMax : maxVal).toLocaleString('es-CL');

  const label = document.getElementById('puestos-range-label');
  if (label && (filters.puestosMin > 0 || filters.puestosMax > 0)) {
    label.textContent = `(${filters.puestosMin}–${filters.puestosMax > 0 ? filters.puestosMax : maxVal})`;
  } else if (label) {
    label.textContent = '';
  }
}

/** Setup event listeners for dropdowns and clear button */
function setupEventListeners() {
  // Region select
  const regionSelect = document.getElementById('filter-region');
  regionSelect?.addEventListener('change', (e) => {
    const region = e.target.value;
    setFilters({ region });
    populateComunas(region);

    // Fly to region or full Chile
    if (region && REGION_CENTROIDS[region]) {
      const [lng, lat] = REGION_CENTROIDS[region];
      const zoom = region === 'Metropolitana' ? 9 : 7;
      // Use fitToFeatures for better bounds
      const filtered = getFilteredFeatures();
      if (filtered.length > 0) {
        fitToFeatures(filtered);
      }
    } else {
      flyToChile();
    }
  });

  // Comuna select
  const comunaSelect = document.getElementById('filter-comuna');
  comunaSelect?.addEventListener('change', (e) => {
    setFilters({ comuna: e.target.value });

    // Fly to filtered features
    const filtered = getFilteredFeatures();
    if (filtered.length > 0) {
      fitToFeatures(filtered);
    }
  });

  // Clear filters
  document.getElementById('clear-filters')?.addEventListener('click', () => {
    clearFilters();

    // Reset UI
    if (regionSelect) regionSelect.value = '';
    if (comunaSelect) {
      comunaSelect.value = '';
      populateComunas('');
    }

    // Clear day pills
    document.querySelectorAll('.day-pill.is-active').forEach(p => p.classList.remove('is-active'));

    // Reset puesto slider
    updatePuestosSlider();

    // Clear search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = '';
      document.getElementById('search-container')?.classList.remove('has-value');
    }

    flyToChile();
  });
}

/**
 * Update filter UI elements (counts, badges).
 */
function updateFilterUI(filtered, filters) {
  const total = getAllFeatures().length;
  const count = filtered.length;

  // Result count
  const filteredEl = document.getElementById('filtered-count');
  const totalEl = document.getElementById('total-count');
  if (filteredEl) filteredEl.textContent = count.toLocaleString('es-CL');
  if (totalEl) totalEl.textContent = total.toLocaleString('es-CL');

  // Region count
  const regionCount = document.getElementById('region-count');
  if (regionCount && filters.region) {
    regionCount.textContent = `${count}`;
  } else if (regionCount) {
    regionCount.textContent = '';
  }

  // Update hero stats
  updateHeroStats(filtered);
  // Update active filter badges
  updateActiveFilterBadges(filters);
}

/**
 * Update hero stat cards.
 */
function updateHeroStats(filtered) {
  const today = getTodayName();
  const openCount = filtered.filter(f => {
    let dias = f.properties.dias;
    if (typeof dias === 'string') {
      try { dias = JSON.parse(dias); } catch { dias = []; }
    }
    return dias.includes(today);
  }).length;

  const regions = new Set(filtered.map(f => f.properties.region));
  const comunas = new Set(filtered.map(f => f.properties.comuna));

  animateCounter('stat-total', filtered.length);
  animateCounter('stat-open', openCount);
  animateCounter('stat-regiones', regions.size);
  animateCounter('stat-comunas', comunas.size);
}

/**
 * Animate a counter from current to target value.
 */
function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const current = parseInt(el.textContent.replace(/\D/g, '')) || 0;
  if (current === target) return;

  const duration = 400;
  const startTime = performance.now();

  function step(timestamp) {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = Math.round(current + (target - current) * eased);
    el.textContent = value.toLocaleString('es-CL');

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}
