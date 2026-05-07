/**
 * stats.js — Statistics dashboard with D3.js charts.
 * Phase 3: Heatmap, Ranking de Comunas, Treemap de Regiones.
 */
import {
  select,
  scaleBand,
  scaleLinear,
  scaleOrdinal,
  hierarchy,
  treemap as d3treemap,
  max,
} from 'd3';
import {
  getAllFeatures,
  setFilters,
} from './data.js';

const REGION_ORDER = [
  'Arica y Parinacota',
  'Tarapaca',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaiso',
  'Metropolitana de Santiago',
  "Libertador General Bernardo O'Higgins",
  'Maule',
  'Nuble',
  'Biobio',
  'La Araucania',
  'Los Rios',
  'Los Lagos',
  'Aysen del General Carlos Ibanez del Campo',
  'Magallanes y de la Antartica Chilena',
];

const REGION_SHORT = {
  'Arica y Parinacota': 'Arica',
  'Tarapaca': 'Tarapacá',
  'Antofagasta': 'Antofagasta',
  'Atacama': 'Atacama',
  'Coquimbo': 'Coquimbo',
  'Valparaiso': 'Valparaíso',
  'Metropolitana de Santiago': 'Metrop.',
  "Libertador General Bernardo O'Higgins": "O'Higgins",
  'Maule': 'Maule',
  'Nuble': 'Ñuble',
  'Biobio': 'Biobío',
  'La Araucania': 'Araucanía',
  'Los Rios': 'Los Ríos',
  'Los Lagos': 'Los Lagos',
  'Aysen del General Carlos Ibanez del Campo': 'Aysén',
  'Magallanes y de la Antartica Chilena': 'Magallanes',
};

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_ABBR = {
  Lunes: 'Lu', Martes: 'Ma', Miércoles: 'Mi',
  Jueves: 'Ju', Viernes: 'Vi', Sábado: 'Sá', Domingo: 'Do',
};

const PALETTE = [
  'hsl(185, 80%, 55%)',
  'hsl(260, 50%, 65%)',
  'hsl(38, 90%, 60%)',
  'hsl(155, 65%, 50%)',
  'hsl(220, 70%, 55%)',
  'hsl(340, 60%, 55%)',
  'hsl(45, 80%, 55%)',
  'hsl(190, 60%, 45%)',
  'hsl(280, 50%, 55%)',
  'hsl(10, 70%, 55%)',
  'hsl(200, 65%, 50%)',
  'hsl(320, 45%, 55%)',
  'hsl(170, 55%, 45%)',
  'hsl(55, 65%, 50%)',
  'hsl(240, 55%, 60%)',
  'hsl(15, 65%, 55%)',
];

let _tooltip = null;

function getDias(feature) {
  const d = feature.properties.dias;
  if (Array.isArray(d)) return d;
  if (typeof d === 'string') {
    try { return JSON.parse(d); } catch { return d.split(',').map(s => s.trim()); }
  }
  return [];
}

function ensureTooltip() {
  if (!_tooltip) {
    _tooltip = document.createElement('div');
    _tooltip.className = 'chart-tooltip';
    document.body.appendChild(_tooltip);
  }
  return _tooltip;
}

function showTooltip(event, text) {
  const t = ensureTooltip();
  t.textContent = text;
  t.classList.add('is-visible');

  // Initial position
  let x = event.clientX + 14;
  let y = event.clientY - 32;
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;

  // Measure and clamp after render
  requestAnimationFrame(() => {
    const rect = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;

    if (x + rect.width > vw - pad) {
      x = event.clientX - rect.width - 14;
    }
    if (x < pad) x = pad;
    if (y + rect.height > vh - pad) {
      y = event.clientY - rect.height - 14;
    }
    if (y < pad) y = pad;

    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
  });
}

function hideTooltip() {
  if (_tooltip) _tooltip.classList.remove('is-visible');
}

