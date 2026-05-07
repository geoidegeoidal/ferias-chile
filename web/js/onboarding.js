/**
 * onboarding.js — Guided tour for first-time users.
 * Custom lightweight implementation, no external dependencies.
 * Responsive: tooltips clamp to viewport, invert position if needed.
 */

const STORAGE_KEY = 'ferias-tour-completed';

const STEPS = [
  {
    target: null,
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
    target: '#stats-panel',
    title: 'Estadísticas',
    text: 'Panel de estadísticas con heatmaps por región y día, ranking de comunas y distribución nacional. Haz clic en cualquier gráfico para filtrar el mapa.',
    position: 'left',
    onBeforeShow: () => {
      const panel = document.getElementById('stats-panel');
      const btn = document.getElementById('btn-stats');
      if (panel && !panel.classList.contains('is-open')) {
        panel.classList.add('is-open');
        btn?.classList.add('is-active');
      }
    },
    onAfterHide: () => {
      const panel = document.getElementById('stats-panel');
      const btn = document.getElementById('btn-stats');
      if (panel && panel.classList.contains('is-open')) {
        panel.classList.remove('is-open');
        btn?.classList.remove('is-active');
      }
    },
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
    target: null,
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

const TOOLTIP_WIDTH = 300;
const TOOLTIP_HEIGHT = 170;
const MARGIN = 16;
const MOBILE_BREAKPOINT = 768;

export function initOnboarding() {
  const completed = localStorage.getItem(STORAGE_KEY);
  if (completed) return;
  setTimeout(() => startTour(), 1200);
}

export function startTour() {
  _current = 0;
  buildDOM();
  showStep(0);
  bindGlobalEvents();
}

export function hasSeenTour() {
  return !!localStorage.getItem(STORAGE_KEY);
}

export function resetTour() {
  localStorage.removeItem(STORAGE_KEY);
}

function buildDOM() {
  _overlay = document.createElement('div');
  _overlay.className = 'onboarding-overlay';
  _overlay.setAttribute('role', 'dialog');
  _overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(_overlay);

  _spotlight = document.createElement('div');
  _spotlight.className = 'onboarding-spotlight';
  _overlay.appendChild(_spotlight);

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
  // Close stats panel if it was opened by the tour
  const panel = document.getElementById('stats-panel');
  const btn = document.getElementById('btn-stats');
  if (panel && panel.classList.contains('is-open')) {
    panel.classList.remove('is-open');
    btn?.classList.remove('is-active');
  }
  localStorage.setItem(STORAGE_KEY, 'true');
}

async function showStep(index) {
  const prevStep = STEPS[_current];
  if (prevStep && prevStep.onAfterHide) {
    prevStep.onAfterHide();
  }

  _current = index;
  const step = STEPS[index];

  // Run pre-step hook (e.g. open a panel)
  if (step.onBeforeShow) {
    step.onBeforeShow();
    // Allow CSS transition to settle (stats panel takes ~400ms)
    await new Promise(r => setTimeout(r, 350));
  }

  const target = step.target ? document.querySelector(step.target) : null;

  if (target) {
    positionSpotlight(target);
    _spotlight.style.display = 'block';
  } else {
    _spotlight.style.display = 'none';
  }

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

  // Wait for DOM layout then position
  requestAnimationFrame(() => {
    if (target) {
      positionTooltip(target, step.position);
    } else {
      centerTooltip();
    }
  });

  _tooltip.querySelector('[data-action="prev"]')?.addEventListener('click', () => showStep(_current - 1));
  _tooltip.querySelector('[data-action="next"]')?.addEventListener('click', () => {
    if (_current === STEPS.length - 1) teardown();
    else showStep(_current + 1);
  });
  _tooltip.querySelector('.onboarding-tooltip__close')?.addEventListener('click', teardown);

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
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw < MOBILE_BREAKPOINT;

  // On mobile: always use centered or bottom layout to avoid overflow
  if (isMobile) {
    // If target is the sidebar which is off-screen on mobile, center
    if (rect.width === 0 || rect.right < 0 || rect.left > vw) {
      centerTooltip();
      return;
    }
    // Otherwise place below the target, full width
    positionTooltipMobile(rect);
    return;
  }

  // Measure actual tooltip size
  const tw = _tooltip.offsetWidth || TOOLTIP_WIDTH;
  const th = _tooltip.offsetHeight || TOOLTIP_HEIGHT;

  let top, left;

  // Try requested position
  const placements = [position, invertPosition(position), 'bottom', 'top', 'center'];
  let chosen = null;

  for (const p of placements) {
    if (p === 'center') { chosen = p; break; }
    const pos = computePosition(rect, p, tw, th, MARGIN);
    if (fitsInViewport(pos, tw, th, MARGIN)) {
      chosen = p;
      top = pos.top;
      left = pos.left;
      break;
    }
  }

  if (chosen === 'center') {
    centerTooltip();
    return;
  }

  _tooltip.style.left = `${left}px`;
  _tooltip.style.top = `${top}px`;
  _tooltip.style.transform = 'none';
  _tooltip.classList.remove('is-centered');
}

function positionTooltipMobile(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = Math.min(vw - MARGIN * 2, TOOLTIP_WIDTH);
  _tooltip.style.width = `${tw}px`;

  // Try below target first
  let top = rect.bottom + MARGIN;
  let left = MARGIN;

  const th = _tooltip.offsetHeight || TOOLTIP_HEIGHT;

  // If doesn't fit below, try above
  if (top + th + MARGIN > vh && rect.top - th - MARGIN > 0) {
    top = rect.top - th - MARGIN;
  }

  // Clamp
  top = Math.max(MARGIN, Math.min(top, vh - th - MARGIN));

  _tooltip.style.left = `${left}px`;
  _tooltip.style.top = `${top}px`;
  _tooltip.style.transform = 'none';
  _tooltip.classList.remove('is-centered');
}

function computePosition(targetRect, position, tw, th, margin) {
  switch (position) {
    case 'right':
      return {
        left: targetRect.right + margin,
        top: targetRect.top + targetRect.height / 2 - th / 2,
      };
    case 'left':
      return {
        left: targetRect.left - tw - margin,
        top: targetRect.top + targetRect.height / 2 - th / 2,
      };
    case 'bottom':
      return {
        left: targetRect.left + targetRect.width / 2 - tw / 2,
        top: targetRect.bottom + margin,
      };
    case 'top':
      return {
        left: targetRect.left + targetRect.width / 2 - tw / 2,
        top: targetRect.top - th - margin,
      };
    default:
      return { left: 0, top: 0 };
  }
}

function fitsInViewport(pos, tw, th, margin) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    pos.left >= margin &&
    pos.left + tw <= vw - margin &&
    pos.top >= margin &&
    pos.top + th <= vh - margin
  );
}

function invertPosition(pos) {
  const map = { right: 'left', left: 'right', bottom: 'top', top: 'bottom', center: 'center' };
  return map[pos] || 'center';
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
