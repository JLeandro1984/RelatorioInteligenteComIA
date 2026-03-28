# 📊 Relatório Inteligente com IA

**Dashboard premium de análise de dados com IA simulada** — Uma solução corporativa, escalável e funcional para relatórios dinâmicos, construída com HTML, CSS e JavaScript puro.

---

## ✨ Visão Geral

**Relatório Inteligente com IA** é uma plataforma de business intelligence que combina:

- 🎯 **Interface Universal** — Uma única tela que adapta-se a qualquer tipo de relatório por configuração
- 🧠 **Motor de IA Simulada** — Geração automática de insights, resumo executivo e recomendações
- 📈 **Gráficos Dinâmicos** — Múltiplos tipos (barras, linhas, donut) via Chart.js
- 🎨 **Design Premium** — Visual corporativo, moderno e responsivo
- 🔌 **Totalmente Desacoplado** — Trocar JSON por API sem reescrever código

---

## 🚀 Features Principais

### 📋 Dashboard Unificada
- Uma tela adapta-se a **6 tipos de relatórios** (Clientes, Produtos, Estoque, Funcionários, Notas Fiscais, Vendas)
- Layout responsivo com sidebar colapsável
- Topbar com data/hora e ações rápidas

### 🎓 Inteligência Artificial Simulada
- Interpretação de perguntas em linguagem natural
- Geração contextual de **insights automáticos**
- **Resumo executivo** com análise profissional
- **Recomendações** baseadas nos dados
- Cálculo de **KPIs** sob demanda

### 📊 Visualização de Dados
- **KPI Cards** com indicadores de tendência
- **Gráficos** (bar, line, donut) com gradientes premium
- **Tabela interativa** com ordenação por coluna
- **Filtros dinâmicos** conforme o tipo de relatório
- **Pesquisa em tempo real** na tabela
- **Drag-and-drop no menu** para reordenar relatórios (ordem persiste)

### ⚙️ Configuração Sem Limites
- Novo relatório = novo registro em `report-config.js`
- Nenhuma alteração em outros arquivos
- Escalável e pronto para evolução

### 📱 Experiência Premium
- Animações suaves e transições elegantes
- Loading com barra de progresso
- Toast notifications
- Dark theme corporativo
- Design responsivo (mobile, tablet, desktop)
- Ícone profissional (favicon) e PWA manifest para instalação em desktop/mobile

---

## 📁 Estrutura de Diretórios

```
RelatorioInteligenteIA/
│
├── index.html                    ← HTML da aplicação
├── favicon.svg                   ← Ícone do projeto (exibido no navegador)
├── manifest.json                 ← Configuração de PWA
├── START_SERVER.bat              ← Script para iniciar servidor local
├── README.md                     ← Documentação (este arquivo)
│
├── css/
│   └── styles.css                ← Design system (tokens, componentes, temas)
│
├── js/
│   ├── report-config.js          ★ Configuração declarativa dos relatórios
│   ├── insight-engine.js         ★ Motor de IA (insights, KPIs, análise)
│   ├── chart-engine.js           ★ Wrapper Chart.js (render gráficos)
│   ├── report-engine.js          ★ Renderizador de componentes DOM
│   ├── drag-drop-menu.js         ★ Drag-and-drop para reordenar menu
│   └── app.js                    ★ Orquestrador principal
│
├── data/
│   └── report-data.json          ← Dados simulados (JSON)
│
└── README.md                     ← Documentação (este arquivo)
```

---

## 🎯 Como Usar

### 1️⃣ Abrir Localmente

**Opção A: Com servidor local (recomendado)**
```bash
# Use a extensão "Live Server" no VS Code
# Ou rode um servidor Python simples:
python -m http.server 8000
# Abra: http://localhost:8000
```

**Opção B: Diretamente** (sem fetch de JSON, verá erro de CORS)
- Abra `index.html` diretamente no navegador

### 2️⃣ Selecionar um Relatório

