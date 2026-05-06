'use strict';

require('dotenv').config();

const express  = require('express');
const fetch    = require('node-fetch');
const path     = require('path');

const app = express();

/* ─────────────────────────────────────────────────────────────────
   MIDDLEWARES
───────────────────────────────────────────────────────────────── */
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname)));

/* ─────────────────────────────────────────────────────────────────
   PROXY — POST /api/groq
   Mantém a GROQ_API_KEY no servidor; nunca exposta ao browser.
───────────────────────────────────────────────────────────────── */
app.post('/api/groq', async (req, res) => {
  const { messages } = req.body;

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
    if (msg.content.length > 30000) {
      return res.status(400).json({ error: 'Conteúdo da mensagem excede 30000 caracteres.' });
    }
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Serviço IA não configurado. Adicione GROQ_API_KEY no arquivo .env e reinicie o servidor.'
    });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages,
        max_tokens:  600,
        temperature: 0.4
      })
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}));
      console.error('[Groq API] Erro:', groqRes.status, errBody);
      return res.status(groqRes.status).json({
        error: errBody.error?.message || `Erro ${groqRes.status} na API Groq.`
      });
    }

    const data    = await groqRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'Resposta inesperada da API Groq.' });
    }

    res.json({ content });

  } catch (err) {
    console.error('[Groq Proxy] Erro interno:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor. Verifique o log.' });
  }
});

/* ─────────────────────────────────────────────────────────────────
   INICIAR
───────────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  const keyStatus = process.env.GROQ_API_KEY
    ? '✅  GROQ_API_KEY configurada'
    : '⚠️   GROQ_API_KEY não encontrada — adicione no arquivo .env';
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   Relatório Inteligente IA — Servidor                ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  URL:  http://localhost:${PORT}`);
  console.log(`  IA:   ${keyStatus}`);
  console.log('');
});
