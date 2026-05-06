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

  const SAVED_SUGGESTIONS_KEY = 'relatorio_saved_questions_v1';

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
    sidebarCollapsed: false,
    chatOpen:      false,
    chatSending:   false,
    chatThreads:   {},
    questionSuggestionText: '',
    questionSuggestSeq: 0,
    savedSuggestions: _loadSavedSuggestions()
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
    aiQuestionSuggestion: () => document.getElementById('aiQuestionSuggestion'),
    aiQuestionSuggestionText: () => document.getElementById('aiQuestionSuggestionText'),
    aiQuestionSuggestionApply: () => document.getElementById('aiQuestionSuggestionApply'),
    aiSuggestions:    () => document.getElementById('aiSuggestions'),
    btnSaveSuggestion:() => document.getElementById('btnSaveSuggestion'),
    btnClearSavedSuggestions:() => document.getElementById('btnClearSavedSuggestions'),
    btnGenerate:      () => document.getElementById('btnGenerate'),
    btnClearFilters:  () => document.getElementById('btnClearFilters'),
    btnExport:        () => document.getElementById('btnExport'),
    btnRefresh:       () => document.getElementById('btnRefresh'),
    loadingState:     () => document.getElementById('loadingState'),
    kpiGrid:          () => document.getElementById('kpiGrid'),
    toast:            () => document.getElementById('toast'),
    floatingChat:     () => document.getElementById('floatingChat'),
    floatingChatToggle: () => document.getElementById('floatingChatToggle'),
    floatingChatClose:  () => document.getElementById('floatingChatClose'),
    floatingChatForm:   () => document.getElementById('floatingChatForm'),
    floatingChatInput:  () => document.getElementById('floatingChatInput'),
    floatingChatSend:   () => document.getElementById('floatingChatSend'),
    floatingChatMessages: () => document.getElementById('floatingChatMessages'),
    floatingChatReport: () => document.getElementById('floatingChatReport'),
    exportModal:       () => document.getElementById('exportModal'),
    exportModalBackdrop: () => document.getElementById('exportModalBackdrop'),
    exportModalClose:  () => document.getElementById('exportModalClose'),
    exportModalCancel: () => document.getElementById('exportModalCancel'),
    exportModalConfirm:() => document.getElementById('exportModalConfirm'),
    exportModalOptions:() => document.getElementById('exportModalOptions')
  };

  function _escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _wantsTableResponse(text) {
    return /\b(tabela|tabular|colunas|compare|comparar|matriz)\b/i.test(text || '');
  }

  function _parseAiResponse(rawText) {
    const text = String(rawText || '').trim();
    const token = '__TABLE_JSON__';
    if (!text.startsWith(token)) return { text, table: null };

    const jsonPart = text.slice(token.length).trim();
    try {
      const obj = JSON.parse(jsonPart);
      const columns = Array.isArray(obj.columns) ? obj.columns : [];
      const rows = Array.isArray(obj.rows) ? obj.rows : [];
      if (!columns.length || !rows.length) return { text, table: null };
      return {
        text: obj.summary || obj.title || 'Tabela gerada com base no contexto do relatório.',
        table: {
          title: obj.title || 'Tabela',
          columns,
          rows
        }
      };
    } catch (_) {
      return { text, table: null };
    }
  }

  function _buildInlineTableHtml(table) {
    if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) return '';
    const head = table.columns.map(c => `<th>${_escapeHtml(c)}</th>`).join('');
    const body = table.rows.map(row => {
      const cells = Array.isArray(row) ? row : [];
      return `<tr>${cells.map(v => `<td>${_escapeHtml(v)}</td>`).join('')}</tr>`;
    }).join('');

    return (
      `<div class="ai-inline-table-wrap">` +
      `<table class="ai-inline-table">` +
      `<thead><tr>${head}</tr></thead>` +
      `<tbody>${body}</tbody>` +
      `</table>` +
      `</div>`
    );
  }

  function hideQuestionSuggestion() {
    const box = el.aiQuestionSuggestion();
    if (box) box.style.display = 'none';
    state.questionSuggestionText = '';
  }

  function showQuestionSuggestion(text) {
    const box = el.aiQuestionSuggestion();
    const txt = el.aiQuestionSuggestionText();
    if (!box || !txt) return;
    txt.textContent = text;
    box.style.display = 'block';
    state.questionSuggestionText = text;
    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }

  function scheduleQuestionSuggestion(rawText) {
    clearTimeout(_questionSuggestDebounce);
    const text = (rawText || '').trim();

    if (!state.activeConfig || text.length < 8) {
      hideQuestionSuggestion();
      return;
    }

    const seq = ++state.questionSuggestSeq;
    _questionSuggestDebounce = setTimeout(async () => {
      try {
        const improved = await GroqService.suggestQuestionRewrite(state.activeConfig.label, text);
        if (seq !== state.questionSuggestSeq) return;
        const suggestion = String(improved || '').trim();
        if (!suggestion || suggestion.toLowerCase() === text.toLowerCase()) {
          hideQuestionSuggestion();
          return;
        }
        showQuestionSuggestion(suggestion);
      } catch (_) {
        if (seq === state.questionSuggestSeq) hideQuestionSuggestion();
      }
    }, 900);
  }

  function _loadSavedSuggestions() {
    try {
      const raw = localStorage.getItem(SAVED_SUGGESTIONS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function _saveSuggestionsState() {
    try {
      localStorage.setItem(SAVED_SUGGESTIONS_KEY, JSON.stringify(state.savedSuggestions || {}));
    } catch (_) {
      // ignore storage failures
    }
  }

  function _getSavedSuggestionsForReport(reportKey) {
    if (!reportKey) return [];
    const suggestions = state.savedSuggestions?.[reportKey];
    return Array.isArray(suggestions) ? suggestions : [];
  }

  function _openExportModal() {
    return new Promise(resolve => {
      const modal = el.exportModal();
      const optionsWrap = el.exportModalOptions();
      const btnConfirm = el.exportModalConfirm();
      const btnClose = el.exportModalClose();
      const btnCancel = el.exportModalCancel();
      const backdrop = el.exportModalBackdrop();
      if (!modal || !optionsWrap || !btnConfirm || !btnClose || !btnCancel || !backdrop) {
        resolve(null);
        return;
      }

      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      let selected = 'pdf';

      const setActive = format => {
        selected = format;
        optionsWrap.querySelectorAll('.export-option').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.exportFormat === format);
        });
      };
      setActive(selected);

      const cleanup = () => {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        optionsWrap.querySelectorAll('.export-option').forEach(btn => btn.removeEventListener('click', onSelect));
        btnConfirm.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
        btnClose.removeEventListener('click', onCancel);
        backdrop.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onEsc);
      };

      const onSelect = e => {
        const btn = e.currentTarget;
        if (!btn?.dataset?.exportFormat) return;
        setActive(btn.dataset.exportFormat);
      };

      const onConfirm = () => {
        cleanup();
        resolve(selected);
      };

      const onCancel = () => {
        cleanup();
        resolve(null);
      };

      const onEsc = e => {
        if (e.key === 'Escape') onCancel();
      };

      optionsWrap.querySelectorAll('.export-option').forEach(btn => btn.addEventListener('click', onSelect));
      btnConfirm.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
      btnClose.addEventListener('click', onCancel);
      backdrop.addEventListener('click', onCancel);
      document.addEventListener('keydown', onEsc);
    });
  }

  function _ensureThread(reportKey) {
    if (!reportKey) return null;
    if (!state.chatThreads[reportKey]) {
      state.chatThreads[reportKey] = [];
    }
    return state.chatThreads[reportKey];
  }

  function _renderChatMessages() {
    const container = el.floatingChatMessages();
    if (!container) return;

    container.innerHTML = '';

    if (!state.activeReport || !state.activeConfig) {
      const hint = document.createElement('div');
      hint.className = 'chat-msg chat-msg--hint';
      hint.textContent = 'Selecione um relatório no menu para conversar com a IA.';
      container.appendChild(hint);
      return;
    }

    const thread = _ensureThread(state.activeReport);
    if (!thread.length) {
      const hint = document.createElement('div');
      hint.className = 'chat-msg chat-msg--assistant';
      hint.textContent = `Contexto ativo: ${state.activeConfig.label}. Faça perguntas apenas sobre este relatório.`;
      container.appendChild(hint);
      return;
    }

    thread.forEach((msg, idx) => {
      const bubble = document.createElement('div');

      if (msg.role === 'error') {
        bubble.className = 'chat-msg chat-msg--error';
        bubble.innerHTML = `
          <div class="chat-msg__text">${_escapeHtml(msg.content)}</div>
          <button class="chat-retry-btn" data-idx="${idx}" title="Tentar novamente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Tentar novamente
          </button>`;
        bubble.querySelector('.chat-retry-btn').addEventListener('click', () => {
          const original = msg.originalText;
          // remove the error message from thread and re-send
          const t = _ensureThread(state.activeReport);
          t.splice(idx, 1);
          el.floatingChatInput().value = original;
          _sendFloatingChatMessage();
        });
      } else if (msg.role === 'assistant' && msg.table) {
        bubble.className = 'chat-msg chat-msg--assistant';
        const text = _escapeHtml(msg.content || '');
        bubble.innerHTML = `${text ? `<div class="chat-msg__text">${text}</div>` : ''}${_buildInlineTableHtml(msg.table)}`;
      } else {
        bubble.className = `chat-msg chat-msg--${msg.role}`;
        bubble.textContent = msg.content;
      }

      container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
  }

  function _syncChatContext() {
    const reportEl = el.floatingChatReport();
    const input    = el.floatingChatInput();
    const sendBtn  = el.floatingChatSend();

    if (reportEl) {
      reportEl.textContent = state.activeConfig
        ? `Relatório: ${state.activeConfig.label}`
        : 'Selecione um relatório';
    }

    const disabled = !state.activeConfig || state.chatSending;
    if (input) {
      input.disabled = disabled;
      input.placeholder = state.activeConfig
        ? 'Pergunte sobre o relatório atual...'
        : 'Selecione um relatório para iniciar o chat';
    }
    if (sendBtn) sendBtn.disabled = disabled;

    _renderChatMessages();
  }

  function _toggleFloatingChat(forceOpen = null) {
    const panel = el.floatingChat();
    if (!panel) return;

    state.chatOpen = forceOpen === null ? !state.chatOpen : !!forceOpen;
    panel.style.display = state.chatOpen ? 'flex' : 'none';
    if (state.chatOpen) {
      _syncChatContext();
      el.floatingChatInput()?.focus();
    }
  }

  async function _sendFloatingChatMessage() {
    if (!state.activeReport || !state.activeConfig || state.chatSending) {
      showToast('Selecione um relatório para iniciar o chat.', 'info');
      return;
    }

    const input = el.floatingChatInput();
    const text  = input?.value?.trim();
    if (!text) return;

    const thread = _ensureThread(state.activeReport);
    thread.push({ role: 'user', content: text });
    input.value = '';

    state.chatSending = true;
    _syncChatContext();

    try {
      const liveFilters = collectFilters(state.activeConfig);
      const kpis = InsightEngine.calcularKPIs(state.activeReport, state.data, liveFilters);
      const aiContext = buildAiReportContext(state.activeReport, state.activeConfig, liveFilters);
      const response = await GroqService.chatAboutReport(
        state.activeReport,
        state.activeConfig.label,
        kpis,
        thread,
        aiContext,
        { requireTable: _wantsTableResponse(text) }
      );
      const parsed = _parseAiResponse(response);
      thread.push({
        role: 'assistant',
        content: parsed.text || 'Não consegui responder no momento.',
        table: parsed.table || null
      });
    } catch (err) {
      thread.push({
        role: 'error',
        content: 'Não consegui consultar a IA agora. Verifique a conexão e tente novamente.',
        originalText: text
      });
      showToast('Erro no chat da IA. Verifique conexão e chave da API.', 'warning');
    } finally {
      state.chatSending = false;
      _syncChatContext();
    }
  }

  function bindFloatingChat() {
    el.floatingChatToggle()?.addEventListener('click', () => {
      _toggleFloatingChat();
    });

    el.floatingChatClose()?.addEventListener('click', () => {
      _toggleFloatingChat(false);
    });

    el.floatingChatForm()?.addEventListener('submit', async e => {
      e.preventDefault();
      await _sendFloatingChatMessage();
    });

    _syncChatContext();
  }

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

  function buildAiReportContext(reportKey, config, filters = {}) {
    if (!config || !state.data) return null;

    const rows = ReportEngine.enriquecerDados(reportKey, state.data, filters);
    const entidade = config.entidade;
    const relacoes = Array.isArray(config.relacoes) ? config.relacoes : [];

    const baseEntityRows = Array.isArray(state.data[entidade])
      ? state.data[entidade].slice(0, 200)
      : [];

    const relatedData = {};
    relacoes.forEach(key => {
      const arr = state.data[key];
      if (Array.isArray(arr)) relatedData[key] = arr.slice(0, 200);
    });

    return {
      reportKey,
      reportLabel: config.label,
      filtrosAplicados: filters,
      entidadePrincipal: entidade,
      registrosDaEntidade: baseEntityRows,
      registrosFiltradosDoRelatorio: rows,
      relacoes: relatedData
    };
  }

  /* ─────────────────────────────────────────────────────
     SUGESTÕES DE PERGUNTAS
  ───────────────────────────────────────────────────── */
  function buildSuggestions(config) {
    const container = el.aiSuggestions();
    if (!container) return;

    const saved = _getSavedSuggestionsForReport(config.key);
    const defaults = Array.isArray(config.perguntasSugeridas) ? config.perguntasSugeridas : [];

    const savedHtml = saved.map(q => `
      <div class="saved-suggestion-item" data-question="${q}">
        <button class="suggestion-chip suggestion-chip--saved suggestion-chip--pick" data-question="${q}" title="Usar sugestão salva">
          <i data-lucide="bookmark"></i> ${q}
        </button>
        <button class="suggestion-chip__remove" data-question="${q}" title="Remover sugestão salva" aria-label="Remover sugestão salva">
          <i data-lucide="x"></i>
        </button>
      </div>`).join('');

    const defaultHtml = defaults.map(q => `
      <button class="suggestion-chip" data-question="${q}">
        <i data-lucide="zap"></i> ${q}
      </button>`).join('');

    container.innerHTML = savedHtml + defaultHtml;

    container.querySelectorAll('.suggestion-chip, .suggestion-chip--pick').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = el.aiQuestion();
        if (input) {
          input.value = chip.dataset.question;
          input.focus();
          toggleClearBtn(input.value);
        }
      });
    });

    container.querySelectorAll('.suggestion-chip__remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        removeSavedSuggestion(btn.dataset.question);
      });
    });

    lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }

  function saveCurrentQuestionSuggestion() {
    if (!state.activeConfig || !state.activeReport) {
      showToast('Selecione um relatório antes de salvar sugestões.', 'info');
      return;
    }

    const text = el.aiQuestion()?.value?.trim();
    if (!text) {
      showToast('Digite uma pergunta antes de salvar.', 'info');
      return;
    }

    const current = _getSavedSuggestionsForReport(state.activeReport);
    const normalized = text.toLowerCase();
    if (current.some(q => String(q).toLowerCase() === normalized)) {
      showToast('Essa sugestão já foi salva.', 'info');
      return;
    }

    if (current.length >= 10) {
      showToast('Limite atingido: até 10 sugestões salvas por relatório.', 'warning');
      return;
    }

    const next = [...current, text];
    state.savedSuggestions[state.activeReport] = next;
    _saveSuggestionsState();
    buildSuggestions(state.activeConfig);
    showToast(`Sugestão salva (${next.length}/10).`, 'success');
  }

  function removeSavedSuggestion(question) {
    if (!state.activeReport || !state.activeConfig || !question) return;
    const current = _getSavedSuggestionsForReport(state.activeReport);
    const next = current.filter(q => q !== question);
    state.savedSuggestions[state.activeReport] = next;
    _saveSuggestionsState();
    buildSuggestions(state.activeConfig);
    showToast('Sugestão removida.', 'success');
  }

  function clearSavedSuggestions() {
    if (!state.activeReport || !state.activeConfig) {
      showToast('Selecione um relatório antes de limpar sugestões.', 'info');
      return;
    }
    const current = _getSavedSuggestionsForReport(state.activeReport);
    if (!current.length) {
      showToast('Não há sugestões salvas para este relatório.', 'info');
      return;
    }

    if (!confirm('Deseja remover todas as sugestões salvas deste relatório?')) return;

    state.savedSuggestions[state.activeReport] = [];
    _saveSuggestionsState();
    buildSuggestions(state.activeConfig);
    showToast('Sugestões salvas removidas.', 'success');
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
    hideQuestionSuggestion();

    // Montar filtros e sugestões
    buildFilters(config);
    buildSuggestions(config);

    // Atualizar contexto do chat para o relatório ativo
    _syncChatContext();

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
    const kpiValues = InsightEngine.calcularKPIs(state.activeReport, state.data, state.filters);
    ReportEngine.renderKPIs(state.activeConfig, kpiValues);

    // Insights IA (análise local determinística)
    const insights = InsightEngine.gerarInsights(state.activeReport, state.data, state.filters, state.question);

    // Groq: substitui o card de pergunta por resposta real da IA
    if (state.question) {
      try {
        const aiContext = buildAiReportContext(state.activeReport, state.activeConfig, state.filters);
        const groqText = await GroqService.chatAboutReport(
          state.activeReport,
          state.activeConfig.label,
          kpiValues,
          [{ role: 'user', content: state.question }],
          aiContext,
          { requireTable: _wantsTableResponse(state.question) }
        );
        const parsed = _parseAiResponse(groqText);
        const groqCard = {
          tipo: 'ai', icone: 'sparkles',
          titulo: 'Análise IA · Groq',
          texto: parsed.text || groqText,
          table: parsed.table || null,
          valor: '',
          _isPerguntaResult: true
        };
        const genericIdx = insights.findIndex(i => i.titulo === 'Análise da Pergunta');
        if (genericIdx >= 0) insights.splice(genericIdx, 1);
        const idx = insights.findIndex(i => i._isPerguntaResult);
        if (idx >= 0) insights[idx] = groqCard;
        else insights.unshift(groqCard);
      } catch (err) {
        showToast('IA Cloud indisponível. Exibindo análise local.', 'warning');
      }
    }

    ReportEngine.renderInsights(insights);

    // Gráficos
    const chartData = InsightEngine.getChartData(state.activeReport, state.data, state.filters);
    ReportEngine.renderCharts(state.activeConfig, chartData);

    // Tabela
    ReportEngine.renderTable(state.activeConfig, rows);

    // Resumo executivo
    const resumo = InsightEngine.gerarResumo(state.activeReport, state.data, state.filters);
    ReportEngine.renderSummary(resumo);

    // Recomendações da IA
    const recs = InsightEngine.gerarRecomendacoes(state.activeReport, state.data, state.filters);
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
    el.aiQuestion()?.addEventListener('input', e => {
      toggleClearBtn(e.target.value);
      scheduleQuestionSuggestion(e.target.value);
    });
    el.aiQuestionClear()?.addEventListener('click', () => {
      el.aiQuestion().value = '';
      toggleClearBtn('');
      hideQuestionSuggestion();
      el.aiQuestion().focus();
    });

    el.aiQuestionSuggestionApply()?.addEventListener('click', () => {
      const input = el.aiQuestion();
      if (!input || !state.questionSuggestionText) return;
      input.value = state.questionSuggestionText;
      toggleClearBtn(input.value);
      hideQuestionSuggestion();
      input.focus();
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

    // Salvar pergunta como sugestão
    el.btnSaveSuggestion()?.addEventListener('click', () => {
      saveCurrentQuestionSuggestion();
    });

    // Limpar sugestões salvas do relatório atual
    el.btnClearSavedSuggestions()?.addEventListener('click', () => {
      clearSavedSuggestions();
    });

    // Refresh
    el.btnRefresh()?.addEventListener('click', async () => {
      el.btnRefresh().classList.add('spinning');
      await loadData();
      el.btnRefresh().classList.remove('spinning');
      if (state.activeReport) generateReport();
      else showToast('Dados atualizados.', 'success');
    });

    // Export
    el.btnExport()?.addEventListener('click', handleExport);

    // Pesquisa na tabela (com debounce de 200ms)
    document.getElementById('tableSearch')?.addEventListener('input', e => {
      const query = e.target.value;
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => ReportEngine.filterTable(query), 200);
    });

    // Reset ordem do menu
    document.getElementById('resetMenuOrder')?.addEventListener('click', () => {
      if (confirm('Deseja resetar a ordem dos relatórios para o padrão?')) {
        DragDropMenu.resetMenuOrder();
      }
    });

    // Enter no campo do chat flutuante
    el.floatingChatInput()?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _sendFloatingChatMessage();
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

  function _buildExportBaseName() {
    const reportName = state.activeConfig?.label || 'relatorio';
    const slug = reportName
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `${slug || 'relatorio'}-${stamp}`;
  }

  function _downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function _getRowsForExport() {
    if (!state.activeReport || !state.activeConfig || !state.data) return [];
    return ReportEngine.enriquecerDados(state.activeReport, state.data, state.filters || {});
  }

  function _toCsv(rows, columns) {
    const escapeCell = value => {
      const raw = value === null || value === undefined ? '' : String(value);
      return `"${raw.replace(/"/g, '""')}"`;
    };

    const header = columns.map(c => escapeCell(c.label)).join(';');
    const lines = rows.map(row => columns.map(c => escapeCell(row[c.campo])).join(';'));
    return [header, ...lines].join('\n');
  }

  function exportCsv() {
    const rows = _getRowsForExport();
    const columns = state.activeConfig?.colunas || [];
    const csv = _toCsv(rows, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    _downloadBlob(blob, `${_buildExportBaseName()}.csv`);
  }

  function exportJson() {
    const rows = _getRowsForExport();
    const payload = {
      reportKey: state.activeReport,
      reportLabel: state.activeConfig?.label,
      filtros: state.filters || {},
      generatedAt: new Date().toISOString(),
      rows
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    _downloadBlob(blob, `${_buildExportBaseName()}.json`);
  }

  async function exportPdfSnapshot() {
    const panel = el.reportPanel();
    if (!panel || panel.style.display === 'none') {
      showToast('Gere um relatório antes de exportar em PDF.', 'info');
      return;
    }

    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      showToast('Dependências de PDF indisponíveis no momento.', 'error');
      return;
    }

    const canvas = await window.html2canvas(panel, {
      backgroundColor: '#0f1117',
      scale: 2,
      useCORS: true,
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const renderWidth = pageWidth - margin * 2;
    const renderHeight = (canvas.height * renderWidth) / canvas.width;

    let heightLeft = renderHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, renderWidth, renderHeight, '', 'FAST');
    heightLeft -= (pageHeight - margin * 2);

    while (heightLeft > 0) {
      position = heightLeft - renderHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, renderWidth, renderHeight, '', 'FAST');
      heightLeft -= (pageHeight - margin * 2);
    }

    pdf.save(`${_buildExportBaseName()}.pdf`);
  }

  async function handleExport() {
    if (!state.activeConfig) {
      showToast('Selecione um relatório antes de exportar.', 'info');
      return;
    }

    const choice = await _openExportModal();
    if (!choice) return;

    try {
      if (choice === 'pdf') {
        await exportPdfSnapshot();
      } else if (choice === 'csv') {
        exportCsv();
      } else if (choice === 'json') {
        exportJson();
      } else {
        showToast('Formato inválido. Use PDF, CSV ou JSON.', 'info');
        return;
      }
      showToast(`Exportação ${choice.toUpperCase()} concluída.`, 'success');
    } catch (_) {
      showToast('Falha ao exportar relatório.', 'error');
    }
  }

  /* ─────────────────────────────────────────────────────
     TOAST NOTIFICATION
  ───────────────────────────────────────────────────── */
  let _toastTimer    = null;
  let _searchDebounce = null;
  let _questionSuggestDebounce = null;
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
      renderTopbarDate();
      bindSidebarToggle();
      bindEvents();
      bindFloatingChat();
      lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    } catch (err) {
      console.error('[App] Initialization failed:', err);
    }
  }

  // Bootstrap
  document.addEventListener('DOMContentLoaded', init);

  return { showToast };
})();