Clique em qualquer relatório na **sidebar esquerda**:
- 👥 **Clientes** — análise da base comercial
- 📦 **Produtos** — desempenho do portfólio
- 📚 **Estoque** — controle de inventário
- 💼 **Funcionários** — equipe e desempenho
- 📄 **Notas Fiscais** — faturamento e impostos
- 💰 **Vendas** — análise de pedidos

### 3️⃣ Aplicar Filtros (Opcional)

Cada relatório possui **filtros dinâmicos** conforme seu contexto:

| Relatório | Filtros |
|-----------|---------|
| Clientes | Segmento, Estado, Status (ativo/inativo) |
| Produtos | Categoria, Marca, Status |
| Estoque | Depósito, Criticidade |
| Funcionários | Setor, Estado, Status |
| Notas Fiscais | Status, Mês |
| Vendas | Status do Pedido, Mês |

### 4️⃣ Fazer uma Pergunta (Optional - IA)

Digite uma pergunta em linguagem natural, ex:
- _"Qual o produto mais vendido?"_
- _"O que está com estoque baixo?"_
- _"Qual cliente mais comprou?"_
- _"Qual funcionário tem melhor avaliação?"_

A IA interpretará a intenção e priorizará o insight relacionado.

### 5️⃣ Gerar Relatório

Clique em **"Gerar Relatório"** e aguarde:
1. Animação de carregamento (900ms)
2. **KPIs** aparecem em cards com tendências
3. **Insights inteligentes** em cards coloridos
4. **Gráficos** com dados visuais
5. **Tabela detalhada** com busca interativa
6. **Resumo executivo** (parágrafo)
7. **Recomendações da IA** (ações sugeridas)

### 6️⃣ Interagir com Resultados

- **Tabela**: Clique no cabeçalho para ordenar por coluna
- **Pesquisa**: Use a caixa de busca para filtrar registros em tempo real
- **Limpar**: Botão "Limpar" reseta todos os filtros
- **Exportar**: Botão de export (simulado, pronto para backend)
- **Atualizar**: Recarrega dados do JSON

### 7️⃣ Reordenar Menu (Drag-and-Drop)

- **Arrastar**: Clique e mantenha sobre um relatório no menu, depois arraste para nova posição
- **Drop**: Solte o mouse para reordenar — a nova ordem é salva automaticamente
- **Persistência**: A ordem é armazenada em `localStorage` e restaurada ao recarregar
- **Reset**: Clique no ícone ↻ ao lado de "RELATÓRIOS" para voltar à ordem padrão

**Exemplo**: Se preferir "Vendas" no topo, simplesmente arraste para cima de "Clientes"!

---

## 🧠 Como Adicionar um Novo Relatório

### Passo 1: Adicionar Dados em `report-data.json`

Se ainda não existem, insira a entidade raiz:

```json
{
  "minhaEntidade": [
    { "id": "001", "nome": "Item 1", "status": "ativo", ... },
    { "id": "002", "nome": "Item 2", "status": "inativo", ... }
  ]
}
```

### Passo 2: Configurar o Relatório em `report-config.js`

Adicione um novo objeto no array `REPORT_CONFIGS`:

```js
{
  key: 'minhaEntidade',
  label: 'Minha Entidade',
  icon: 'folder',                    // Ícone Lucide
  color: 'blue',                     // Cor do header
  subtitle: 'Análise de minha entidade',
  entidade: 'minhaEntidade',         // Chave dos dados
  relacoes: ['outraEntidade'],       // Relacionamentos

  // Filtros dinâmicos
  filtros: [
    { campo: 'status', label: 'Status', tipo: 'select', opcoesDe: 'minhaEntidade.status' },
    { campo: 'regiao', label: 'Região', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'norte', label: 'Norte' },
        { value: 'sul', label: 'Sul' }
      ]
    }
  ],

  // Indicadores principais
  kpis: [
    { key: 'total', label: 'Total de Itens', icon: 'folder', cor: 'blue' },
    { key: 'ativos', label: 'Itens Ativos', icon: 'check-circle', cor: 'green' }
  ],

  // Colunas da tabela
  colunas: [
    { campo: 'id',     label: 'ID',     tipo: 'text' },
    { campo: 'nome',   label: 'Nome',   tipo: 'text' },
    { campo: 'status', label: 'Status', tipo: 'status' }
  ],

  // Tipos de gráficos suportados
  graficos: ['bar', 'pie'],

  // Sugestões de perguntas para o usuário
  perguntasSugeridas: [
    'qual item tem mais atividade?',
    'qual a distribuição por região?'
  ]
}
```