export function initStats() {
  const container = document.getElementById('stats-content');
  if (!container) return;
  container.innerHTML = '';

  const allFeatures = getAllFeatures();

  const heatmapDiv = createSection(container, 'Ferias por Región y Día', 'heatmap');
  renderHeatmap(heatmapDiv, allFeatures);

  const rankingDiv = createSection(container, 'Top 10 Comunas', 'ranking');
  renderRanking(rankingDiv, allFeatures);

  const treemapDiv = createSection(container, 'Distribución por Región', 'treemap');
  renderTreemap(treemapDiv, allFeatures);
}

function createSection(parent, title, id) {
  const section = document.createElement('div');
  section.className = 'stats-chart';
  section.id = `${id}-section`;

  const h = document.createElement('h3');
  h.className = 'stats-chart__title';
  h.textContent = title;
  section.appendChild(h);

  const div = document.createElement('div');
  div.className = 'stats-chart__svg';
  div.id = `${id}-chart`;
  section.appendChild(div);

  parent.appendChild(section);
  return div;
}

function renderHeatmap(container, allFeatures) {
  const margin = { top: 4, right: 4, bottom: 22, left: 64 };
  const vw = 300;
  const vh = 290;
  const innerW = vw - margin.left - margin.right;
  const innerH = vh - margin.top - margin.bottom;

  const regions = REGION_ORDER.filter(r =>
    allFeatures.some(f => f.properties.region === r)
  );

  const data = [];
  for (const region of regions) {
    const regionFeatures = allFeatures.filter(f => f.properties.region === region);
    for (const day of DAYS) {
      const count = regionFeatures.filter(f => getDias(f).includes(day)).length;
      data.push({ region, day, count });
    }
  }

  const maxCount = max(data, d => d.count) || 1;

  const svg = select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${vw} ${vh}`)
    .attr('class', 'stats-svg');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = scaleBand().domain(DAYS).range([0, innerW]).padding(0.06);
  const y = scaleBand().domain(regions).range([0, innerH]).padding(0.06);

  function cellColor(count) {
    if (count === 0) return 'hsl(220, 18%, 8%)';
    const t = Math.sqrt(count / maxCount);
    const h = 220 - 35 * t;
    const s = 20 + 60 * t;
    const l = 12 + 43 * t;
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  g.selectAll('.heatmap-cell')
    .data(data)
    .join('rect')
    .attr('class', 'heatmap-cell')
    .attr('x', d => x(d.day))
    .attr('y', d => y(d.region))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('rx', 2)
    .attr('fill', d => cellColor(d.count))
    .attr('cursor', d => d.count > 0 ? 'pointer' : 'default')
    .on('mouseenter', function (event, d) {
      select(this).attr('stroke', 'hsl(185, 80%, 55%)').attr('stroke-width', 1.5);
      showTooltip(event, `${REGION_SHORT[d.region] || d.region} · ${d.day}: ${d.count}`);
    })
    .on('mouseleave', function () {
      select(this).attr('stroke', null);
      hideTooltip();
    })
    .on('click', (event, d) => {
      if (d.count > 0) {
        hideTooltip();
        setFilters({ region: d.region, dias: [d.day] });
      }
    });

  g.selectAll('.hm-x-label')
    .data(DAYS)
    .join('text')
    .attr('class', 'hm-x-label')
    .attr('x', d => x(d) + x.bandwidth() / 2)
    .attr('y', innerH + 14)
    .attr('text-anchor', 'middle')
    .attr('fill', 'hsl(220, 10%, 58%)')
    .attr('font-size', '8px')
    .attr('font-family', "'DM Sans', system-ui, sans-serif")
    .text(d => DAY_ABBR[d]);

  g.selectAll('.hm-y-label')
    .data(regions)
    .join('text')
    .attr('class', 'hm-y-label')
    .attr('x', -4)
    .attr('y', d => y(d) + y.bandwidth() / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'central')
    .attr('fill', 'hsl(220, 10%, 58%)')
    .attr('font-size', '8px')
    .attr('font-family', "'DM Sans', system-ui, sans-serif")
    .text(d => REGION_SHORT[d] || d);

  // Color legend
  const legendW = innerW;
  const legendH = 6;
  const legendY = vh - 2;

  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'hm-gradient')
    .attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '100%').attr('y2', '0%');

  gradient.append('stop').attr('offset', '0%').attr('stop-color', cellColor(0));
  gradient.append('stop').attr('offset', '50%').attr('stop-color', cellColor(Math.round(maxCount / 2)));
  gradient.append('stop').attr('offset', '100%').attr('stop-color', cellColor(maxCount));

  svg.append('rect')
    .attr('x', margin.left)
    .attr('y', legendY)
    .attr('width', legendW)
    .attr('height', legendH)
    .attr('rx', 2)
    .attr('fill', 'url(#hm-gradient)')
    .attr('opacity', 0.7);

  svg.append('text')
    .attr('x', margin.left)
    .attr('y', legendY + legendH + 8)
    .attr('fill', 'hsl(220, 10%, 48%)')
    .attr('font-size', '7px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .text('0');

  svg.append('text')
    .attr('x', margin.left + legendW)
    .attr('y', legendY + legendH + 8)
    .attr('text-anchor', 'end')
    .attr('fill', 'hsl(220, 10%, 48%)')
    .attr('font-size', '7px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .text(maxCount.toString());
}

function renderRanking(container, allFeatures) {
  const comunaMap = {};
  for (const f of allFeatures) {
    const c = f.properties.comuna;
    if (!comunaMap[c]) comunaMap[c] = { comuna: c, count: 0, region: f.properties.region };
    comunaMap[c].count++;
  }
  const top10 = Object.values(comunaMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (!top10.length) return;

  const maxVal = top10[0].count || 1;
  const margin = { top: 4, right: 40, bottom: 4, left: 76 };
  const vw = 300;
  const barH = 22;
  const barGap = 5;
  const chartH = top10.length * (barH + barGap) - barGap;
  const vh = chartH + margin.top + margin.bottom;
  const innerW = vw - margin.left - margin.right;

  const svg = select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${vw} ${vh}`)
    .attr('class', 'stats-svg');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = scaleLinear().domain([0, maxVal]).range([0, innerW]);
  const y = scaleBand()
    .domain(top10.map(d => d.comuna))
    .range([0, chartH])
    .padding(0.18);

  // Track backgrounds
  g.selectAll('.rk-track')
    .data(top10)
    .join('rect')
    .attr('class', 'rk-track')
    .attr('x', 0)
    .attr('y', d => y(d.comuna))
    .attr('width', innerW)
    .attr('height', y.bandwidth())
    .attr('rx', 3)
    .attr('fill', 'hsl(220, 18%, 12%)');

  // Bars (animated from 0)
  const bars = g.selectAll('.ranking-bar')
    .data(top10)
    .join('rect')
    .attr('class', 'ranking-bar')
    .attr('x', 0)
    .attr('y', d => y(d.comuna))
    .attr('width', 0)
    .attr('height', y.bandwidth())
    .attr('rx', 3)
    .attr('fill', 'hsl(185, 80%, 55%)')
    .attr('cursor', 'pointer')
    .on('mouseenter', function (event, d) {
      select(this).attr('fill', 'hsl(185, 90%, 65%)');
      showTooltip(event, `${d.comuna}: ${d.count} ferias`);
    })
    .on('mouseleave', function () {
      select(this).attr('fill', 'hsl(185, 80%, 55%)');
      hideTooltip();
    })
    .on('click', (event, d) => {
      hideTooltip();
      setFilters({ region: d.region, comuna: d.comuna });
    });

  bars.transition()
    .duration(600)
    .delay((d, i) => i * 60)
    .attr('width', d => Math.max(2, x(d.count)));

  // Labels
  g.selectAll('.ranking-label')
    .data(top10)
    .join('text')
    .attr('class', 'ranking-label')
    .attr('x', -6)
    .attr('y', d => y(d.comuna) + y.bandwidth() / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'central')
    .attr('fill', 'hsl(220, 15%, 85%)')
    .attr('font-size', '10px')
    .attr('font-family', "'DM Sans', system-ui, sans-serif")
    .text(d => d.comuna.length > 11 ? d.comuna.slice(0, 10) + '…' : d.comuna);

  // Value labels
  g.selectAll('.ranking-value')
    .data(top10)
    .join('text')
    .attr('class', 'ranking-value')
    .attr('x', d => Math.max(x(d.count) + 6, 28))
    .attr('y', d => y(d.comuna) + y.bandwidth() / 2)
    .attr('dominant-baseline', 'central')
    .attr('fill', 'hsl(220, 10%, 58%)')
    .attr('font-size', '9px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .attr('font-variant-numeric', 'tabular-nums')
    .text(d => d.count);
}

