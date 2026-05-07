/**
 * onboarding.js — Guided tour for first-time users.
 * Custom lightweight implementation, no external dependencies.
 */

const STORAGE_KEY = 'ferias-tour-completed';

const STEPS = [
  {
    target: null, // centered modal
    title: 'Bienvenido a Ferias Chile',
    text: 'Esta plataforma te permite explorar las 1,764 ferias libres de Chile con datos abiertos de ODEPA. Te mostramos los principales elementos en un minuto.',
    position: 'center',
  },
  {
    target: '#sidebar',
    title: 'Panel de Filtros',
    text: 'Filtra ferias por región, comuna, día de la semana y rango de puestos. También puedes quitar filtros individuales desde los badges.',
    position: 'right',
  },
  {
    target: '#search-container',
    title: 'Búsqueda Inteligente',
    text: 'Busca por nombre de feria, comuna o dirección. La búsqueda es tolerante a errores de tipeo y resalta las coincidencias.',
    position: 'bottom',
  },
  {
    target: '#map',
    title: 'Mapa Interactivo',
    text: 'Los puntos verdes son ferias abiertas hoy. Los grises están cerradas. Haz zoom, arrastra y haz clic en clusters para explorar.',
    position: 'left',
  },
  {
    target: '#btn-stats',
    title: 'Estadísticas',
    text: 'Abre el panel de estadísticas para ver heatmaps por región y día, ranking de comunas y distribución nacional.',
    position: 'bottom',
  },
  {
    target: '#btn-geolocate',
    title: 'Tu Ubicación',
    text: 'Haz clic para centrar el mapa en tu posición y descubrir las ferias más cercanas a ti.',
    position: 'left',
  },
  {
    target: '#btn-theme-toggle',
    title: 'Cambiar Tema del Mapa',
    text: 'Alterna entre el mapa oscuro (por defecto) y el mapa claro según tu preferencia. Se guarda automáticamente.',
    position: 'left',
  },
  {
    target: null, // centered modal
    title: '¡Listo!',
    text: 'Ya conoces lo esencial. Explora las ferias libres de Chile y comparte el enlace. Si necesitas ayuda, usa el botón "?" en el header.',
    position: 'center',
  },
];

let _current = 0;
let _overlay = null;
let _tooltip = null;
let _spotlight = null;
let _resizeHandler = null;
let _keydownHandler = null;

/**
 * Initialize onboarding. Shows tour only on first visit.
 */
export function initOnboarding() {
  const completed = localStorage.getItem(STORAGE_KEY);
  if (completed) return;

  // Delay slightly to let the UI settle
  setTimeout(() => startTour(), 1200);
}

/**
 * Start the tour from the beginning.
 */
export function startTour() {
  _current = 0;
  buildDOM();
  showStep(0);
  bindGlobalEvents();
}

/**
 * Check if tour has been seen.
 */
export function hasSeenTour() {
  return !!localStorage.getItem(STORAGE_KEY);
}

/**
 * Reset tour state (for testing or restart).
 */
export function resetTour() {
  localStorage.removeItem(STORAGE_KEY);
}

function buildDOM() {
  // Overlay backdrop
  _overlay = document.createElement('div');
  _overlay.className = 'onboarding-overlay';
  _overlay.setAttribute('role', 'dialog');
  _overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(_overlay);

  // Spotlight hole
  _spotlight = document.createElement('div');
  _spotlight.className = 'onboarding-spotlight';
  _overlay.appendChild(_spotlight);

  // Tooltip card
  _tooltip = document.createElement('div');
  _tooltip.className = 'onboarding-tooltip';
  _overlay.appendChild(_tooltip);
}

function teardown() {
  unbindGlobalEvents();
  if (_overlay) {
    _overlay.remove();
    _overlay = null;
    _spotlight = null;
    _tooltip = null;
  }
  localStorage.setItem(STORAGE_KEY, 'true');
}

