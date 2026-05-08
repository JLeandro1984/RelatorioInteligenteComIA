'use strict';

require('dotenv').config();

const express  = require('express');
const fetch    = require('node-fetch');
const path     = require('path');

const app = express();
const DEFAULT_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const MAX_OUTPUT_TOKENS = Math.max(120, Number(process.env.GROQ_MAX_TOKENS || 220));

function _loadModelCandidates() {
  const raw = String(process.env.GROQ_MODELS || '').trim();
  if (!raw) return [...DEFAULT_MODELS];

  const parsed = raw
    .split(/[;,\r\n]+/)
    .map(m => m.trim())
    .filter(Boolean);

  if (!parsed.length) return [...DEFAULT_MODELS];
  return Array.from(new Set(parsed));
}

function _extractRetryWindow(message = '') {
  const match = String(message).match(/Please try again in\s+([^\.]+(?:\.[0-9]+s)?)/i);
  return match ? match[1] : null;
}

/* ─────────────────────────────────────────────────────────────────
   MULTI-TOKEN ROUND-ROBIN
───────────────────────────────────────────────────────────────── */
let apiKeys = [];
let currentKeyIndex = 0;

function _loadApiKeys() {
  apiKeys = [];

  // Formato preferido: GROQ_API_KEY_1, GROQ_API_KEY_2, ...
  let i = 1;
  while (process.env[`GROQ_API_KEY_${i}`]) {
    apiKeys.push(String(process.env[`GROQ_API_KEY_${i}`]).trim());
    i++;
  }

  // Compatibilidade: chave única em GROQ_API_KEY
  if (process.env.GROQ_API_KEY) {
    apiKeys.push(String(process.env.GROQ_API_KEY).trim());
  }

  // Compatibilidade: lista em GROQ_API_KEYS separada por vírgula, ponto e vírgula ou quebra de linha
  if (process.env.GROQ_API_KEYS) {
    const listKeys = String(process.env.GROQ_API_KEYS)
      .split(/[;,\r\n]+/)
      .map(k => k.trim())
      .filter(Boolean);
    apiKeys.push(...listKeys);
  }

  // Remove duplicadas e entradas vazias
  apiKeys = Array.from(new Set(apiKeys.filter(Boolean)));

  return apiKeys;
}

function _getNextApiKey() {
  if (apiKeys.length === 0) return null;
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
}

_loadApiKeys();

/* ─────────────────────────────────────────────────────────────────
   MIDDLEWARES
───────────────────────────────────────────────────────────────── */
app.use(express.json({ limit: '64kb' }));

// Permite chamadas do frontend mesmo quando ele roda em outra porta local (ex: Live Server).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isLocalhostOrigin = typeof origin === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

  if (isLocalhostOrigin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.static(path.join(__dirname)));

/* ─────────────────────────────────────────────────────────────────
   PROXY — POST /api/groq
   Mantém a GROQ_API_KEY no servidor; nunca exposta ao browser.
───────────────────────────────────────────────────────────────── */
app.post('/api/groq', async (req, res) => {
  const { messages } = req.body;
  const modelCandidates = _loadModelCandidates();

  // Validação de entrada
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Campo "messages" deve ser um array não vazio.' });
  }
  for (const msg of messages) {
    if (!msg || typeof msg.role !== 'string' || typeof msg.content !== 'string') {
      return res.status(400).json({ error: 'Cada mensagem deve ter "role" e "content" como strings.' });
    }
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      return res.status(400).json({ error: `Role inválido: ${msg.role}` });
    }
    if (msg.content.length > 18000) {
      return res.status(400).json({ error: 'Conteudo da mensagem excede 18000 caracteres. Reduza o contexto para consultar a IA.' });
    }
  }

  const apiKey = _getNextApiKey();
  if (!apiKey) {
    return res.status(503).json({
      error: 'Nenhuma chave Groq configurada. Use GROQ_API_KEY_1 (ou mais), GROQ_API_KEY ou GROQ_API_KEYS no arquivo .env e reinicie o servidor.'
    });
  }

  try {
    let lastStatus = 500;
    let lastErrBody = {};

    for (const model of modelCandidates) {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.4
        })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          return res.status(500).json({ error: 'Resposta inesperada da API Groq.' });
        }
        return res.json({ content, model });
      }

      const errBody = await groqRes.json().catch(() => ({}));
      lastStatus = groqRes.status;
      lastErrBody = errBody || {};
      console.error(`[Groq API] Erro no modelo ${model}:`, groqRes.status, errBody);

      const canTryNextModel = groqRes.status === 429 || groqRes.status >= 500;
      if (!canTryNextModel) break;
    }

    const groqMessage = lastErrBody.error?.message || `Erro ${lastStatus} na API Groq.`;
    if (lastStatus === 429 && lastErrBody.error?.code === 'rate_limit_exceeded') {
      const retryWindow = _extractRetryWindow(groqMessage);
      const friendly = retryWindow
        ? `Limite diario de tokens atingido na Groq. Tente novamente em ${retryWindow} ou reduza o volume de dados enviado no contexto.`
        : 'Limite diario de tokens atingido na Groq. Tente novamente mais tarde ou reduza o volume de dados enviado no contexto.';
      return res.status(429).json({ error: friendly, code: 'rate_limit_exceeded' });
    }
    return res.status(lastStatus).json({
      error: groqMessage
    });

  } catch (err) {
    console.error('[Groq Proxy] Erro interno:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor. Verifique o log.' });
  }
});

/* ─────────────────────────────────────────────────────────────────
   INICIAR
───────────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  const keyStatus = apiKeys.length > 0
    ? `✅  ${apiKeys.length} chave(s) Groq configurada(s)` + (apiKeys.length > 1 ? ' — Round-Robin ativado' : '')
    : '⚠️   Nenhuma chave Groq encontrada — adicione GROQ_API_KEY_1, GROQ_API_KEY ou GROQ_API_KEYS no .env';
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   Relatório Inteligente IA — Servidor                ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  URL:  http://localhost:${PORT}`);
  console.log(`  IA:   ${keyStatus}`);
  console.log('');
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`\n[Erro] A porta ${PORT} ja esta em uso. Feche o processo anterior ou defina outra porta no .env (ex: PORT=8001).`);
    process.exit(1);
  }
  console.error('\n[Erro] Falha ao iniciar servidor:', err && err.message ? err.message : err);
  process.exit(1);
});
