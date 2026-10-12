/**
 * app.js — Entry point for Ferias Chile.
 * 
 * Orchestrates data loading, map initialization, filters, and search.
 */
import { loadData, getGeoJSON } from './data.js';
import { initMap } from './map.js';
import { initFilters } from './filters.js';
import { initSearch } from './search.js';
import { initStats } from './stats.js';
import { initOnboarding, startTour } from './onboarding.js';

async function main() {
  const loadingOverlay = document.getElementById('loading-overlay');
  document.getElementById('retry-loading')?.addEventListener('click', () => window.location.reload());

  function showError(message) {
    if (!loadingOverlay || loadingOverlay.classList.contains('is-hidden')) return;
    loadingOverlay.querySelector('.loading-text').textContent = message;
    loadingOverlay.querySelector('.loading-spinner').style.display = 'none';
    document.getElementById('retry-loading').hidden = false;
  }

  try {
    // 1. Load data
    const { geojson, stats } = await loadData();
    console.log(`✅ Loaded ${geojson.metadata.total} ferias (${geojson.metadata.regiones} regiones, ${geojson.metadata.comunas} comunas)`);

    // 2. Initialize map
    const map = initMap(geojson);
    map.once('error', () => showError('No se pudo cargar el mapa. Revisa tu conexión y reintenta.'));

    // 3. Initialize filters (after map is set up)
    map.on('load', () => {
      initFilters();
      initSearch();
      initStats();
      initMobileControls();
      initStatsToggle();
      initHelpButton();
      initOnboarding();

      // Hide loading overlay
      if (loadingOverlay) {
        loadingOverlay.classList.add('is-hidden');
        setTimeout(() => loadingOverlay.remove(), 600);
      }

      console.log('🗺️ Ferias Chile ready!');
    });

  } catch (error) {
    console.error('❌ Error initializing app:', error);
    showError('No se pudieron cargar las ferias. Revisa tu conexión y reintenta.');
  }
}

/**
 * Mobile sidebar toggle.
 */
function initMobileControls() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (!toggle || !sidebar) return;

  const mobile = window.matchMedia('(max-width: 768px)');
  sidebar.inert = mobile.matches;
  mobile.addEventListener('change', () => {
    closeSidebar();
  });

  function openSidebar() {
    sidebar.classList.add('is-open');
    backdrop?.classList.add('is-visible');
    sidebar.inert = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Cerrar filtros');
    document.getElementById('filter-region')?.focus();
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    backdrop?.classList.remove('is-visible');
    sidebar.inert = mobile.matches;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir filtros');
    if (mobile.matches) toggle.focus();
  }

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('is-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  backdrop?.addEventListener('click', closeSidebar);
  sidebar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebar();
  });
}

/**
 * Stats panel toggle.
 */
function initStatsToggle() {
  const btnStats = document.getElementById('btn-stats');
  const panel = document.getElementById('stats-panel');
  const btnClose = document.getElementById('btn-close-stats');

  if (!btnStats || !panel) return;

  panel.inert = true;

  function setOpen(open) {
    panel.classList.toggle('is-open', open);
    panel.inert = !open;
    btnStats.classList.toggle('is-active', open);
    btnStats.setAttribute('aria-expanded', String(open));
    if (open) btnClose?.focus();
    else btnStats.focus();
  }

  btnStats.addEventListener('click', () => {
    setOpen(!panel.classList.contains('is-open'));
  });

  btnClose?.addEventListener('click', () => {
    setOpen(false);
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

/**
 * Register Service Worker for offline support.
 */
function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope);
          // Listen for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version available. Reload to update.');
              }
            });
          });
        })
        .catch((err) => {
          console.error('[PWA] Service Worker registration failed:', err);
        });
    });
  }
}

/**
 * Help button — restarts the onboarding tour.
 */
function initHelpButton() {
  const btn = document.getElementById('btn-help');
  if (!btn) return;

  btn.addEventListener('click', () => {
    startTour();
  });
}

// Boot
main();
if (import.meta.env.PROD) registerSW();