function renderTreemap(container, allFeatures) {
  const margin = { top: 4, right: 4, bottom: 4, left: 4 };
  const vw = 300;
  const vh = 240;
  const innerW = vw - margin.left - margin.right;
  const innerH = vh - margin.top - margin.bottom;

  const regionCounts = {};
  for (const f of allFeatures) {
    const r = f.properties.region;
    regionCounts[r] = (regionCounts[r] || 0) + 1;
  }

  const root = hierarchy({
    name: 'Chile',
    children: Object.entries(regionCounts).map(([name, value]) => ({ name, value })),
  })
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  d3treemap()
    .size([innerW, innerH])
    .padding(3)
    .round(true)(root);

  const color = scaleOrdinal().domain(REGION_ORDER).range(PALETTE);

  const svg = select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${vw} ${vh}`)
    .attr('class', 'stats-svg');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const leaves = root.leaves();

  g.selectAll('.treemap-cell')
    .data(leaves)
    .join('rect')
    .attr('class', 'treemap-cell')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('width', d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('rx', 4)
    .attr('fill', d => color(d.data.name))
    .attr('fill-opacity', 0.75)
    .attr('cursor', 'pointer')
    .on('mouseenter', function (event, d) {
      select(this)
        .attr('fill-opacity', 1)
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
      showTooltip(event, `${d.data.name}: ${d.value} ferias`);
    })
    .on('mouseleave', function () {
      select(this)
        .attr('fill-opacity', 0.75)
        .attr('stroke', null);
      hideTooltip();
    })
    .on('click', (event, d) => {
      hideTooltip();
      setFilters({ region: d.data.name });
    });

  // Region name labels (only for cells large enough)
  g.selectAll('.treemap-label')
    .data(leaves.filter(d => (d.x1 - d.x0) > 38 && (d.y1 - d.y0) > 16))
    .join('text')
    .attr('class', 'treemap-label')
    .attr('x', d => d.x0 + 5)
    .attr('y', d => d.y0 + 14)
    .attr('fill', 'white')
    .attr('font-size', d => (d.x1 - d.x0) > 56 ? '10px' : '8px')
    .attr('font-family', "'DM Sans', system-ui, sans-serif")
    .attr('font-weight', '600')
    .attr('pointer-events', 'none')
    .text(d => REGION_SHORT[d.data.name] || d.data.name);

  // Value labels (only for bigger cells)
  g.selectAll('.treemap-value')
    .data(leaves.filter(d => (d.x1 - d.x0) > 38 && (d.y1 - d.y0) > 28))
    .join('text')
    .attr('class', 'treemap-value')
    .attr('x', d => d.x0 + 5)
    .attr('y', d => d.y0 + 27)
    .attr('fill', 'rgba(255,255,255,0.65)')
    .attr('font-size', '9px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .attr('font-variant-numeric', 'tabular-nums')
    .attr('pointer-events', 'none')
    .text(d => d.value);
}