/**
 * chart-engine.js
 * ─────────────────────────────────────────────────────────────────
 * Responsável por criar e atualizar todos os gráficos via Chart.js.
 * Mantém referências dos gráficos para destruí-los antes de recriar.
 * ─────────────────────────────────────────────────────────────────
 */

const ChartEngine = (() => {

  // Registro de instâncias ativas (id -> Chart instance)
  const _instances = {};

  /* ─────────────────────────────────────────────────────
     PALETA DE CORES (dark-friendly)
  ───────────────────────────────────────────────────── */
  const PALETTE = {
    primary:   '#4f8ef7',
    secondary: '#7c5cbf',
    success:   '#22c55e',
    warning:   '#f59e0b',
    danger:    '#ef4444',
    info:      '#06b6d4',
    gold:      '#eab308',
    orange:    '#f97316'
  };

  const PALETTE_ARRAY = Object.values(PALETTE);

  const GRADIENT_PAIRS = [
    ['#4f8ef7', '#3b72e0'],
    ['#7c5cbf', '#6d28d9'],
    ['#22c55e', '#16a34a'],
    ['#f59e0b', '#d97706'],
    ['#ef4444', '#b91c1c'],
    ['#06b6d4', '#0891b2'],
    ['#eab308', '#a16207'],
    ['#f97316', '#ea580c']
  ];

  /* ─────────────────────────────────────────────────────
     DEFAULTS GLOBAIS DO CHART.JS
  ───────────────────────────────────────────────────── */
  function applyGlobalDefaults() {
    Chart.defaults.color             = '#94a3b8';
    Chart.defaults.font.family       = "'Inter', sans-serif";
    Chart.defaults.font.size         = 11;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.padding  = 14;
    Chart.defaults.plugins.tooltip.backgroundColor = '#1c2333';
    Chart.defaults.plugins.tooltip.borderColor     = 'rgba(255,255,255,0.08)';
    Chart.defaults.plugins.tooltip.borderWidth     = 1;
    Chart.defaults.plugins.tooltip.padding         = 10;
    Chart.defaults.plugins.tooltip.titleColor      = '#f1f5f9';
    Chart.defaults.plugins.tooltip.bodyColor       = '#94a3b8';
    Chart.defaults.plugins.tooltip.cornerRadius    = 8;
    Chart.defaults.plugins.tooltip.titleFont       = { weight: '600', size: 12 };
  }

  /* ─────────────────────────────────────────────────────
     DESTRUIDOR — garante que o canvas pode ser reutilizado
  ───────────────────────────────────────────────────── */
  function destroyChart(id) {
    if (_instances[id]) {
      _instances[id].destroy();
      delete _instances[id];
    }
  }

  function destroyAll() {
    Object.keys(_instances).forEach(destroyChart);
  }

  /* ─────────────────────────────────────────────────────
     CONSTRUTOR DE GRADIENTE VERTICAL
  ───────────────────────────────────────────────────── */
  function makeGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0,   color1 + 'cc');
    gradient.addColorStop(1,   color2 + '22');
    return gradient;
  }

  /* ─────────────────────────────────────────────────────
     GRÁFICO DE BARRAS
  ───────────────────────────────────────────────────── */
  function renderBar(canvasId, { labels, values, title }, opts = {}) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const backgrounds = values.map((_, i) => {
      const [c1, c2] = GRADIENT_PAIRS[i % GRADIENT_PAIRS.length];
      return makeGradient(ctx, c1, c2);
    });
    const borders = values.map((_, i) => GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][0]);

    const formatValue = opts.format === 'currency'
      ? v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)
      : v => new Intl.NumberFormat('pt-BR').format(v);

    _instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: title,
          data: values,
          backgroundColor: backgrounds,
          borderColor: borders,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${formatValue(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid:   { color: 'rgba(255,255,255,0.04)' },
            ticks:  { maxRotation: 35, font: { size: 10 } }
          },
          y: {
            grid:    { color: 'rgba(255,255,255,0.06)' },
            border:  { dash: [4,4] },
            ticks:   { callback: v => formatValue(v) }
          }
        }
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     GRÁFICO DE LINHA
  ───────────────────────────────────────────────────── */
  function renderLine(canvasId, { labels, values, title }, opts = {}) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const areaGradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    areaGradient.addColorStop(0,   PALETTE.primary + '55');
    areaGradient.addColorStop(1,   PALETTE.primary + '00');

    const formatValue = opts.format === 'currency'
      ? v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)
      : v => new Intl.NumberFormat('pt-BR').format(v);

    _instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: title,
          data: values,
          fill: true,
          backgroundColor: areaGradient,
          borderColor: PALETTE.primary,
          borderWidth: 2,
          pointBackgroundColor: PALETTE.primary,
          pointBorderColor: '#1c2333',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${formatValue(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' } },
          y: {
            grid:   { color: 'rgba(255,255,255,0.06)' },
            border: { dash: [4,4] },
            ticks:  { callback: v => formatValue(v) }
          }
        }
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     GRÁFICO DONUT / PIE
  ───────────────────────────────────────────────────── */
  function renderDonut(canvasId, { labels, values, title }) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    _instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: PALETTE_ARRAY.slice(0, values.length).map(c => c + 'cc'),
          borderColor:     PALETTE_ARRAY.slice(0, values.length),
          borderWidth: 2,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 10,
              padding: 12,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${new Intl.NumberFormat('pt-BR').format(ctx.parsed)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     RENDERIZADOR UNIVERSAL (por tipo)
  ───────────────────────────────────────────────────── */
  function render(canvasId, type, data, opts = {}) {
    switch (type) {
      case 'bar':  return renderBar(canvasId, data, opts);
      case 'line': return renderLine(canvasId, data, opts);
      case 'pie':
      case 'donut':return renderDonut(canvasId, data);
      default:     return renderBar(canvasId, data, opts);
    }
  }

  /* ─────────────────────────────────────────────────────
     INICIALIZAÇÃO
  ───────────────────────────────────────────────────── */
  applyGlobalDefaults();

  return { render, destroyAll, destroyChart };
})();
