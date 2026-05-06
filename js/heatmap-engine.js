/**
 * heatmap-engine.js
 * ─────────────────────────────────────────────────────────────────
 * Renderizador de heatmap em HTML/CSS com seletor de métrica.
 * Estrutura pensada para seguir o visual de grade analítica.
 * ─────────────────────────────────────────────────────────────────
 */

const HeatmapEngine = (() => {

  function _formatValue(value, format) {
    if (format === 'currency') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact'
      }).format(value || 0);
    }
    if (format === 'percent') {
      return `${Number(value || 0).toFixed(1)}%`;
    }
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  }

  function _cellColor(value, min, max) {
    const range = max - min;
    const ratio = range <= 0 ? 0.55 : Math.max(0, Math.min(1, (value - min) / range));

    const start = { r: 210, g: 225, b: 243 };
    const end   = { r: 46,  g: 117, b: 201 };
    const mix = {
      r: Math.round(start.r + (end.r - start.r) * ratio),
      g: Math.round(start.g + (end.g - start.g) * ratio),
      b: Math.round(start.b + (end.b - start.b) * ratio)
    };

    return {
      bg: `rgb(${mix.r}, ${mix.g}, ${mix.b})`,
      fg: ratio > 0.62 ? '#eaf2ff' : '#1e4d83'
    };
  }

  function _metricByKey(metrics, key) {
    return (metrics || []).find(m => m.key === key) || (metrics || [])[0] || null;
  }

  function _sum(values) {
    return values.reduce((s, v) => s + (Number(v) || 0), 0);
  }

  function _avg(values) {
    return values.length ? (_sum(values) / values.length) : 0;
  }

  function _maxInfo(matrix, rows, cols) {
    let max = Number.NEGATIVE_INFINITY;
    let maxRow = rows?.[0] || '—';
    let maxCol = cols?.[0] || '—';

    (matrix || []).forEach((line, rIdx) => {
      (line || []).forEach((v, cIdx) => {
        const num = Number(v) || 0;
        if (num > max) {
          max = num;
          maxRow = rows?.[rIdx] || '—';
          maxCol = cols?.[cIdx] || '—';
        }
      });
    });

    return { max: Number.isFinite(max) ? max : 0, maxRow, maxCol };
  }

  function _defaultKpis(metric, matrix, rowLabels, colLabels) {
    const flat = (matrix || []).flat().map(v => Number(v) || 0);
    const { max, maxRow } = _maxInfo(matrix, rowLabels, colLabels);
    const format = metric?.format || 'number';

    return [
      {
        label: metric?.kpiLabels?.[0] || 'Total',
        value: _formatValue(_sum(flat), format)
      },
      {
        label: metric?.kpiLabels?.[1] || 'Média',
        value: _formatValue(_avg(flat), format)
      },
      {
        label: metric?.kpiLabels?.[2] || 'Maior ponto',
        value: _formatValue(max, format)
      },
      {
        label: metric?.kpiLabels?.[3] || 'Linha de destaque',
        value: maxRow
      }
    ];
  }

  function render(containerId, payload) {
    const root = document.getElementById(containerId);
    if (!root) return;

    const rowLabels = payload?.rows || [];
    const colLabels = payload?.cols || [];
    const metrics = payload?.metrics || [];
    const matrixByMetric = payload?.matrix || {};

    if (!metrics.length || !rowLabels.length || !colLabels.length) {
      root.innerHTML = '<div class="heatmap-empty">Sem dados para gerar heatmap.</div>';
      return;
    }

    const defaultMetric = payload.defaultMetric || metrics[0].key;

    root.innerHTML = `
      <div class="heatmap-card">
        <h4 class="heatmap-card__title">${payload.title || 'Heatmap'}</h4>

        <div class="heatmap-metric">
          <label class="heatmap-metric__label" for="${containerId}_metric">Métrica:</label>
          <select id="${containerId}_metric" class="heatmap-metric__select">
            ${metrics.map(m => `<option value="${m.key}">${m.label}</option>`).join('')}
          </select>
        </div>

        <div class="heatmap-kpis" id="${containerId}_kpis"></div>

        <div class="heatmap-scale">
          <span>Menor</span>
          <div class="heatmap-scale__bar"></div>
          <span>Maior</span>
        </div>

        <div class="heatmap-table-wrap">
          <table class="heatmap-table">
            <thead id="${containerId}_thead"></thead>
            <tbody id="${containerId}_tbody"></tbody>
          </table>
        </div>
      </div>`;

    const metricSelect = document.getElementById(`${containerId}_metric`);
    const thead = document.getElementById(`${containerId}_thead`);
    const tbody = document.getElementById(`${containerId}_tbody`);
    const kpiWrap = document.getElementById(`${containerId}_kpis`);

    function draw(metricKey) {
      const metric = _metricByKey(metrics, metricKey);
      const matrix = matrixByMetric[metric?.key] || [];
      const flat = matrix.flat().map(v => Number(v) || 0);
      const min = flat.length ? Math.min(...flat) : 0;
      const max = flat.length ? Math.max(...flat) : 1;

      const kpis = (payload.kpis && payload.kpis[metric.key])
        ? payload.kpis[metric.key]
        : _defaultKpis(metric, matrix, rowLabels, colLabels);

      kpiWrap.innerHTML = kpis.map(item => `
        <div class="heatmap-kpi">
          <span class="heatmap-kpi__label">${item.label}</span>
          <strong class="heatmap-kpi__value">${item.value}</strong>
        </div>`).join('');

      thead.innerHTML = `
        <tr>
          <th>${payload.rowTitle || 'Linha'}</th>
          ${colLabels.map(col => `<th>${col}</th>`).join('')}
        </tr>`;

      tbody.innerHTML = rowLabels.map((row, rIdx) => {
        const cells = (matrix[rIdx] || []).map(v => {
          const numeric = Number(v) || 0;
          const color = _cellColor(numeric, min, max);
          return `
            <td>
              <div class="heatmap-cell" style="background:${color.bg};color:${color.fg};">
                ${_formatValue(numeric, metric?.format || 'number')}
              </div>
            </td>`;
        }).join('');

        return `<tr><th>${row}</th>${cells}</tr>`;
      }).join('');
    }

    metricSelect.value = defaultMetric;
    metricSelect.addEventListener('change', () => draw(metricSelect.value));
    draw(defaultMetric);
  }

  return { render };
})();