function showStep(index) {
  _current = index;
  const step = STEPS[index];
  const target = step.target ? document.querySelector(step.target) : null;

  // Position spotlight
  if (target) {
    positionSpotlight(target);
    _spotlight.style.display = 'block';
  } else {
    _spotlight.style.display = 'none';
  }

  // Build tooltip content
  _tooltip.innerHTML = `
    <div class="onboarding-tooltip__header">
      <span class="onboarding-tooltip__step">${index + 1} / ${STEPS.length}</span>
      <button class="onboarding-tooltip__close" aria-label="Cerrar tour">✕</button>
    </div>
    <h3 class="onboarding-tooltip__title">${escapeHtml(step.title)}</h3>
    <p class="onboarding-tooltip__text">${escapeHtml(step.text)}</p>
    <div class="onboarding-tooltip__footer">
      ${index > 0 ? `<button class="onboarding-btn onboarding-btn--secondary" data-action="prev">Anterior</button>` : '<span></span>'}
      <div class="onboarding-dots">
        ${STEPS.map((_, i) => `<span class="onboarding-dot${i === index ? ' is-active' : ''}"></span>`).join('')}
      </div>
      <button class="onboarding-btn onboarding-btn--primary" data-action="next">
        ${index === STEPS.length - 1 ? 'Finalizar' : 'Siguiente'}
      </button>
    </div>
  `;

  // Position tooltip
  if (target) {
    positionTooltip(target, step.position);
  } else {
    centerTooltip();
  }

  // Bind tooltip buttons
  _tooltip.querySelector('[data-action="prev"]')?.addEventListener('click', () => showStep(_current - 1));
  _tooltip.querySelector('[data-action="next"]')?.addEventListener('click', () => {
    if (_current === STEPS.length - 1) teardown();
    else showStep(_current + 1);
  });
  _tooltip.querySelector('.onboarding-tooltip__close')?.addEventListener('click', teardown);

  // Scroll target into view smoothly
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
}

function positionSpotlight(target) {
  const rect = target.getBoundingClientRect();
  const pad = 8;
  _spotlight.style.left = `${rect.left - pad}px`;
  _spotlight.style.top = `${rect.top - pad}px`;
  _spotlight.style.width = `${rect.width + pad * 2}px`;
  _spotlight.style.height = `${rect.height + pad * 2}px`;
}

function positionTooltip(target, position) {
  const rect = target.getBoundingClientRect();
  const tooltipRect = _tooltip.getBoundingClientRect();
  const margin = 16;
  let top, left;

  // Default sizes for first render estimate
  const tw = tooltipRect.width || 320;
  const th = tooltipRect.height || 180;

  switch (position) {
    case 'right':
      left = rect.right + margin;
      top = rect.top + rect.height / 2 - th / 2;
      break;
    case 'left':
      left = rect.left - tw - margin;
      top = rect.top + rect.height / 2 - th / 2;
      break;
    case 'bottom':
      left = rect.left + rect.width / 2 - tw / 2;
      top = rect.bottom + margin;
      break;
    case 'top':
      left = rect.left + rect.width / 2 - tw / 2;
      top = rect.top - th - margin;
      break;
    default:
      centerTooltip();
      return;
  }

  // Clamp to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  left = Math.max(margin, Math.min(left, vw - tw - margin));
  top = Math.max(margin, Math.min(top, vh - th - margin));

  _tooltip.style.left = `${left}px`;
  _tooltip.style.top = `${top}px`;
  _tooltip.classList.remove('is-centered');
}

function centerTooltip() {
  _tooltip.style.left = '50%';
  _tooltip.style.top = '50%';
  _tooltip.style.transform = 'translate(-50%, -50%)';
  _tooltip.classList.add('is-centered');
}

function bindGlobalEvents() {
  _resizeHandler = () => {
    const step = STEPS[_current];
    const target = step.target ? document.querySelector(step.target) : null;
    if (target) {
      positionSpotlight(target);
      positionTooltip(target, step.position);
    }
  };
  window.addEventListener('resize', _resizeHandler);

  _keydownHandler = (e) => {
    if (e.key === 'Escape') teardown();
    if (e.key === 'ArrowRight') {
      if (_current < STEPS.length - 1) showStep(_current + 1);
      else teardown();
    }
    if (e.key === 'ArrowLeft' && _current > 0) showStep(_current - 1);
  };
  document.addEventListener('keydown', _keydownHandler);
}

function unbindGlobalEvents() {
  if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);
  if (_keydownHandler) document.removeEventListener('keydown', _keydownHandler);
  _resizeHandler = null;
  _keydownHandler = null;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
