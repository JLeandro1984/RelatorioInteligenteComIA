/**
 * report-engine.js
 * ─────────────────────────────────────────────────────────────────
 * Motor de renderização da tela de relatório.
 * Responsabilidade: transformar dados + config + insights em DOM.
 * Totalmente desacoplado da fonte de dados (JSON hoje, API amanhã).
 * ─────────────────────────────────────────────────────────────────
 */

const ReportEngine = (() => {

  const TABLE_PAGE_SIZE_STORAGE_KEY = 'relatorio_table_page_size_v1';

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
        'Vendas':'blue','Logística':'green','Financeiro':'gold','TI':'purple','RH':'orange','Marketing':'cyan',
        // Diretorias
        'ASE':'blue','OBT':'purple','LMV':'cyan','GRI':'green','KAM':'gold',
        // Divisões
        'NACIONAL':'blue','IMPORTADO':'purple','INTERNACIONAL':'orange','GERADOR':'cyan','ÚNICO':'gold'
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

    statusAcao: v => {
      const map = {
        'Pago':                            'green',
        'Comprometido':                    'blue',
        'Cancelado':                       'red',
        'Pagamento Recusado':              'red',
        'Aguardando aprovação da ação':    'orange',
        'Aguardando Liberação de verba':   'orange',
        'Aguardando Acordo':               'orange',
        'Aguardando Comprovação':          'orange'
      };
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

    if (reportKey === 'acoes') {
      rows = (dados.acoes || []).filter(a => {
        const startDate = filtros.dataInicialDe ? new Date(`${filtros.dataInicialDe}T00:00:00`) : null;
        const endDate = filtros.dataFinalAte ? new Date(`${filtros.dataFinalAte}T23:59:59`) : null;
        const cadastroDate = a.dataCadastro ? new Date(`${a.dataCadastro}T12:00:00`) : null;

        if (startDate && cadastroDate && cadastroDate < startDate) return false;
        if (endDate && cadastroDate && cadastroDate > endDate) return false;
        if (filtros.status      && a.status      !== filtros.status)      return false;
        if (filtros.diretoria   && a.diretoria   !== filtros.diretoria)   return false;
        if (filtros.divisao     && a.divisao     !== filtros.divisao)     return false;
        if (filtros.responsavel && a.responsavel !== filtros.responsavel) return false;
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

    const escapeHtml = value => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const renderInlineTable = table => {
      if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) return '';
      const head = table.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('');
      const body = table.rows.map(row => {
        const cells = Array.isArray(row) ? row : [];
        return `<tr>${cells.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`;
      }).join('');
      return (
        `<div class="ai-inline-table-wrap">` +
        `<table class="ai-inline-table">` +
        `<thead><tr>${head}</tr></thead>` +
        `<tbody>${body}</tbody>` +
        `</table>` +
        `</div>`
      );
    };

    const iconMap = { icone: '' };
    container.innerHTML = insights.map((ins, idx) => `
      <div class="insight-card insight-card--${ins.tipo || 'info'}" style="animation-delay:${idx * 60}ms" data-insight-idx="${idx}">
        <button type="button" class="insight-card__expand-btn" aria-label="Expandir insight" title="Clique para expandir">
          <i data-lucide="maximize-2"></i>
        </button>
        <button type="button" class="insight-card__copy-btn" aria-label="Copiar insight" title="Copiar para a área de transferência">
          <i data-lucide="copy"></i>
        </button>
        <div class="insight-card__icon">
          <i data-lucide="${ins.icone || 'lightbulb'}"></i>
        </div>
        <div class="insight-card__body">
          <div class="insight-card__title">${ins.titulo}</div>
          ${ins.scopeLabel ? `<div class="insight-card__scope">Escopo: ${escapeHtml(ins.scopeLabel)}</div>` : ''}
          <div class="insight-card__text">${ins.texto}</div>
          ${renderInlineTable(ins.table)}
          ${ins.valor ? `<div class="insight-card__value">${ins.valor}</div>` : ''}
        </div>
      </div>`).join('');

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    
    // Adicionar event listeners para os botões de copiar
    container.querySelectorAll('.insight-card__copy-btn').forEach((btn, idx) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const card = btn.closest('.insight-card');
        if (!card) return;
        
        const titleEl = card.querySelector('.insight-card__title');
        const textEl = card.querySelector('.insight-card__text');
        const valueEl = card.querySelector('.insight-card__value');
        const table = card.querySelector('.ai-inline-table');
        
        let copyText = '';
        if (titleEl) copyText += titleEl.textContent;
        if (textEl) copyText += '\n' + textEl.textContent;
        if (table) {
          const rows = table.querySelectorAll('tr');
          const tableText = Array.from(rows).map(row => {
            const cells = row.querySelectorAll('th, td');
            return Array.from(cells).map(cell => cell.textContent).join('\t');
          }).join('\n');
          copyText += '\n\n' + tableText;
        }
        if (valueEl) copyText += '\n\n' + valueEl.textContent;
        
        if (copyText.trim()) {
          App._copyToClipboard(copyText.trim(), 'Insight');
        } else {
          App.showToast('Nada para copiar.', 'warning');
        }
      });
    });
    
    section.style.display = 'block';
  }

  /* ─────────────────────────────────────────────────────
     RENDER CHARTS
  ───────────────────────────────────────────────────── */
  function renderCharts(config, chartData) {
    const container = document.getElementById('chartsGrid');
    const section   = document.getElementById('chartsSection');
    const switcher  = document.getElementById('chartTypeSwitcher');
    if (!container || !section) return;

    ChartEngine.destroyAll();

    const entries = Object.entries(chartData);
    if (!entries.length) { section.style.display = 'none'; return; }

    const isCurrencyChart = (title = '') =>
      /receita|valor|faturament|salari/i.test(title);

    const iconMap  = { bar: 'bar-chart-2', line: 'trending-up', pie: 'pie-chart', heatmap: 'grid-2x2' };
    const labelMap = { bar: 'Barras',      line: 'Linha',       pie: 'Pizza',     heatmap: 'Heatmap'   };

    // Popula o switcher de tipo de gráfico
    if (switcher) {
      switcher.innerHTML = entries.map(([type], idx) => `
        <button class="chart-type-btn${idx === 0 ? ' active' : ''}" data-type="${type}" title="${labelMap[type] || type}">
          <i data-lucide="${iconMap[type] || 'bar-chart-2'}"></i>
        </button>`).join('');

      switcher.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          switcher.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('#chartsGrid .chart-wrap').forEach(wrap => {
            wrap.style.display = wrap.dataset.chartType === btn.dataset.type ? '' : 'none';
          });
          ChartEngine.resizeAll();
        });
      });
    }

    container.innerHTML = entries.map(([type, data], idx) => `
      <div class="chart-wrap" data-chart-type="${type}">
        <div class="chart-wrap__title">
          <i data-lucide="${type === 'pie' ? 'pie-chart' : type === 'line' ? 'trending-up' : type === 'heatmap' ? 'grid-2x2' : 'bar-chart-2'}"></i>
          ${data.title}
        </div>
        <div class="chart-canvas-wrap">
          ${type === 'heatmap'
            ? `<div class="heatmap-host" id="chart_${idx}"></div>`
            : `<canvas id="chart_${idx}"></canvas>`
          }
        </div>
      </div>`).join('');

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });

    entries.forEach(([type, data], idx) => {
      const opts = { format: isCurrencyChart(data.title) ? 'currency' : 'number' };
      if (type === 'heatmap') {
        HeatmapEngine.render(`chart_${idx}`, data, opts);
      } else {
        ChartEngine.render(`chart_${idx}`, type, data, opts);
      }
    });

    section.style.display = 'block';
  }

  /* ─────────────────────────────────────────────────────
     RENDER TABLE
  ───────────────────────────────────────────────────── */
  let _currentRows   = [];
  let _currentCols   = [];
  let _filteredRows  = [];
  let _sortCol       = null;
  let _sortDir       = 'asc';
  let _pageSize      = 20;
  let _currentPage   = 1;

  function _loadSavedPageSize() {
    try {
      const raw = localStorage.getItem(TABLE_PAGE_SIZE_STORAGE_KEY);
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return 20;
      if (![10, 20, 50, 100].includes(parsed)) return 20;
      return parsed;
    } catch (_) {
      return 20;
    }
  }

  function _savePageSize(size) {
    try {
      localStorage.setItem(TABLE_PAGE_SIZE_STORAGE_KEY, String(size));
    } catch (_) {
      // localStorage pode estar indisponível; segue sem persistir.
    }
  }

  function renderTable(config, rows) {
    const section  = document.getElementById('tableSection');
    const thead    = document.getElementById('tableHead');
    const tbody    = document.getElementById('tableBody');
    const countEl  = document.getElementById('tableCount');
    const pageSizeEl = document.getElementById('tablePageSize');
    if (!section || !thead || !tbody) return;

    _currentRows = rows;
    _currentCols = config.colunas;
    _currentPage = 1;
    _pageSize = _loadSavedPageSize();
    if (pageSizeEl) {
      pageSizeEl.value = String(_pageSize);
    }

    if (!rows.length) {
      thead.innerHTML = '';
      tbody.innerHTML = `<tr><td colspan="99" class="table-empty">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
      countEl.textContent = '0 registros';
      _renderPagination(0);
      section.style.display = 'block';
      return;
    }

    _buildTableHead(config.colunas);
    _applyTableState(document.getElementById('tableSearch')?.value || '');
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
        _buildTableHead(_currentCols);
        _applyTableState(document.getElementById('tableSearch')?.value || '');
      });
    });
  }

  function _applyTableState(query = '') {
    const countEl = document.getElementById('tableCount');
    const normalized = String(query || '').toLowerCase();

    const filtered = normalized
      ? _currentRows.filter(row =>
          Object.values(row).some(v => String(v).toLowerCase().includes(normalized))
        )
      : [..._currentRows];

    _filteredRows = _sortCol ? _sortRows(filtered, _sortCol, _sortDir) : filtered;

    const total = _filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / _pageSize));
    if (_currentPage > totalPages) _currentPage = totalPages;

    const start = total ? (_currentPage - 1) * _pageSize : 0;
    const end = Math.min(start + _pageSize, total);
    const pageRows = _filteredRows.slice(start, end);

    _buildTableBody(pageRows, _currentCols);

    if (countEl) {
      const filterSuffix = normalized ? ' (filtrado)' : '';
      if (!total) {
        countEl.textContent = `0 registros${filterSuffix}`;
      } else {
        countEl.textContent = `Mostrando ${start + 1}-${end} de ${total} registro${total > 1 ? 's' : ''}${filterSuffix}`;
      }
    }

    _renderPagination(totalPages);
  }

  function _renderPagination(totalPages) {
    const paginationEl = document.getElementById('tablePagination');
    if (!paginationEl) return;

    if (!totalPages || totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    const isFirst = _currentPage <= 1;
    const isLast = _currentPage >= totalPages;
    paginationEl.innerHTML = `
      <button class="table-page-btn" data-page-action="prev" ${isFirst ? 'disabled' : ''}>Anterior</button>
      <span class="table-page-status">Pagina ${_currentPage} de ${totalPages}</span>
      <button class="table-page-btn" data-page-action="next" ${isLast ? 'disabled' : ''}>Proxima</button>
    `;

    paginationEl.querySelector('[data-page-action="prev"]')?.addEventListener('click', () => {
      if (_currentPage <= 1) return;
      _currentPage -= 1;
      _applyTableState(document.getElementById('tableSearch')?.value || '');
    });

    paginationEl.querySelector('[data-page-action="next"]')?.addEventListener('click', () => {
      if (_currentPage >= totalPages) return;
      _currentPage += 1;
      _applyTableState(document.getElementById('tableSearch')?.value || '');
    });
  }

  function _buildTableBody(rows, cols) {
    const tbody = document.getElementById('tableBody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${Math.max(1, cols.length)}" class="table-empty">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
      return;
    }
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
    _currentPage = 1;
    _applyTableState(query);
  }

  function setPageSize(size) {
    const parsed = Number(size);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    _pageSize = parsed;
    _savePageSize(parsed);
    _currentPage = 1;
    _applyTableState(document.getElementById('tableSearch')?.value || '');
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
    filterTable,
    setPageSize
  };
})();
