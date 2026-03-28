/**
 * app.js
 * ─────────────────────────────────────────────────────────────────
 * Orquestrador principal da aplicação.
 * Responsabilidades:
 *   - Carregar dados do JSON
 *   - Gerenciar estado ativo da aplicação
 *   - Construir filtros dinâmicos por configuração
 *   - Coordenar fluxo: filtros → dados → engine → render
 *   - Controlar UI (sidebar, topbar, loading, toast)
 * ─────────────────────────────────────────────────────────────────
 */

const App = (() => {

  /* ─────────────────────────────────────────────────────
     ESTADO DA APLICAÇÃO
  ───────────────────────────────────────────────────── */
  const state = {
    data:          null,       // dados brutos do JSON
    activeReport:  null,       // key do relatório ativo
    activeConfig:  null,       // config do relatório ativo
    filters:       {},         // filtros ativos
    question:      '',         // pergunta IA
    isLoading:     false,
    sidebarCollapsed: false
  };

  /* ─────────────────────────────────────────────────────
     REFS DE ELEMENTOS DOM
  ───────────────────────────────────────────────────── */
  const el = {
    sidebar:          () => document.getElementById('sidebar'),
    sidebarMenu:      () => document.getElementById('sidebarMenu'),
    sidebarToggle:    () => document.getElementById('sidebarToggle'),
    topbarDate:       () => document.getElementById('topbarDate'),
    breadcrumbCurrent:() => document.getElementById('breadcrumbCurrent'),
    welcomeState:     () => document.getElementById('welcomeState'),
    reportPanel:      () => document.getElementById('reportPanel'),
    filterGrid:       () => document.getElementById('filterGrid'),
    aiQuestion:       () => document.getElementById('aiQuestion'),
    aiQuestionClear:  () => document.getElementById('aiQuestionClear'),
    aiSuggestions:    () => document.getElementById('aiSuggestions'),
    btnGenerate:      () => document.getElementById('btnGenerate'),
    btnClearFilters:  () => document.getElementById('btnClearFilters'),
    btnExport:        () => document.getElementById('btnExport'),
    btnRefresh:       () => document.getElementById('btnRefresh'),
    loadingState:     () => document.getElementById('loadingState'),
    kpiGrid:          () => document.getElementById('kpiGrid'),
    toast:            () => document.getElementById('toast')
  };

  /* ─────────────────────────────────────────────────────
     CARREGAMENTO DE DADOS
  ───────────────────────────────────────────────────── */
  async function loadData() {
    try {
      const res = await fetch('data/report-data.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
    } catch (err) {
      showToast('Erro ao carregar dados. Verifique o arquivo report-data.json.', 'error');
      throw err;
    }
  }

  /* ─────────────────────────────────────────────────────
     SIDEBAR — MENU
  ───────────────────────────────────────────────────── */
  function buildSidebarMenu() {
    const menu = el.sidebarMenu();
    if (!menu) return;

    menu.innerHTML = REPORT_CONFIGS.map(cfg => `
      <li class="menu-item" data-report="${cfg.key}">
        <i data-lucide="${cfg.icon}"></i>
        <span class="menu-item__label">${cfg.label}</span>
      </li>`).join('');

    menu.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => selectReport(item.dataset.report));
    });

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });

    // Reinicializar drag-and-drop após construir o menu
    if (DragDropMenu && typeof DragDropMenu.init === 'function') {
      DragDropMenu.init('#sidebarMenu');
      console.log('[DragDrop] Menu reinicializado');
    }
  }

  function setActiveMenuItem(key) {
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.report === key);
    });
  }

  /* ─────────────────────────────────────────────────────
     TOPBAR — DATA
  ───────────────────────────────────────────────────── */
  function renderTopbarDate() {
    const dateEl = el.topbarDate();
    if (!dateEl) return;
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  /* ─────────────────────────────────────────────────────
     SIDEBAR TOGGLE
  ───────────────────────────────────────────────────── */
  function bindSidebarToggle() {
    const btn = el.sidebarToggle();
    if (!btn) return;

    btn.addEventListener('click', () => {
      const isMobile = window.innerWidth <= 768;
      const sidebar  = el.sidebar();

      if (isMobile) {
        sidebar.classList.toggle('mobile-open');
      } else {
        state.sidebarCollapsed = !state.sidebarCollapsed;
        sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     CONSTRUÇÃO DE FILTROS DINÂMICOS
  ───────────────────────────────────────────────────── */
  function buildFilters(config) {
    const grid = el.filterGrid();
    if (!grid) return;

    grid.innerHTML = config.filtros.map(f => {
      const optionsHtml = buildFilterOptions(f);
      return `
        <div class="filter-group">
          <label for="filter_${f.campo}">${f.label}</label>
          ${f.tipo === 'select'
            ? `<select id="filter_${f.campo}" name="${f.campo}">${optionsHtml}</select>`
            : `<input type="${f.tipo === 'date' ? 'date' : 'text'}" id="filter_${f.campo}" name="${f.campo}" placeholder="${f.label}" />`
          }
        </div>`;
    }).join('');

    // Listeners de change
    grid.querySelectorAll('select, input').forEach(input => {
      input.addEventListener('change', () => { /* filtros lazy: aplicados no clique */ });
    });
  }

  function buildFilterOptions(filtro) {
    // Opções dinâmicas a partir do JSON
    if (filtro.opcoesDe) {
      const [entidade, campo] = filtro.opcoesDe.split('.');
      const rawValues = (state.data[entidade] || []).map(item => item[campo]).filter(Boolean);
      const unique    = [...new Set(rawValues)].sort();
      return `<option value="">Todos</option>` +
             unique.map(v => `<option value="${v}">${v}</option>`).join('');
    }
    // Opções estáticas definidas na config
    if (filtro.opcoes) {
      return filtro.opcoes.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    }
    return `<option value="">Todos</option>`;
  }

  function collectFilters(config) {
    const filters = {};
    config.filtros.forEach(f => {
      const input = document.getElementById(`filter_${f.campo}`);
      if (input && input.value !== '') filters[f.campo] = input.value;
    });
    return filters;
  }

  /* ─────────────────────────────────────────────────────
     SUGESTÕES DE PERGUNTAS
  ───────────────────────────────────────────────────── */
  function buildSuggestions(config) {
    const container = el.aiSuggestions();
    if (!container) return;

    container.innerHTML = config.perguntasSugeridas.map(q => `
      <button class="suggestion-chip" data-question="${q}">
        <i data-lucide="zap"></i> ${q}
      </button>`).join('');

    container.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = el.aiQuestion();
        if (input) {
          input.value = chip.dataset.question;
          input.focus();
          toggleClearBtn(input.value);
        }
      });
    });

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }

  /* ─────────────────────────────────────────────────────
     SELEÇÃO DE RELATÓRIO
  ───────────────────────────────────────────────────── */
  function selectReport(key) {
    const config = REPORT_CONFIG_MAP[key];
    if (!config) return;

    state.activeReport  = key;
    state.activeConfig  = config;
    state.filters       = {};
    state.question      = '';

    // UI switches
    el.welcomeState().style.display = 'none';
    el.reportPanel().style.display  = 'flex';
    el.reportPanel().style.flexDirection = 'column';
    el.reportPanel().style.gap      = '20px';

    setActiveMenuItem(key);
    el.breadcrumbCurrent().textContent = config.label;
    el.btnExport().disabled = false;

    // Limpar pergunta
    const qi = el.aiQuestion();
    if (qi) { qi.value = ''; toggleClearBtn(''); }

    // Montar filtros e sugestões
    buildFilters(config);
    buildSuggestions(config);

    // Ocultar seções até gerar
    hideResultSections();
  }

  function hideResultSections() {
    ['kpiGrid','insightsSection','chartsSection','tableSection','summaryRow'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    el.loadingState().style.display = 'none';
  }

  /* ─────────────────────────────────────────────────────
     GERAÇÃO DO RELATÓRIO
  ───────────────────────────────────────────────────── */
  async function generateReport() {
    if (!state.activeConfig || state.isLoading) return;

    state.isLoading = true;
    state.filters   = collectFilters(state.activeConfig);
    state.question  = el.aiQuestion()?.value?.trim() || '';

    // Atualizar header
    const rows = ReportEngine.enriquecerDados(state.activeReport, state.data, state.filters);
    ReportEngine.renderHeader(state.activeConfig, rows.length);

    // Loading animation
    el.loadingState().style.display = 'flex';
    hideResultSections();

    // Simula latência de análise (UX premium)
    await delay(900);

    el.loadingState().style.display = 'none';

    // KPIs
    const kpiValues = InsightEngine.calcularKPIs(state.activeReport, state.data);
    ReportEngine.renderKPIs(state.activeConfig, kpiValues);

    // Insights IA
    const insights = InsightEngine.gerarInsights(state.activeReport, state.data, state.filters, state.question);
    ReportEngine.renderInsights(insights);

    // Gráficos
    const chartData = InsightEngine.getChartData(state.activeReport, state.data);
    ReportEngine.renderCharts(state.activeConfig, chartData);

    // Tabela
    ReportEngine.renderTable(state.activeConfig, rows);

    // Resumo executivo
    const resumo = InsightEngine.gerarResumo(state.activeReport, state.data);
    ReportEngine.renderSummary(resumo);

    // Recomendações da IA
    const recs = InsightEngine.gerarRecomendacoes(state.activeReport, state.data);
    ReportEngine.renderRecommendations(recs);

    state.isLoading = false;
    showToast(`Relatório de ${state.activeConfig.label} gerado com sucesso!`, 'success');

    // Re-init lucide em todo o documento
    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }

  /* ─────────────────────────────────────────────────────
     EVENTOS GERAIS
  ───────────────────────────────────────────────────── */
  function bindEvents() {
    // Gerar relatório
    el.btnGenerate()?.addEventListener('click', generateReport);

    // Enter na pergunta
    el.aiQuestion()?.addEventListener('keydown', e => {
      if (e.key === 'Enter') generateReport();
    });

    // Botão limpar pergunta
    el.aiQuestion()?.addEventListener('input', e => toggleClearBtn(e.target.value));
    el.aiQuestionClear()?.addEventListener('click', () => {
      el.aiQuestion().value = '';
      toggleClearBtn('');
      el.aiQuestion().focus();
    });

    // Limpar filtros
    el.btnClearFilters()?.addEventListener('click', () => {
      const config = state.activeConfig;
      if (!config) return;
      config.filtros.forEach(f => {
        const input = document.getElementById(`filter_${f.campo}`);
        if (input) input.value = '';
      });
      el.aiQuestion().value = '';
      toggleClearBtn('');
      showToast('Filtros limpos.', 'info');
    });

    // Refresh
    el.btnRefresh()?.addEventListener('click', async () => {
      el.btnRefresh().classList.add('spinning');
      await loadData();
      el.btnRefresh().classList.remove('spinning');
      if (state.activeReport) generateReport();
      else showToast('Dados atualizados.', 'success');
    });

    // Export (simulado)
    el.btnExport()?.addEventListener('click', () => {
      showToast('Exportação disponível na versão com backend integrado.', 'info');
    });

    // Pesquisa na tabela
    document.getElementById('tableSearch')?.addEventListener('input', e => {
      ReportEngine.filterTable(e.target.value);
    });

    // Reset ordem do menu
    document.getElementById('resetMenuOrder')?.addEventListener('click', () => {
      if (confirm('Deseja resetar a ordem dos relatórios para o padrão?')) {
        DragDropMenu.resetMenuOrder();
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     UTILITÁRIOS
  ───────────────────────────────────────────────────── */
  function toggleClearBtn(value) {
    const btn = el.aiQuestionClear();
    if (btn) btn.classList.toggle('visible', value.length > 0);
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ─────────────────────────────────────────────────────
     TOAST NOTIFICATION
  ───────────────────────────────────────────────────── */
  let _toastTimer = null;
  function showToast(message, type = 'info') {
    const toast = el.toast();
    if (!toast) return;

    toast.textContent = message;
    toast.className   = `toast toast--${type} show`;

    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  /* ─────────────────────────────────────────────────────
     INICIALIZAÇÃO
  ───────────────────────────────────────────────────── */
  async function init() {
    try {
      await loadData();
      buildSidebarMenu();
      DragDropMenu.init('#sidebarMenu');
      renderTopbarDate();
      bindSidebarToggle();
      bindEvents();
      lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    } catch (err) {
      console.error('[App] Initialization failed:', err);
    }
  }

  // Bootstrap
  document.addEventListener('DOMContentLoaded', init);

  return { showToast };
})();
