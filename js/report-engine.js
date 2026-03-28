/**
 * report-engine.js
 * ─────────────────────────────────────────────────────────────────
 * Motor de renderização da tela de relatório.
 * Responsabilidade: transformar dados + config + insights em DOM.
 * Totalmente desacoplado da fonte de dados (JSON hoje, API amanhã).
 * ─────────────────────────────────────────────────────────────────
 */

const ReportEngine = (() => {

  /* ─────────────────────────────────────────────────────
     FORMATADORES
  ───────────────────────────────────────────────────── */
  const fmt = {
    moeda:      v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0),
    numero:     v => new Intl.NumberFormat('pt-BR').format(v || 0),
    percentual: v => `${parseFloat(v || 0).toFixed(1)}%`,
    data:       v => v ? new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') : '—',
    text:       v => v ?? '—'
  };

  /* ─────────────────────────────────────────────────────
     RENDERIZADORES DE CÉLULA POR TIPO
  ───────────────────────────────────────────────────── */
  const cellRenderers = {
    text:        v => `<span>${fmt.text(v)}</span>`,
    moeda:       v => `<span class="fw-600">${fmt.moeda(v)}</span>`,
    numero:      v => `<span>${fmt.numero(v)}</span>`,
    percentual:  v => `<span>${fmt.percentual(v)}</span>`,
    data:        v => `<span>${fmt.data(v)}</span>`,

    badge: v => {
      const colorMap = {
        'Tecnologia':'blue','Distribuição':'purple','Varejo':'orange','Indústria':'cyan',
        'Farmacêutico':'gold','Agronegócio':'green','Construção':'orange','Logística':'gray',
        'Eletrônicos':'blue','Periféricos':'purple','Mobiliário':'gold','Infraestrutura':'cyan',
        'Acessórios':'gray',
        'Vendas':'blue','Logística':'green','Financeiro':'gold','TI':'purple','RH':'orange','Marketing':'cyan'
      };
      const c = colorMap[v] || 'gray';
      return `<span class="badge badge--${c}">${v || '—'}</span>`;
    },

    status: v => {
      const active = v === true || v === 'true';
      return active
        ? `<span class="badge badge--green">Ativo</span>`
        : `<span class="badge badge--red">Inativo</span>`;
    },

    statusPedido: v => {
      const map = {
        'Entregue':    'green',
        'Em Trânsito': 'blue',
        'Processando': 'orange',
        'Aguardando':  'gray',
        'Cancelado':   'red'
      };
      return `<span class="badge badge--${map[v] || 'gray'}">${v || '—'}</span>`;
    },

    statusNF: v => {
      const map = { 'Autorizada': 'green', 'Pendente': 'orange', 'Cancelada': 'red' };
      return `<span class="badge badge--${map[v] || 'gray'}">${v || '—'}</span>`;
    },

    criticidade: v => {
      const map = {
        critico: ['red',   'Estoque Zero'],
        baixo:   ['orange','Abaixo Mínimo'],
        normal:  ['green', 'Normal'],
        alto:    ['blue',  'Acima Máximo']
      };
      const [c, l] = map[v] || ['gray', v];
      return `<span class="badge badge--${c}">${l}</span>`;
    },

    avaliacao: v => {
      const n = parseFloat(v || 0);
      const stars = Math.round(n);
      const filled = '★'.repeat(stars);
      const empty  = '☆'.repeat(5 - stars);
      const color  = n >= 4.5 ? '#eab308' : n >= 3.5 ? '#f59e0b' : '#ef4444';
      return `<span style="color:${color};letter-spacing:1px;font-size:13px;">${filled}${empty}</span> <span style="color:#94a3b8;font-size:11px;">${n.toFixed(1)}</span>`;
    }
  };

  /* ─────────────────────────────────────────────────────
     ENRIQUECEDORES DE DADOS POR RELATÓRIO
  ───────────────────────────────────────────────────── */
  function enriquecerDados(reportKey, dados, filtros) {
    let rows = [];

    if (reportKey === 'clientes') {
      rows = dados.clientes.filter(c => {
        if (filtros.segmento && c.segmento !== filtros.segmento) return false;
        if (filtros.estado   && c.estado   !== filtros.estado)   return false;
        if (filtros.ativo !== undefined && filtros.ativo !== '' &&
            String(c.ativo) !== filtros.ativo) return false;
        return true;
      });
    }

    if (reportKey === 'produtos') {
      const pa = InsightEngine.analisarProdutos(dados);
      rows = pa.filter(p => {
        if (filtros.categoria && p.categoria !== filtros.categoria) return false;
        if (filtros.marca     && p.marca     !== filtros.marca)     return false;
        if (filtros.ativo !== undefined && filtros.ativo !== '' &&
            String(p.ativo) !== filtros.ativo) return false;
        return true;
      });
    }

    if (reportKey === 'estoque') {
      const ea = InsightEngine.analisarEstoque(dados);
      rows = ea.filter(e => {
        if (filtros.deposito    && e.deposito    !== filtros.deposito)    return false;
        if (filtros.criticidade && e.criticidade !== filtros.criticidade) return false;
        return true;
      });
    }

    if (reportKey === 'funcionarios') {
      rows = dados.funcionarios.filter(f => {
        if (filtros.setor  && f.setor  !== filtros.setor)  return false;
        if (filtros.estado && f.estado !== filtros.estado) return false;
        if (filtros.ativo !== undefined && filtros.ativo !== '' &&
            String(f.ativo) !== filtros.ativo) return false;
        return true;
      });
    }

    if (reportKey === 'notasFiscais') {
      const nfs = InsightEngine.analisarNFs(dados);
      rows = nfs.filter(nf => {
        if (filtros.status && nf.status !== filtros.status) return false;
        if (filtros.mes    && !nf.data.startsWith(`2026-${filtros.mes}`)) return false;
        return true;
      });
    }

    if (reportKey === 'vendas') {
      const va = InsightEngine.analisarVendas(dados);
      rows = va.pedidosEnriquecidos
        .map(p => ({ ...p, itensCount: p.itens.length }))
        .filter(p => {
          if (filtros.status && p.status !== filtros.status) return false;
          if (filtros.mes    && !p.data.startsWith(`2026-${filtros.mes}`)) return false;
          return true;
        });
    }

    return rows;
  }

  /* ─────────────────────────────────────────────────────
     RENDER KPIs
  ───────────────────────────────────────────────────── */
  function renderKPIs(config, kpiValues) {
    const container = document.getElementById('kpiGrid');
    if (!container) return;

    const kpiFormatters = {
      moeda:   v => typeof v === 'number' ? fmt.moeda(v) : v,
      numero:  v => typeof v === 'number' ? fmt.numero(v) : v,
      default: v => typeof v === 'number' && v > 9999 ? fmt.moeda(v) : (typeof v === 'number' ? fmt.numero(v) : v)
    };

    const trendIcon = trend => trend === 'up'
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;

    container.innerHTML = config.kpis.map((kpi, idx) => {
      const raw    = kpiValues[kpi.key];
      const isMonetary = ['receitaTotal','receitaProdutos','valorEstoque','massaSalarial','valorTotalNFs','totalImpostos','ticketMedio'].includes(kpi.key);
      const value  = isMonetary ? fmt.moeda(raw) : (typeof raw === 'number' ? fmt.numero(raw) : (raw ?? '—'));
      const delay  = idx * 60;

      return `
        <div class="kpi-card kpi-card--${kpi.cor}" style="animation-delay:${delay}ms">
          <div class="kpi-card__header">
            <span class="kpi-card__label">${kpi.label}</span>
            <div class="kpi-card__icon">
              <i data-lucide="${kpi.icon}"></i>
            </div>
          </div>
          <div class="kpi-card__value">${value}</div>
          <div class="kpi-card__footer">
            <span class="kpi-card__trend-label">Período atual</span>
          </div>
        </div>`;
    }).join('');

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    container.style.display = 'grid';
  }

  /* ─────────────────────────────────────────────────────
     RENDER INSIGHTS
  ───────────────────────────────────────────────────── */
  function renderInsights(insights) {
    const container = document.getElementById('insightsGrid');
    const section   = document.getElementById('insightsSection');
    const badge     = document.getElementById('insightsBadge');
    if (!container || !section) return;

    if (!insights.length) { section.style.display = 'none'; return; }

    badge.textContent = `${insights.length} insight${insights.length > 1 ? 's' : ''}`;

    const iconMap = { icone: '' };
    container.innerHTML = insights.map((ins, idx) => `
      <div class="insight-card insight-card--${ins.tipo || 'info'}" style="animation-delay:${idx * 60}ms">
        <div class="insight-card__icon">
          <i data-lucide="${ins.icone || 'lightbulb'}"></i>
        </div>
        <div class="insight-card__body">
          <div class="insight-card__title">${ins.titulo}</div>
          <div class="insight-card__text">${ins.texto}</div>
          ${ins.valor ? `<div class="insight-card__value">${ins.valor}</div>` : ''}
        </div>
      </div>`).join('');

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    section.style.display = 'block';
  }

  /* ─────────────────────────────────────────────────────
     RENDER CHARTS
  ───────────────────────────────────────────────────── */
  function renderCharts(config, chartData) {
    const container = document.getElementById('chartsGrid');
    const section   = document.getElementById('chartsSection');
    if (!container || !section) return;

    ChartEngine.destroyAll();

    const entries = Object.entries(chartData);
    if (!entries.length) { section.style.display = 'none'; return; }

    const isCurrencyChart = (title = '') =>
      /receita|valor|faturament|salari/i.test(title);

    container.innerHTML = entries.map(([type, data], idx) => `
      <div class="chart-wrap">
        <div class="chart-wrap__title">
          <i data-lucide="${type === 'pie' ? 'pie-chart' : type === 'line' ? 'trending-up' : 'bar-chart-2'}"></i>
          ${data.title}
        </div>
        <div class="chart-canvas-wrap">
          <canvas id="chart_${idx}"></canvas>
        </div>
      </div>`).join('');

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });

    entries.forEach(([type, data], idx) => {
      const opts = { format: isCurrencyChart(data.title) ? 'currency' : 'number' };
      ChartEngine.render(`chart_${idx}`, type, data, opts);
    });

    section.style.display = 'block';
  }

  /* ─────────────────────────────────────────────────────
     RENDER TABLE
  ───────────────────────────────────────────────────── */
  let _currentRows   = [];
  let _currentCols   = [];
  let _sortCol       = null;
  let _sortDir       = 'asc';

  function renderTable(config, rows) {
    const section  = document.getElementById('tableSection');
    const thead    = document.getElementById('tableHead');
    const tbody    = document.getElementById('tableBody');
    const countEl  = document.getElementById('tableCount');
    if (!section || !thead || !tbody) return;

    _currentRows = rows;
    _currentCols = config.colunas;

    if (!rows.length) {
      thead.innerHTML = '';
      tbody.innerHTML = `<tr><td colspan="99" class="table-empty">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
      countEl.textContent = '0 registros';
      section.style.display = 'block';
      return;
    }

    countEl.textContent = `${rows.length} registro${rows.length > 1 ? 's' : ''}`;
    _buildTableHead(config.colunas);
    _buildTableBody(rows, config.colunas);
    section.style.display = 'block';
  }

  function _buildTableHead(cols) {
    const thead = document.getElementById('tableHead');
    thead.innerHTML = `<tr>${cols.map(c =>
      `<th data-col="${c.campo}">
        ${c.label}
        <span class="sort-icon">${_sortCol === c.campo ? (_sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </th>`
    ).join('')}</tr>`;

    thead.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        _sortDir  = (_sortCol === col && _sortDir === 'asc') ? 'desc' : 'asc';
        _sortCol  = col;
        const sorted = _sortRows(_currentRows, col, _sortDir);
        _buildTableHead(_currentCols);
        _buildTableBody(sorted, _currentCols);
      });
    });
  }

  function _buildTableBody(rows, cols) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = rows.map(row => `
      <tr>${cols.map(col => {
        const raw      = row[col.campo];
        const renderer = cellRenderers[col.tipo] || cellRenderers.text;
        return `<td>${renderer(raw)}</td>`;
      }).join('')}</tr>`).join('');
  }

  function _sortRows(rows, col, dir) {
    return [...rows].sort((a, b) => {
      const av = a[col], bv = b[col];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  function filterTable(query) {
    if (!_currentRows.length) return;
    const q = query.toLowerCase();
    const filtered = q
      ? _currentRows.filter(row =>
          Object.values(row).some(v => String(v).toLowerCase().includes(q))
        )
      : _currentRows;
    document.getElementById('tableCount').textContent =
      `${filtered.length} registro${filtered.length > 1 ? 's' : ''} (filtrado)`;
    _buildTableBody(filtered, _currentCols);
  }

  /* ─────────────────────────────────────────────────────
     RENDER RESUMO EXECUTIVO
  ───────────────────────────────────────────────────── */
  function renderSummary(paragraphs) {
    const container = document.getElementById('summaryBody');
    const section   = document.getElementById('summaryRow');
    if (!container || !section) return;

    container.innerHTML = paragraphs.map((p, i) =>
      `<p class="summary-paragraph" style="animation-delay:${i * 80}ms">${p}</p>`
    ).join('');
    section.style.display = 'grid';
  }

  /* ─────────────────────────────────────────────────────
     RENDER RECOMENDAÇÕES
  ───────────────────────────────────────────────────── */
  function renderRecommendations(recs) {
    const container = document.getElementById('recommendationsList');
    if (!container) return;

    container.innerHTML = recs.map((rec, i) => `
      <li class="recommendation-item" style="animation-delay:${i * 80}ms">
        <div class="recommendation-item__icon">
          <i data-lucide="lightbulb"></i>
        </div>
        <p class="recommendation-item__text">${rec}</p>
      </li>`).join('');

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }

  /* ─────────────────────────────────────────────────────
     RENDER HEADER DO RELATÓRIO
  ───────────────────────────────────────────────────── */
  function renderHeader(config, rowCount) {
    const iconEl   = document.getElementById('reportHeaderIcon');
    const titleEl  = document.getElementById('reportHeaderTitle');
    const subEl    = document.getElementById('reportHeaderSubtitle');
    const badgeEl  = document.getElementById('reportHeaderBadge');

    const colorMap = {
      blue: '#4f8ef7', purple: '#7c5cbf', orange: '#f97316',
      cyan: '#06b6d4', green: '#22c55e', gold: '#eab308'
    };

    iconEl.innerHTML   = `<i data-lucide="${config.icon}"></i>`;
    iconEl.style.background = colorMap[config.color]
      ? colorMap[config.color] + '22'
      : 'var(--color-primary-dim)';
    iconEl.querySelector('i').style.color = colorMap[config.color] || 'var(--color-primary)';

    titleEl.textContent = config.label;
    subEl.textContent   = config.subtitle;
    badgeEl.textContent = `${rowCount} registro${rowCount !== 1 ? 's' : ''}`;

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }

  /* ─────────────────────────────────────────────────────
     API PÚBLICA
  ───────────────────────────────────────────────────── */
  return {
    renderKPIs,
    renderInsights,
    renderCharts,
    renderTable,
    renderSummary,
    renderRecommendations,
    renderHeader,
    enriquecerDados,
    filterTable
  };
})();