### Passo 3: (Opcional) Adicionar Analisador em `insight-engine.js`

Se precisar de lógica específica de análise, adicione um handler em `intentHandlers`:

```js
getMeuInsight(dados) {
  return {
    tipo: 'info', icone: 'lightbulb',
    titulo: 'Meu Insight',
    texto: `Análise customizada da minha entidade.`,
    valor: `123 itens`
  };
}
```

E registre a intenção em `INTENCOES`:

```js
{
  id: 'meu_insight',
  palavrasChave: ['minha pergunta', 'outra variação'],
  contextos: ['minhaEntidade'],
  handler: 'getMeuInsight'
}
```

### Passo 4: Pronto! 🎉

- A sidebar mostrará o novo relatório automaticamente
- Todos os componentes (filtros, tabela, gráficos) funcionarão sem alterações
- Os insights serão gerados conforme o padrão

---

## 🏗️ Arquitetura

### Separação de Responsabilidades

```
┌─────────────────────────────────────────────────────────┐
│                       index.html                         │
│                    (UI Shell, DOM)                       │
└─────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────┐
│                     app.js (Orquestrador)                │
│  - Estado global | Eventos | Fluxo de geração            │
└─────────────────────────────────────────────────────────┘
                 ↓          ↓          ↓
    ┌───────────────┬─────────────┬──────────────┐
    ↓               ↓             ↓              ↓
┌────────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐
│report-     │ │insight-  │ │chart-     │ │report-      │
│config.js   │ │engine.js │ │engine.js  │ │engine.js    │
│(Config)    │ │(IA)      │ │(Charts)   │ │(Render)     │
└────────────┘ └──────────┘ └───────────┘ └─────────────┘
                            ↓
                ┌───────────────────────┐
                │  report-data.json     │
                │  (Dados brutos)       │
                └───────────────────────┘
```

### Fluxo de Dados

1. **Carregar**: `app.js` carrega `report-data.json`
2. **Filtrar**: `report-engine.js` filtra dados conforme `report-config.js`
3. **Analisar**: `insight-engine.js` processa dados → KPIs + insights
4. **Visualizar**: `chart-engine.js` + `report-engine.js` renderizam DOM
5. **Interagir**: `app.js` escuta eventos e regenra conforme necessário

### Padrões Usados

- **Singleton Modules** — Cada motor é um IIFE que exporta métodos públicos
- **Configuration over Convention** — Relatórios dirigidos por config, não por código
- **Desacoplamento** — Dados, lógica e apresentação separados
- **Lazy Evaluation** — Insights gerados sob demanda
- **Backward Compatible** — Pronto para trocar JSON por API sem quebrar nada

---

## 🛠️ Tech Stack

| Tecnologia | Versão | Propósito |
|-----------|--------|----------|
| **HTML5** | - | Estrutura semântica |
| **CSS3** | - | Design system, grid, flexbox, animações |
| **JavaScript ES6+** | - | Lógica, modularização (IIFE), eventos |
| **Chart.js** | 4.4.0 | Gráficos interativos (CDN) |
| **Lucide Icons** | Latest | Ícones SVG (CDN) |
| **Google Fonts** | Inter | Tipografia corporativa |

**Sem frameworks** — React, Vue, Angular, Webpack, etc. não utilizados.

---

## 📋 Tipos de Dados Suportados

Na coluna de uma tabela, você pode especificar `tipo`:

