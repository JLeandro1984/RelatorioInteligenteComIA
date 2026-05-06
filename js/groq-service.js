/**
 * groq-service.js
 * ─────────────────────────────────────────────────────────────────
 * Serviço frontend que chama o proxy /api/groq no servidor Node.
 * A API key NUNCA transita pelo browser — fica protegida no .env.
 * ─────────────────────────────────────────────────────────────────
 */

const GroqService = (() => {

  const ENDPOINT = '/api/groq';

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

  function _safeSerializeContext(contextData, maxChars = 16000) {
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
    const response = await fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.content;
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
    const userMessage =
      _buildUserMessage(reportKey, kpis, question) +
      '\n\nDados JSON do relatório selecionado (use este contexto para responder com precisão):\n' +
      contextBlock;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    if (options.requireTable) {
      messages.push({
        role: 'system',
        content:
          'Retorne EXCLUSIVAMENTE no formato: __TABLE_JSON__{"title":"...","summary":"...","columns":["..."],"rows":[["..."]]} ' +
          'sem markdown adicional. Limite a até 20 linhas na tabela.'
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
      .slice(-12);

    const strictPrompt =
      'Você é um assistente de BI dentro de um dashboard corporativo. ' +
      'Responda SOMENTE sobre o relatório selecionado e os KPIs recebidos. ' +
      'Se a pergunta fugir do relatório ativo, recuse com educação e peça para o usuário voltar ao contexto do relatório. ' +
      'Nunca invente dados não presentes no contexto. ' +
      'Se faltar dado, explique objetivamente qual dado está faltando. ' +
      'Responda em português do Brasil, em no máximo 4 frases curtas. ' +
      'Se a pergunta pedir listagem (ex: "liste", "mostre", "quais"), devolva em bullet points com "- " em cada linha.';

    const contextPrompt =
      `Relatório ativo: ${reportLabel} (${reportKey})\n` +
      `KPIs disponíveis agora:\n${_buildKpiBlock(kpis)}\n` +
      `Dados JSON do relatório ativo:\n${_safeSerializeContext(contextData)}\n` +
      'Regra obrigatória: mantenha a conversa estritamente neste relatório ativo.';

    const messages = [
      { role: 'system', content: strictPrompt },
      { role: 'system', content: contextPrompt }
    ];

    if (options.requireTable) {
      messages.push({
        role: 'system',
        content:
          'Como o usuário pediu formato tabular, responda EXCLUSIVAMENTE em: __TABLE_JSON__{"title":"...","summary":"...","columns":["..."],"rows":[["..."]]} ' +
          'sem markdown extra e com no máximo 20 linhas.'
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

  return { askQuestion, chatAboutReport, suggestQuestionRewrite };

})();
