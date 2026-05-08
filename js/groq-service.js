/**
 * groq-service.js
 * ─────────────────────────────────────────────────────────────────
 * Serviço frontend que chama o proxy /api/groq no servidor Node.
 * A API key NUNCA transita pelo browser — fica protegida no .env.
 * ─────────────────────────────────────────────────────────────────
 */

const GroqService = (() => {

  const ENDPOINTS = (() => {
    const list = ['/api/groq'];
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      list.push('http://localhost:8000/api/groq');
      list.push('http://127.0.0.1:8000/api/groq');
    }
    return Array.from(new Set(list));
  })();

  const SYSTEM_PROMPT =
    'Você é um analista de BI sênior. Analise os dados fornecidos e responda ' +
    'perguntas de forma objetiva e direta, em português brasileiro. ' +
    'Seja conciso, cite números específicos quando presentes nos dados. ' +
    'Não invente informações que não estejam nos KPIs fornecidos. ' +
    'Responda em até 2 parágrafos curtos. ' +
    'Se a pergunta pedir para listar itens (ex: "liste", "mostre", "quais"), responda em bullet points, uma linha por item, começando com "- ".';

  /* ─────────────────────────────────────────────────────
     CONSTRUÇÃO DO PROMPT
  ───────────────────────────────────────────────────── */
  function _buildUserMessage(reportKey, kpis, question) {
    const kpiLines = Object.entries(kpis)
      .map(([k, v]) => {
        const display = typeof v === 'number'
          ? v.toLocaleString('pt-BR')
          : String(v);
        return `  - ${k}: ${display}`;
      })
      .join('\n');

    return (
      `Contexto: relatório de "${reportKey}"\n\n` +
      `KPIs disponíveis:\n${kpiLines}\n\n` +
      `Pergunta: ${question}`
    );
  }

  function _safeSerializeContext(contextData, maxChars = 12000) {
    if (!contextData) return 'Sem contexto adicional.';

    let json = '';
    try {
      json = JSON.stringify(contextData);
    } catch (_) {
      return 'Falha ao serializar contexto.';
    }

    if (json.length <= maxChars) return json;
    return json.slice(0, maxChars) +
      '\n...[contexto truncado para caber no limite de mensagem]';
  }

  function _buildKpiBlock(kpis) {
    const entries = Object.entries(kpis || {});
    if (!entries.length) return '- Sem KPIs carregados no momento';
    return entries
      .map(([k, v]) => {
        const display = typeof v === 'number'
          ? v.toLocaleString('pt-BR')
          : String(v);
        return `- ${k}: ${display}`;
      })
      .join('\n');
  }

  async function _postMessages(messages) {
    let lastError = null;

    for (const endpoint of ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.content;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Falha ao consultar endpoint da IA.');
  }

  /* ─────────────────────────────────────────────────────
     API PÚBLICA
  ───────────────────────────────────────────────────── */

  /**
   * Envia uma pergunta ao Groq via proxy seguro.
   * @param {string} reportKey  - chave do relatório ativo
   * @param {object} kpis       - objeto com KPIs já calculados
   * @param {string} question   - pergunta do usuário
   * @returns {Promise<string>} - resposta em texto
   */
  async function askQuestion(reportKey, kpis, question, contextData = null, options = {}) {
    if (!question || !question.trim()) {
      throw new Error('Pergunta vazia.');
    }

    const contextBlock = _safeSerializeContext(contextData);
    const filtrosInfo = contextData && contextData.filtrosAplicados && Object.keys(contextData.filtrosAplicados).length
      ? `\n\nFiltros aplicados no relatório:\n${Object.entries(contextData.filtrosAplicados).map(([k,v]) => `  - ${k}: ${v}`).join('\n')}`
      : '';

    const userMessage =
      _buildUserMessage(reportKey, kpis, question) +
      `\n\nDados JSON do relatório selecionado (use este contexto para responder com precisão):${filtrosInfo}\n` +
      contextBlock;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    if (options.requireTable) {
      messages.push({
        role: 'system',
        content:
          'Retorne EXCLUSIVAMENTE no formato: __TABLE_JSON__{"title":"...","summary":"...","columns":["..."],"rows":[["..."]]} ' +
          'sem markdown adicional. Limite a até 20 linhas na tabela. ' +
          'IMPORTANTE: Se houver filtros no contexto, aplique-os para retornar apenas registros que atendem a TODOS os critérios.'
      });
    }

    messages.push({ role: 'user', content: userMessage });
    return _postMessages(messages);
  }

  /**
   * Chat contínuo focado no relatório ativo.
   * @param {string} reportKey
   * @param {string} reportLabel
   * @param {object} kpis
   * @param {{role: 'user'|'assistant', content: string}[]} history
   * @returns {Promise<string>}
   */
  async function chatAboutReport(reportKey, reportLabel, kpis, history = [], contextData = null, options = {}) {
    if (!Array.isArray(history) || !history.length) {
      throw new Error('Histórico de chat vazio.');
    }

    const safeHistory = history
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content }))
      .slice(-12);

    const strictPrompt =
      'Você é um assistente de BI dentro de um dashboard corporativo. ' +
      'Responda com base EXCLUSIVA no contexto JSON e nos KPIs recebidos nesta chamada. ' +
      'Nao recuse perguntas por mudanca de entidade: use o escopo de dados informado no contexto atual. ' +
      'Nunca invente dados nao presentes no contexto. ' +
      'Se faltar dado, explique objetivamente qual dado esta faltando. ' +
      'Responda em portugues do Brasil, em no maximo 4 frases curtas. ' +
      'Se a pergunta pedir listagem (ex: "liste", "mostre", "quais"), devolva em bullet points com "- " em cada linha.';

    const contextPrompt =
      `Escopo atual de dados: ${reportLabel} (${reportKey})\n` +
      (options.scopeHint ? `${options.scopeHint}\n` : '') +
      `KPIs disponíveis agora:\n${_buildKpiBlock(kpis)}\n` +
      (contextData && typeof contextData.totalRegistrosFiltrados === 'number'
        ? `Total de registros filtrados: ${contextData.totalRegistrosFiltrados}\n`
        : '') +
      (contextData && contextData.filtrosAplicados && Object.keys(contextData.filtrosAplicados).length
        ? `Filtros ativos no relatório:\n${Object.entries(contextData.filtrosAplicados).map(([k,v]) => `  - ${k}: ${v}`).join('\n')}\n`
        : '') +
      `Dados JSON do escopo atual:\n${_safeSerializeContext(contextData)}\n` +
      (options.allowCrossReport
        ? 'Regra obrigatoria: responda com precisao usando SOMENTE este escopo de dados atual.\n'
        : 'Regra obrigatoria: mantenha a conversa estritamente neste escopo atual.\n') +
      'Ao gerar tabelas, respeite TODOS os filtros ativos mencionados acima.\n' +
      'Quando a pergunta for sobre quantidade/total, use o valor exato de "Total de registros filtrados" sempre que aplicável.';

    const messages = [
      { role: 'system', content: strictPrompt },
      { role: 'system', content: contextPrompt }
    ];

    if (options.requireTable) {
      messages.push({
        role: 'system',
        content:
          'Como o usuário pediu formato tabular, responda EXCLUSIVAMENTE em: __TABLE_JSON__{"title":"...","summary":"...","columns":["..."],"rows":[["..."]]} ' +
          'sem markdown extra e com no máximo 20 linhas. ' +
          'IMPORTANTE: Filtre os dados APENAS pelos critérios solicitados na pergunta (ex: status=Cancelado). ' +
          'Se houver filtros no contexto, aplique-os para retornar apenas registros que atendem a TODOS os critérios.'
      });
    }

    messages.push(...safeHistory);
    return _postMessages(messages);
  }

  async function suggestQuestionRewrite(reportLabel, question) {
    if (!question || !question.trim()) {
      throw new Error('Pergunta vazia.');
    }

    const messages = [
      {
        role: 'system',
        content:
          'Você é um assistente que melhora perguntas para análise de BI. ' +
          'Reescreva a pergunta para ficar objetiva, específica e orientada a dados. ' +
          'Responda SOMENTE com a pergunta reescrita, sem aspas e sem explicações. ' +
          'Use português do Brasil em uma única frase curta.'
      },
      {
        role: 'user',
        content:
          `Relatório atual: ${reportLabel}\n` +
          `Pergunta original: ${question}\n` +
          'Reescreva a pergunta.'
      }
    ];

    return _postMessages(messages);
  }

  function _parseRecommendations(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 4);
      }
    } catch (_) {
      // Segue para parser por linhas.
    }

    const lines = text
      .split(/\r?\n+/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.replace(/^[-*•]\s*/, '').replace(/^\d+[\.)]\s*/, '').trim())
      .filter(Boolean);

    return lines.slice(0, 4);
  }

  async function recommendActions(reportKey, reportLabel, kpis, contextData = null) {
    const contextPrompt =
      `Relatorio: ${reportLabel} (${reportKey})\n` +
      `KPIs:\n${_buildKpiBlock(kpis)}\n` +
      (contextData && typeof contextData.totalRegistrosFiltrados === 'number'
        ? `Total de registros filtrados: ${contextData.totalRegistrosFiltrados}\n`
        : '') +
      (contextData && contextData.filtrosAplicados && Object.keys(contextData.filtrosAplicados).length
        ? `Filtros ativos:\n${Object.entries(contextData.filtrosAplicados).map(([k,v]) => `  - ${k}: ${v}`).join('\n')}\n`
        : '') +
      `Dados JSON:\n${_safeSerializeContext(contextData)}`;

    const messages = [
      {
        role: 'system',
        content:
          'Voce e um analista de BI senior. Gere recomendacoes praticas e acionaveis com base EXCLUSIVA nos dados fornecidos. ' +
          'Retorne EXATAMENTE 4 recomendacoes curtas, uma por linha, cada linha iniciando com "- ". ' +
          'Nao use markdown adicional, nao use titulos e nao invente dados.'
      },
      {
        role: 'user',
        content: contextPrompt
      }
    ];

    const raw = await _postMessages(messages);
    const recs = _parseRecommendations(raw);
    if (recs.length < 2) {
      throw new Error('IA retornou recomendacoes insuficientes.');
    }
    return recs.slice(0, 4);
  }

  return { askQuestion, chatAboutReport, suggestQuestionRewrite, recommendActions };

})();