| Tipo | Exemplo | Saída |
|------|---------|-------|
| `text` | "João Silva" | Texto simples |
| `moeda` | 1500.50 | R$ 1.500,50 |
| `numero` | 1234567 | 1.234.567 |
| `percentual` | 85.5 | 85.5% |
| `data` | "2026-03-20" | 20/03/2026 |
| `badge` | "Tecnologia" | Badge colorida |
| `status` | true/false | 🟢 Ativo / 🔴 Inativo |
| `statusPedido` | "Entregue" | Badge do status |
| `statusNF` | "Autorizada" | Badge da NF |
| `criticidade` | "critico" | Badge de criticidade |
| `avaliacao` | 4.5 | Estrelas (★★★★☆) |

---

## 🎨 Design System

### Paleta de Cores

```css
--color-primary:   #4f8ef7  /* Azul */
--color-secondary: #7c5cbf  /* Roxo */
--color-success:   #22c55e  /* Verde */
--color-warning:   #f59e0b  /* Âmbar */
--color-danger:    #ef4444  /* Vermelho */
--color-info:      #06b6d4  /* Ciano */
--color-gold:      #eab308  /* Ouro */
--color-orange:    #f97316  /* Laranja */
```

### Componentes Principais

- **Sidebar** — Menu colapsável com navegação
- **Topbar** — Data, breadcrumb, ações rápidas
- **Cards de KPI** — Indicadores com cor e ícone por tema
- **Insight Cards** — Análises em formato visual
- **Chart Containers** — Gráficos com título e legenda
- **Data Table** — Tabela responsiva com ordenação e busca
- **Summary Block** — Parágrafo de resumo executivo
- **Recommendation List** — Itens de recomendação

---

## 📊 Exemplo: Relatório de Clientes

### Dados de Entrada
```json
{
  "clientes": [
    { "id": "C001", "nome": "Grupo Alfa", "segmento": "Tecnologia", ... }
  ],
  "pedidos": [ ... ],
  "notasFiscais": [ ... ]
}
```

### KPIs Calculados
- ✅ Total de Clientes: **8**
- ✅ Clientes Ativos: **7**
- ✅ Total de Pedidos: **10**
- ✅ Receita Total: **R$ 128.999,70**

### Insights Gerados
1. **Base de Clientes** — 8 cadastros, 7 ativos, 4 segmentos
2. **Cliente Destaque** — Grupo Alfa gerou R$ 35.289,00
3. **Segmento Predominante** — "Tecnologia" com 2 clientes
4. **Clientes Inativos** — 1 cliente inativo (oportunidade de reativação)

### Gráficos
- **Barras** — Receita por Cliente
- **Pizza** — Clientes por Segmento

### Tabela
| ID | Cliente | Segmento | Cidade | UF | Status | Limite Crédito | Cadastro |
|----|---------|----------|--------|----|----|------|------|
| C001 | Grupo Alfa Tecnologia | Tecnologia | São Paulo | SP | Ativo | R$ 50.000,00 | 15/03/2021 |
| ... | ... | ... | ... | ... | ... | ... | ... |

### Resumo Executivo
> A base de clientes conta com **8 cadastros**, dos quais **7 estão ativos**. O portfólio é diversificado em **4 segmentos de mercado**. O cliente de maior relevância financeira é **Grupo Alfa Tecnologia**, responsável por **R$ 35.289,00** em pedidos...

### Recomendações
1. Desenvolva uma **campanha de reativação** para o 1 cliente inativo
2. Implemente um **programa de fidelidade** segmentado por volume
3. Revise os **limites de crédito** com base no histórico
4. Analise **concentração de risco** (Grupo Alfa = 27% da receita)

---

## 🚀 Performance e Otimizações

- ✅ **Zero dependências** — CSS/JS nativos, sem build
- ✅ **Gráficos lazy** — Destroi instância anterior antes de recriar
- ✅ **Animações GPU** — Usar `transform` + `opacity`
- ✅ **Lazy loading de ícones** — Lucide carregado via CDN
- ✅ **Debouncing na tabela** — Busca otimizada
- ✅ **Event delegation** — Menos listeners, melhor memória
- ✅ **Drag-and-drop otimizado** — Usa HTML5 nativo, salva em localStorage

---

## 🔮 Roadmap e Melhorias Futuras

- [ ] **Integração com Backend Real** — Trocar `fetch` de JSON por API REST
- [ ] **Integração com IA Real** — OpenAI / Claude / Gemini via backend
- [ ] **Exportação** — PDF, Excel, CSV dos relatórios
- [ ] **Agendamento** — Relatórios automáticos por email
- [ ] **Permissões** — Controle de acesso por usuário
- [ ] **Temas** — Dark/Light mode
- [ ] **Persistência** — LocalStorage para filtros favoritos
- [ ] **Análise de Tendências** — Comparação período a período
- [ ] **Alertas** — Notificações push quando anomalias são detectadas

---

## 🎨 Ícone e Branding

### Favicon
O projeto inclui um **ícone profissional** que é exibido automaticamente em:

✅ **Aba do navegador** — Junto a URL (favicon)  
✅ **Bookmarks/Favoritos** — Quando você adiciona a página  
✅ **Histórico do navegador**  
✅ **Tela inicial (PWA)** — Se instalar como aplicativo  

### Arquivos de Branding

- **`favicon.svg`** — Ícone vetorial escalável (principal)
- **`manifest.json`** — Configuração de PWA (Progressive Web App)
  - Permite "instalar" no desktop/mobile
  - Define nome, cores e ícone da aplicação
  - Adiciona cor de tema do navegador

### Como o Ícone Aparece

1. **Navegador de Desktop**: Aparece na aba da página
2. **Navegador Mobile**: Aparece na aba e no histórico
3. **PWA (Instalar)**: 
   - Chrome/Edge: Menu → "Instalar aplicativo"
   - Safari: Botão compartilhar → "Adicionar à Tela de Início"
4. **Cor de Tema**: Status bar/navegação adapta-se ao azul (#4f8ef7)

---

## 📞 Suporte e Dúvidas

### Tela não carrega?
- Verifique se está usando um **servidor local** (http://localhost)
- Abra o **DevTools** (F12) e procure por erros no console

### JSON não carrega?
- Confirme que `data/report-data.json` existe e está no caminho correto
- Tente com `python -m http.server 8000` e acesse em http://localhost:8000

### Novo relatório não aparece?
- Verifique sintaxe em `report-config.js` (JSON válido)
- Confirme que a `entidade` existe em `report-data.json`
- Recarregue a página (Ctrl+Shift+R)

### Drag-and-drop não funciona?
- Confirme que `js/drag-drop-menu.js` está carregado
- Tente resetar: Clique no ícone ↻ "Resetar ordem"
- Verifique DevTools para erros no console
- **No modo privativo/anônimo**, localStorage é desabilitado automaticamente

---

## 📜 Licença

Código de exemplo — sinta-se livre para usar, modificar e distribuir conforme necessário para seus projetos.

---

## 👨‍💼 Desenvolvimento de Nível Sênior

Este projeto demonstra boas práticas profissionais:

✅ **Modularização** — Cada arquivo tem responsabilidade única  
✅ **Escalabilidade** — Adicione relatórios sem tocar em `app.js`  
✅ **Manutenibilidade** — Código limpo, comentário onde agrega valor  
✅ **Performance** — Zero overhead, animações suaves  
✅ **UX Premium** — Visual corporativo, feedback ao usuário  
✅ **Engenharia** — Separação clara config/dados/apresentação  

---

## 🎯 Próximos Passos

1. **Abra no navegador** — `http://localhost:8000`
2. **Explore os 6 relatórios** — Clique na sidebar
3. **Teste os filtros** — Veja como os dados mudam
4. **Faça perguntas** — Experimente a IA simulada
5. **Customize** — Adicione novos tipos de relatórios

**Aproveite! 🚀**

---

**Desenvolvido com 💜 para análises de dados premium sem frameworks.**
