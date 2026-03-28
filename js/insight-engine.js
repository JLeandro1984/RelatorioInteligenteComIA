/**
 * insight-engine.js
 * ─────────────────────────────────────────────────────────────────
 * Motor de IA simulada para geração de insights, resumo executivo
 * e recomendações, com base nos dados e no contexto do relatório.
 *
 * Arquitetura:
 *   1. Catálogo de intenções  — interpreta a pergunta do usuário
 *   2. Analisadores           — computam métricas por entidade
 *   3. Gerador de insights    — transforma métricas em narrativa
 *   4. Gerador de resumo      — parágrafo executivo
 *   5. Gerador de recomendações — ações sugeridas
 * ─────────────────────────────────────────────────────────────────
 */

const InsightEngine = (() => {

  /* ─────────────────────────────────────────────────────
     CATÁLOGO DE INTENÇÕES (treino da IA)
  ───────────────────────────────────────────────────── */
  const INTENCOES = [
    {
      id: 'mais_vendido',
      palavrasChave: ['mais vendido', 'produto top', 'maior venda', 'melhor produto', 'mais pedido'],
      contextos: ['produtos', 'vendas'],
      handler: 'getMaisVendido'
    },
    {
      id: 'estoque_baixo',
      palavrasChave: ['estoque baixo', 'estoque zerado', 'falta', 'acabou', 'critico', 'sem estoque', 'abaixo'],
      contextos: ['estoque', 'produtos'],
      handler: 'getEstoqueBaixo'
    },
    {
      id: 'cliente_top',
      palavrasChave: ['cliente mais comprou', 'cliente top', 'maior cliente', 'melhor cliente', 'cliente mais pedidos'],
      contextos: ['clientes', 'vendas'],
      handler: 'getClienteTop'
    },
    {
      id: 'maior_nf',
      palavrasChave: ['maior nota', 'nota fiscal maior', 'maior valor', 'nf mais alta', 'maior fatura'],
      contextos: ['notasFiscais', 'vendas'],
      handler: 'getMaiorNF'
    },
    {
      id: 'funcionario_destaque',
      palavrasChave: ['funcionário', 'vendedor', 'mais pedidos', 'melhor vendedor', 'colaborador'],
      contextos: ['funcionarios', 'vendas'],
      handler: 'getFuncionarioDestaque'
    },
    {
      id: 'margem',
      palavrasChave: ['margem', 'lucro', 'rentabilidade', 'mais lucrativo'],
      contextos: ['produtos'],
      handler: 'getMaiorMargem'
    }
  ];

  /* ─────────────────────────────────────────────────────
     INTERPRETADOR DE INTENÇÃO
  ───────────────────────────────────────────────────── */
  function interpretarPergunta(pergunta, contextoRelatorio) {
    const texto = pergunta.toLowerCase().trim();
    if (!texto) return null;

    for (const intencao of INTENCOES) {
      const matchContexto = intencao.contextos.includes(contextoRelatorio);
      const matchPalavra  = intencao.palavrasChave.some(p => texto.includes(p));
      if (matchPalavra) return { ...intencao, matchContexto };
    }
    return null;
  }

  /* ─────────────────────────────────────────────────────
     ANALISADORES POR ENTIDADE
  ───────────────────────────────────────────────────── */

  function analisarVendas(dados) {
    const { pedidos, clientes, produtos, funcionarios } = dados;

    // Receita por pedido
    const pedidosEnriquecidos = pedidos.map(p => {
      const valorTotal = p.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
      const cliente    = clientes.find(c => c.id === p.clienteId);
      const func       = funcionarios.find(f => f.id === p.funcionarioId);
      return { ...p, valorTotal, nomeCliente: cliente?.nome || '—', nomeFuncionario: func?.nome || '—' };
    });

    // Receita por cliente
    const receitaPorCliente = {};
    pedidosEnriquecidos.forEach(p => {
      receitaPorCliente[p.nomeCliente] = (receitaPorCliente[p.nomeCliente] || 0) + p.valorTotal;
    });

    // Quantidade vendida por produto
    const qtdPorProduto = {};
    const receitaPorProduto = {};
    pedidos.forEach(p => {
      p.itens.forEach(i => {
        const prod = produtos.find(pr => pr.id === i.produtoId);
        const nome = prod?.nome || i.produtoId;
        qtdPorProduto[nome]     = (qtdPorProduto[nome] || 0) + i.quantidade;
        receitaPorProduto[nome] = (receitaPorProduto[nome] || 0) + i.quantidade * i.precoUnitario;
      });
    });

    // Pedidos por funcionário
    const pedidosPorFunc = {};
    pedidosEnriquecidos.forEach(p => {
      pedidosPorFunc[p.nomeFuncionario] = (pedidosPorFunc[p.nomeFuncionario] || 0) + 1;
    });

    // Totalizadores
    const receitaTotal  = pedidosEnriquecidos.reduce((s, p) => s + p.valorTotal, 0);
    const ticketMedio   = pedidosEnriquecidos.length ? receitaTotal / pedidosEnriquecidos.length : 0;
    const emAberto      = pedidosEnriquecidos.filter(p => p.status !== 'Entregue').length;

    return {
      pedidosEnriquecidos, receitaTotal, ticketMedio, emAberto,
      receitaPorCliente, qtdPorProduto, receitaPorProduto, pedidosPorFunc
    };
  }

  function analisarEstoque(dados) {
    const { estoque, produtos } = dados;

    return estoque.map(e => {
      const prod = produtos.find(p => p.id === e.produtoId);
      let criticidade;
      if      (e.quantidade === 0)              criticidade = 'critico';
      else if (e.quantidade < e.minimo)         criticidade = 'baixo';
      else if (e.quantidade > e.maximo)         criticidade = 'alto';
      else                                      criticidade = 'normal';

      const valorEstoque = (prod?.custo || 0) * e.quantidade;
      return { ...e, nomeProduto: prod?.nome || e.produtoId, criticidade, valorEstoque };
    });
  }

  function analisarProdutos(dados) {
    const { produtos, pedidos } = dados;

    const qtdVendida = {};
    pedidos.forEach(p => {
      p.itens.forEach(i => {
        qtdVendida[i.produtoId] = (qtdVendida[i.produtoId] || 0) + i.quantidade;
      });
    });

    return produtos.map(p => {
      const margem = p.precoUnitario > 0
        ? ((p.precoUnitario - p.custo) / p.precoUnitario * 100).toFixed(1)
        : 0;
      const qtd = qtdVendida[p.id] || 0;
      const receitaGerada = qtd * p.precoUnitario;
      return { ...p, margem: parseFloat(margem), qtdVendida: qtd, receitaGerada };
    });
  }

  function analisarNFs(dados) {
    const { notasFiscais, clientes } = dados;
    return notasFiscais.map(nf => {
      const cliente = clientes.find(c => c.id === nf.clienteId);
      return { ...nf, nomeCliente: cliente?.nome || '—' };
    });
  }

  /* ─────────────────────────────────────────────────────
     HANDLERS DE INTENÇÃO ESPECÍFICA
  ───────────────────────────────────────────────────── */
  const intentHandlers = {
    getMaisVendido(analise) {
      const vendas = analise.qtdPorProduto || {};
      const top    = topEntry(vendas);
      if (!top) return null;
      return {
        tipo: 'gold', icone: 'star',
        titulo: 'Produto Mais Vendido',
        texto: `Com base nos pedidos registrados, o produto com maior volume de vendas é:`,
        valor: `${top.key} — ${top.value} unidades`
      };
    },
    getEstoqueBaixo(estoqueAnalise) {
      const criticos = estoqueAnalise.filter(e => e.criticidade === 'critico' || e.criticidade === 'baixo');
      if (!criticos.length) return { tipo: 'success', icone: 'check-circle', titulo: 'Estoque Saudável', texto: 'Nenhum produto está abaixo do mínimo no momento.', valor: '' };
      return {
        tipo: 'danger', icone: 'alert-triangle',
        titulo: 'Atenção: Estoque Baixo',
        texto: `${criticos.length} produto(s) estão abaixo do mínimo ou zerados:`,
        valor: criticos.slice(0, 3).map(e => e.nomeProduto).join(', ')
      };
    },
    getClienteTop(vendas) {
      const rec = vendas.receitaPorCliente || {};
      const top = topEntry(rec);
      if (!top) return null;
      return {
        tipo: 'info', icone: 'award',
        titulo: 'Cliente com Maior Volume',
        texto: `O cliente que mais gerou receita é:`,
        valor: `${top.key} — ${formatMoeda(top.value)}`
      };
    },
    getMaiorNF(nfsAnalise) {
      const sorted = [...nfsAnalise].sort((a, b) => b.valor - a.valor);
      if (!sorted.length) return null;
      const nf = sorted[0];
      return {
        tipo: 'gold', icone: 'file-text',
        titulo: 'Maior Nota Fiscal',
        texto: `A nota fiscal de maior valor é a ${nf.id} (${nf.nomeCliente}):`,
        valor: formatMoeda(nf.valor)
      };
    },
    getFuncionarioDestaque(vendas) {
      const pedPorFunc = vendas.pedidosPorFunc || {};
      const top = topEntry(pedPorFunc);
      if (!top) return null;
      return {
        tipo: 'purple', icone: 'user-check',
        titulo: 'Vendedor Destaque',
        texto: `O funcionário com mais pedidos registrados é:`,
        valor: `${top.key} — ${top.value} pedido(s)`
      };
    },
    getMaiorMargem(produtosAnalise) {
      const sorted = [...produtosAnalise].sort((a, b) => b.margem - a.margem);
      if (!sorted.length) return null;
      const p = sorted[0];
      return {
        tipo: 'success', icone: 'trending-up',
        titulo: 'Produto com Maior Margem',
        texto: `O produto com melhor margem de contribuição é:`,
        valor: `${p.nome} — ${p.margem}%`
      };
    }
  };

  /* ─────────────────────────────────────────────────────
     GERADORES DE INSIGHTS POR CONTEXTO
  ───────────────────────────────────────────────────── */

  function gerarInsightsClientes(dados, filtros) {
    const { clientes, pedidos } = dados;
    const ativos   = clientes.filter(c => c.ativo).length;
    const inativos = clientes.filter(c => !c.ativo).length;

    const vendasAnalise = analisarVendas(dados);
    const topCliente    = topEntry(vendasAnalise.receitaPorCliente);
    const segmentos     = contarPorCampo(clientes, 'segmento');
    const topSeg        = topEntry(segmentos);

    const insights = [
      {
        tipo: 'info', icone: 'users',
        titulo: 'Base de Clientes',
        texto: `Total de ${clientes.length} clientes cadastrados — ${ativos} ativos e ${inativos} inativo(s).`,
        valor: `${Math.round((ativos/clientes.length)*100)}% de atividade`
      },
      topCliente && {
        tipo: 'gold', icone: 'award',
        titulo: 'Cliente Destaque',
        texto: `O cliente com maior volume de compras no período é ${topCliente.key}.`,
        valor: formatMoeda(topCliente.value)
      },
      topSeg && {
        tipo: 'purple', icone: 'layers',
        titulo: 'Segmento Predominante',
        texto: `O segmento com maior representação na base é "${topSeg.key}" com ${topSeg.value} cliente(s).`,
        valor: `${topSeg.value} clientes`
      },
      inativos > 0 && {
        tipo: 'warning', icone: 'alert-circle',
        titulo: 'Clientes Inativos',
        texto: `${inativos} cliente(s) estão com status inativo. Avalie oportunidade de reativação.`,
        valor: `${inativos} cliente(s)`
      }
    ];

    return insights.filter(Boolean);
  }

  function gerarInsightsProdutos(dados) {
    const produtosAnalise = analisarProdutos(dados);
    const ativos    = produtosAnalise.filter(p => p.ativo).length;
    const maisVendido = produtosAnalise.sort((a, b) => b.qtdVendida - a.qtdVendida)[0];
    const maiorMargem = [...produtosAnalise].sort((a, b) => b.margem - a.margem)[0];
    const maiorReceita = [...produtosAnalise].sort((a, b) => b.receitaGerada - a.receitaGerada)[0];
    const categorias  = contarPorCampo(dados.produtos, 'categoria');
    const topCat      = topEntry(categorias);

    return [
      maisVendido && maisVendido.qtdVendida > 0 && {
        tipo: 'gold', icone: 'star',
        titulo: 'Produto Mais Vendido',
        texto: `"${maisVendido.nome}" lidera em volume com ${maisVendido.qtdVendida} unidades vendidas.`,
        valor: `${maisVendido.qtdVendida} unidades`
      },
      maiorMargem && {
        tipo: 'success', icone: 'trending-up',
        titulo: 'Maior Margem de Contribuição',
        texto: `"${maiorMargem.nome}" possui a maior margem de ${maiorMargem.margem}%.`,
        valor: `${maiorMargem.margem}%`
      },
      maiorReceita && maiorReceita.receitaGerada > 0 && {
        tipo: 'info', icone: 'bar-chart-2',
        titulo: 'Produto com Maior Receita',
        texto: `"${maiorReceita.nome}" gerou a maior receita total no período.`,
        valor: formatMoeda(maiorReceita.receitaGerada)
      },
      topCat && {
        tipo: 'purple', icone: 'layers',
        titulo: 'Categoria Líder',
        texto: `A categoria "${topCat.key}" concentra ${topCat.value} produto(s) no portfólio.`,
        valor: `${topCat.value} produtos`
      },
      dados.produtos.length - ativos > 0 && {
        tipo: 'warning', icone: 'alert-circle',
        titulo: 'Produtos Inativos',
        texto: `${dados.produtos.length - ativos} produto(s) inativo(s) identificado(s). Avalie descontinuação ou reativação.`,
        valor: `${dados.produtos.length - ativos} produto(s)`
      }
    ].filter(Boolean);
  }

  function gerarInsightsEstoque(dados) {
    const estoqueAnalise = analisarEstoque(dados);
    const criticos  = estoqueAnalise.filter(e => e.criticidade === 'critico');
    const baixos    = estoqueAnalise.filter(e => e.criticidade === 'baixo');
    const altos     = estoqueAnalise.filter(e => e.criticidade === 'alto');
    const normais   = estoqueAnalise.filter(e => e.criticidade === 'normal');
    const valorTotal = estoqueAnalise.reduce((s, e) => s + e.valorEstoque, 0);

    return [
      criticos.length > 0 && {
        tipo: 'danger', icone: 'x-circle',
        titulo: '⚠ Estoque Zerado',
        texto: `${criticos.length} produto(s) com estoque ZERADO: ${criticos.map(e => e.nomeProduto).join(', ')}.`,
        valor: `${criticos.length} produto(s)`
      },
      baixos.length > 0 && {
        tipo: 'warning', icone: 'alert-triangle',
        titulo: 'Abaixo do Mínimo',
        texto: `${baixos.length} produto(s) abaixo do estoque mínimo. Necessário reposição urgente.`,
        valor: baixos.slice(0, 2).map(e => e.nomeProduto).join(', ')
      },
      normais.length > 0 && {
        tipo: 'success', icone: 'check-circle',
        titulo: 'Nível Normal',
        texto: `${normais.length} produto(s) com estoque dentro dos limites ideais.`,
        valor: `${normais.length} produto(s)`
      },
      altos.length > 0 && {
        tipo: 'info', icone: 'trending-up',
        titulo: 'Estoque Acima do Máximo',
        texto: `${altos.length} produto(s) com quantidade acima do máximo definido. Avalie liquidação.`,
        valor: `${altos.length} produto(s)`
      },
      {
        tipo: 'purple', icone: 'dollar-sign',
        titulo: 'Valor Imobilizado',
        texto: `O valor total imobilizado em estoque (custo) é de ${formatMoeda(valorTotal)}.`,
        valor: formatMoeda(valorTotal)
      }
    ].filter(Boolean);
  }

  function gerarInsightsFuncionarios(dados) {
    const { funcionarios, pedidos } = dados;
    const ativos   = funcionarios.filter(f => f.ativo).length;
    const setores  = contarPorCampo(funcionarios.filter(f => f.ativo), 'setor');
    const topSetor = topEntry(setores);
    const massaSalarial = funcionarios.filter(f => f.ativo).reduce((s, f) => s + f.salario, 0);
    const topAvaliacao  = [...funcionarios].sort((a, b) => b.avaliacao - a.avaliacao)[0];

    // Pedidos por funcionário
    const pedidosPorFunc = {};
    pedidos.forEach(p => {
      const func = funcionarios.find(f => f.id === p.funcionarioId);
      if (func) pedidosPorFunc[func.nome] = (pedidosPorFunc[func.nome] || 0) + 1;
    });
    const topVendedor = topEntry(pedidosPorFunc);

    return [
      {
        tipo: 'cyan', icone: 'briefcase',
        titulo: 'Quadro de Colaboradores',
        texto: `A empresa conta com ${funcionarios.length} colaboradores, sendo ${ativos} em atividade.`,
        valor: `${ativos} ativos`
      },
      topSetor && {
        tipo: 'info', icone: 'layers',
        titulo: 'Setor com Mais Colaboradores',
        texto: `O setor "${topSetor.key}" concentra o maior número de colaboradores: ${topSetor.value}.`,
        valor: `${topSetor.value} pessoas`
      },
      {
        tipo: 'gold', icone: 'dollar-sign',
        titulo: 'Massa Salarial',
        texto: `O custo mensal estimado com salários dos colaboradores ativos é ${formatMoeda(massaSalarial)}.`,
        valor: formatMoeda(massaSalarial)
      },
      topAvaliacao && {
        tipo: 'success', icone: 'star',
        titulo: 'Melhor Avaliado',
        texto: `O colaborador com maior nota de avaliação é ${topAvaliacao.nome} com ${topAvaliacao.avaliacao.toFixed(1)}.`,
        valor: `${topAvaliacao.avaliacao.toFixed(1)} / 5.0`
      },
      topVendedor && {
        tipo: 'purple', icone: 'shopping-bag',
        titulo: 'Vendedor Mais Ativo',
        texto: `${topVendedor.key} é o funcionário com mais pedidos registrados no sistema.`,
        valor: `${topVendedor.value} pedidos`
      }
    ].filter(Boolean);
  }

  function gerarInsightsNFs(dados) {
    const nfsAnalise   = analisarNFs(dados);
    const autorizadas  = nfsAnalise.filter(nf => nf.status === 'Autorizada');
    const pendentes    = nfsAnalise.filter(nf => nf.status !== 'Autorizada');
    const valorTotal   = nfsAnalise.reduce((s, nf) => s + nf.valor, 0);
    const impostosTotal = nfsAnalise.reduce((s, nf) => s + nf.impostos, 0);
    const maiorNF      = [...nfsAnalise].sort((a, b) => b.valor - a.valor)[0];
    const receitaPorCliente = {};
    nfsAnalise.forEach(nf => {
      receitaPorCliente[nf.nomeCliente] = (receitaPorCliente[nf.nomeCliente] || 0) + nf.valor;
    });
    const topCliente = topEntry(receitaPorCliente);

    return [
      {
        tipo: 'green', icone: 'file-text',
        titulo: 'Faturamento Total',
        texto: `O faturamento total consolidado nas notas fiscais emitidas é de ${formatMoeda(valorTotal)}.`,
        valor: formatMoeda(valorTotal)
      },
      maiorNF && {
        tipo: 'gold', icone: 'award',
        titulo: 'Maior Nota Fiscal',
        texto: `A nota ${maiorNF.id} emitida para ${maiorNF.nomeCliente} possui o maior valor.`,
        valor: formatMoeda(maiorNF.valor)
      },
      pendentes.length > 0 && {
        tipo: 'warning', icone: 'clock',
        titulo: 'Notas Pendentes',
        texto: `${pendentes.length} nota(s) fiscal(is) ainda estão com status Pendente.`,
        valor: `${pendentes.length} NF(s)`
      },
      {
        tipo: 'orange', icone: 'receipt',
        titulo: 'Carga Tributária',
        texto: `Total de impostos nas notas autorizadas: ${formatMoeda(impostosTotal)} (≈ ${((impostosTotal/valorTotal)*100).toFixed(1)}% do faturamento).`,
        valor: formatMoeda(impostosTotal)
      },
      topCliente && {
        tipo: 'info', icone: 'user',
        titulo: 'Cliente com Maior Faturamento',
        texto: `O cliente ${topCliente.key} representou a maior participação no faturamento.`,
        valor: formatMoeda(topCliente.value)
      }
    ].filter(Boolean);
  }

  function gerarInsightsVendas(dados) {
    const vendasAnalise = analisarVendas(dados);
    const { pedidosEnriquecidos, receitaTotal, ticketMedio, emAberto,
            receitaPorCliente, qtdPorProduto, pedidosPorFunc } = vendasAnalise;

    const topCliente  = topEntry(receitaPorCliente);
    const topProduto  = topEntry(qtdPorProduto);
    const topVendedor = topEntry(pedidosPorFunc);

    // Concentração: top 2 clientes
    const receitaOrdenada = Object.values(receitaPorCliente).sort((a, b) => b - a);
    const top2 = receitaOrdenada.slice(0, 2).reduce((s, v) => s + v, 0);
    const concentracao = receitaTotal > 0 ? ((top2 / receitaTotal) * 100).toFixed(0) : 0;

    return [
      {
        tipo: 'gold', icone: 'trending-up',
        titulo: 'Receita Total do Período',
        texto: `A receita acumulada com todos os pedidos registrados é de ${formatMoeda(receitaTotal)}.`,
        valor: formatMoeda(receitaTotal)
      },
      {
        tipo: 'info', icone: 'credit-card',
        titulo: 'Ticket Médio',
        texto: `O valor médio por pedido no período é ${formatMoeda(ticketMedio)}.`,
        valor: formatMoeda(ticketMedio)
      },
      topCliente && {
        tipo: 'purple', icone: 'award',
        titulo: 'Cliente que Mais Comprou',
        texto: `${topCliente.key} é o cliente com maior volume de compras no período.`,
        valor: formatMoeda(topCliente.value)
      },
      topProduto && {
        tipo: 'success', icone: 'star',
        titulo: 'Produto Mais Vendido',
        texto: `O item com maior giro de vendas é "${topProduto.key}" com ${topProduto.value} unidades.`,
        valor: `${topProduto.value} unidades`
      },
      topVendedor && {
        tipo: 'cyan', icone: 'user-check',
        titulo: 'Vendedor Destaque',
        texto: `${topVendedor.key} foi o vendedor com mais pedidos fechados no período.`,
        valor: `${topVendedor.value} pedidos`
      },
      emAberto > 0 && {
        tipo: 'warning', icone: 'clock',
        titulo: 'Pedidos em Aberto',
        texto: `${emAberto} pedido(s) ainda aguardam processamento ou entrega.`,
        valor: `${emAberto} pedido(s)`
      },
      concentracao > 60 && {
        tipo: 'danger', icone: 'alert-triangle',
        titulo: 'Concentração de Receita',
        texto: `Os 2 maiores clientes concentram ${concentracao}% da receita — risco de dependência.`,
        valor: `${concentracao}% de concentração`
      }
    ].filter(Boolean);
  }

  /* ─────────────────────────────────────────────────────
     GERADOR DE RESUMO EXECUTIVO
  ───────────────────────────────────────────────────── */
  const resumoTemplates = {
    clientes(dados) {
      const { clientes, pedidos } = dados;
      const va = analisarVendas(dados);
      const topC = topEntry(va.receitaPorCliente);
      const ativos = clientes.filter(c => c.ativo).length;
      return [
        `A base de clientes conta com <strong>${clientes.length} cadastros</strong>, dos quais <strong>${ativos} estão ativos</strong>. O portfólio é diversificado em ${new Set(clientes.map(c => c.segmento)).size} segmentos de mercado.`,
        topC ? `O cliente de maior relevância financeira é <strong>${topC.key}</strong>, responsável por <strong>${formatMoeda(topC.value)}</strong> em pedidos, demonstrando sólido relacionamento comercial.` : '',
        `A análise dos ${pedidos.length} pedidos registrados aponta uma receita total de <strong>${formatMoeda(va.receitaTotal)}</strong>, com ticket médio de <strong>${formatMoeda(va.ticketMedio)}</strong> por pedido.`
      ].filter(Boolean);
    },
    produtos(dados) {
      const pa = analisarProdutos(dados);
      const mv = pa.sort((a, b) => b.qtdVendida - a.qtdVendida)[0];
      const mm = [...pa].sort((a, b) => b.margem - a.margem)[0];
      const ativos = dados.produtos.filter(p => p.ativo).length;
      return [
        `O portfólio possui <strong>${dados.produtos.length} produtos</strong>, sendo <strong>${ativos} ativos</strong>. Os itens estão distribuídos em ${new Set(dados.produtos.map(p => p.categoria)).size} categorias.`,
        mv && mv.qtdVendida > 0 ? `O produto com maior volume de vendas é <strong>${mv.nome}</strong> com <strong>${mv.qtdVendida} unidades</strong> comercializadas, indicando forte demanda de mercado.` : '',
        mm ? `A maior margem de contribuição pertence ao <strong>${mm.nome}</strong> com <strong>${mm.margem}%</strong>, sendo o produto mais rentável do portfólio atual.` : ''
      ].filter(Boolean);
    },
    estoque(dados) {
      const ea = analisarEstoque(dados);
      const criticos = ea.filter(e => e.criticidade === 'critico' || e.criticidade === 'baixo');
      const valorTotal = ea.reduce((s, e) => s + e.valorEstoque, 0);
      return [
        `O estoque conta com <strong>${ea.length} itens monitorados</strong> em ${new Set(ea.map(e => e.deposito)).size} depósito(s), com valor total imobilizado de <strong>${formatMoeda(valorTotal)}</strong>.`,
        criticos.length > 0
          ? `<strong>${criticos.length} produto(s)</strong> apresentam situação crítica de estoque, exigindo atenção imediata da equipe de suprimentos para evitar rupturas.`
          : `Todos os produtos estão dentro dos limites de estoque estabelecidos. Situação controlada.`,
        `Recomenda-se revisão periódica dos pontos de reposição e análise do giro para otimização do capital imobilizado.`
      ];
    },
    funcionarios(dados) {
      const ativos = dados.funcionarios.filter(f => f.ativo).length;
      const massa  = dados.funcionarios.filter(f => f.ativo).reduce((s, f) => s + f.salario, 0);
      const setores = new Set(dados.funcionarios.map(f => f.setor)).size;
      const mediaAv  = dados.funcionarios.reduce((s, f) => s + f.avaliacao, 0) / dados.funcionarios.length;
      return [
        `O quadro de colaboradores conta com <strong>${dados.funcionarios.length} registros</strong>, sendo <strong>${ativos} ativos</strong> distribuídos em <strong>${setores} setores</strong>.`,
        `A massa salarial mensal dos colaboradores ativos totaliza <strong>${formatMoeda(massa)}</strong>, com salário médio de <strong>${formatMoeda(massa / ativos)}</strong>.`,
        `A avaliação média da equipe é de <strong>${mediaAv.toFixed(1)} / 5.0</strong>, indicando um time engajado e de alto nível de performance.`
      ];
    },
    notasFiscais(dados) {
      const nfs = analisarNFs(dados);
      const total = nfs.reduce((s, n) => s + n.valor, 0);
      const imp   = nfs.reduce((s, n) => s + n.impostos, 0);
      const pend  = nfs.filter(n => n.status !== 'Autorizada').length;
      return [
        `Foram emitidas <strong>${nfs.length} notas fiscais</strong> no período analisado, totalizando um faturamento de <strong>${formatMoeda(total)}</strong>.`,
        `A carga tributária incidente representou <strong>${formatMoeda(imp)}</strong> (${((imp/total)*100).toFixed(1)}% do faturamento), dentro dos parâmetros esperados para o setor.`,
        pend > 0
          ? `<strong>${pend} nota(s)</strong> estão com status Pendente, necessitando acompanhamento para regularização junto à Receita.`
          : `Todas as notas fiscais emitidas foram devidamente autorizadas, sem pendências no período.`
      ];
    },
    vendas(dados) {
      const va = analisarVendas(dados);
      const topC = topEntry(va.receitaPorCliente);
      const topP = topEntry(va.qtdPorProduto);
      return [
        `O período registrou <strong>${va.pedidosEnriquecidos.length} pedidos</strong>, gerando receita total de <strong>${formatMoeda(va.receitaTotal)}</strong> com ticket médio de <strong>${formatMoeda(va.ticketMedio)}</strong>.`,
        topC ? `O cliente <strong>${topC.key}</strong> foi o maior comprador do período com <strong>${formatMoeda(topC.value)}</strong> em pedidos, representando relacionamento estratégico.` : '',
        topP ? `O produto mais solicitado foi <strong>${topP.key}</strong> com <strong>${topP.value} unidades</strong>, sugerindo alta demanda e necessidade de manutenção de estoque.` : '',
        va.emAberto > 0 ? `Há <strong>${va.emAberto} pedido(s)</strong> ainda em processamento ou trânsito, que devem ser acompanhados pela equipe operacional.` : ''
      ].filter(Boolean);
    }
  };

  /* ─────────────────────────────────────────────────────
     GERADOR DE RECOMENDAÇÕES
  ───────────────────────────────────────────────────── */
  const recomendacoesTemplates = {
    clientes(dados) {
      const { clientes } = dados;
      const inativos = clientes.filter(c => !c.ativo);
      const va    = analisarVendas(dados);
      const topC  = topEntry(va.receitaPorCliente);
      const recs  = [];
      if (inativos.length)
        recs.push(`Desenvolva uma <strong>campanha de reativação</strong> para os ${inativos.length} cliente(s) inativo(s), com ofertas personalizadas baseadas no histórico de compras.`);
      if (topC && va.receitaTotal > 0 && (va.receitaPorCliente[topC.key] / va.receitaTotal) > 0.35)
        recs.push(`O cliente <strong>${topC.key}</strong> concentra mais de 35% da receita. Diversifique a carteira para reduzir risco de dependência.`);
      recs.push(`Implemente um <strong>programa de fidelidade</strong> segmentado por volume de compras para incentivar recorrência.`);
      recs.push(`Revise os <strong>limites de crédito</strong> dos clientes ativos com base no histórico de pedidos dos últimos 12 meses.`);
      return recs.slice(0, 4);
    },
    produtos(dados) {
      const pa = analisarProdutos(dados);
      const semVenda = pa.filter(p => p.qtdVendida === 0 && p.ativo);
      const baixaMargem = pa.filter(p => p.margem < 20 && p.ativo);
      const recs = [];
      if (semVenda.length)
        recs.push(`<strong>${semVenda.length} produto(s)</strong> ativos não registraram vendas. Considere estratégias de liquidação ou revisão de precificação.`);
      if (baixaMargem.length)
        recs.push(`<strong>${baixaMargem.length} produto(s)</strong> possuem margem abaixo de 20%. Reavalie a estrutura de custos ou ajuste os preços.`);
      recs.push(`Concentre o <strong>esforço de vendas</strong> nos produtos com maior margem e giro simultâneos para maximizar o resultado.`);
      recs.push(`Realize análise de <strong>curva ABC</strong> para priorizar o mix de produtos e eliminar itens com baixa contribuição.`);
      return recs.slice(0, 4);
    },
    estoque(dados) {
      const ea = analisarEstoque(dados);
      const criticos = ea.filter(e => e.criticidade === 'critico');
      const baixos   = ea.filter(e => e.criticidade === 'baixo');
      const altos    = ea.filter(e => e.criticidade === 'alto');
      const recs = [];
      if (criticos.length)
        recs.push(`<strong>Emergência:</strong> ${criticos.map(e => e.nomeProduto).join(', ')} está(ão) com estoque zerado. Emita pedido de compra imediatamente.`);
      if (baixos.length)
        recs.push(`Programe <strong>reposição urgente</strong> para: ${baixos.map(e => e.nomeProduto).join(', ')}.`);
      if (altos.length)
        recs.push(`Avalie <strong>promoções ou redistribuição</strong> dos itens acima do estoque máximo para liberar capital de giro.`);
      recs.push(`Defina <strong>alertas automáticos</strong> de reposição para produtos críticos vinculados ao ponto de pedido ideal.`);
      return recs.slice(0, 4);
    },
    funcionarios(dados) {
      const { funcionarios } = dados;
      const baixaAv = funcionarios.filter(f => f.ativo && f.avaliacao < 4.0);
      const recs = [];
      if (baixaAv.length)
        recs.push(`<strong>${baixaAv.length} colaborador(es)</strong> com avaliação abaixo de 4.0. Priorize Plano de Desenvolvimento Individual (PDI).`);
      recs.push(`Realize <strong>ciclos de feedback 360°</strong> semestrais para manter alinhamento e motivação do time.`);
      recs.push(`Analise o <strong>perfil salarial por cargo</strong> frente ao mercado para garantir competitividade na retenção de talentos.`);
      recs.push(`Implemente <strong>programa de meritocracia</strong> ligando avaliações de desempenho a bonificações variáveis.`);
      return recs.slice(0, 4);
    },
    notasFiscais(dados) {
      const nfs    = analisarNFs(dados);
      const pend   = nfs.filter(n => n.status !== 'Autorizada');
      const total  = nfs.reduce((s, n) => s + n.valor, 0);
      const imp    = nfs.reduce((s, n) => s + n.impostos, 0);
      const recs   = [];
      if (pend.length)
        recs.push(`Regularize as <strong>${pend.length} nota(s) pendente(s)</strong> para evitar problemas fiscais e atrasos no fluxo de caixa.`);
      if ((imp / total) > 0.20)
        recs.push(`A carga tributária está acima de 20%. Avalie com a <strong>consultoria fiscal</strong> possibilidades de planejamento tributário.`);
      recs.push(`Automatize a <strong>conciliação de NFs</strong> com pedidos para garantir rastreabilidade completa do faturamento.`);
      recs.push(`Implemente validação prévia de <strong>dados do tomador</strong> para reduzir rejeições e retrabalhos na emissão.`);
      return recs.slice(0, 4);
    },
    vendas(dados) {
      const va = analisarVendas(dados);
      const topC = topEntry(va.receitaPorCliente);
      const recs = [];
      if (va.emAberto > 0)
        recs.push(`Priorize a conclusão dos <strong>${va.emAberto} pedidos em aberto</strong> para antecipar o reconhecimento de receita.`);
      if (topC && (va.receitaPorCliente[topC.key] / va.receitaTotal) > 0.3)
        recs.push(`A concentração em <strong>${topC.key}</strong> é elevada. Diversifique a carteira comercial para reduzir risco.`);
      recs.push(`Estabeleça <strong>metas individuais por vendedor</strong> com base no histórico de pedidos e no potencial de cada carteira.`);
      recs.push(`Analise o <strong>ciclo de vendas médio</strong> e identifique gargalos no funil para aumentar a velocidade de fechamento.`);
      return recs.slice(0, 4);
    }
  };

  /* ─────────────────────────────────────────────────────
     UTILITÁRIOS
  ───────────────────────────────────────────────────── */
  function topEntry(obj) {
    if (!obj || !Object.keys(obj).length) return null;
    const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    return { key: sorted[0][0], value: sorted[0][1] };
  }

  function contarPorCampo(arr, campo) {
    return arr.reduce((acc, item) => {
      const v = item[campo];
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {});
  }

  function formatMoeda(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  }

  /* ─────────────────────────────────────────────────────
     API PÚBLICA
  ───────────────────────────────────────────────────── */
  function gerarInsights(reportKey, dados, filtros, pergunta) {
    const gerador = {
      clientes:     gerarInsightsClientes,
      produtos:     gerarInsightsProdutos,
      estoque:      gerarInsightsEstoque,
      funcionarios: gerarInsightsFuncionarios,
      notasFiscais: gerarInsightsNFs,
      vendas:       gerarInsightsVendas
    }[reportKey];

    let insights = gerador ? gerador(dados, filtros) : [];

    // Tratar pergunta do usuário
    if (pergunta && pergunta.trim()) {
      const intencao = interpretarPergunta(pergunta, reportKey);
      if (intencao) {
        const handler = intentHandlers[intencao.handler];
        if (handler) {
          let resultado = null;
          if (['getMaisVendido','getClienteTop','getFuncionarioDestaque'].includes(intencao.handler)) {
            resultado = handler(analisarVendas(dados));
          } else if (intencao.handler === 'getEstoqueBaixo') {
            resultado = handler(analisarEstoque(dados));
          } else if (intencao.handler === 'getMaiorNF') {
            resultado = handler(analisarNFs(dados));
          } else if (intencao.handler === 'getMaiorMargem') {
            resultado = handler(analisarProdutos(dados));
          }
          if (resultado) {
            resultado._isPerguntaResult = true;
            insights = [resultado, ...insights.slice(0, 5)];
          }
        }
      } else {
        // Resposta genérica quando não identifica intenção
        insights.unshift({
          tipo: 'info', icone: 'message-square-more',
          titulo: 'Análise da Pergunta',
          texto: `Com base nos dados disponíveis para "${pergunta}": não foi possível mapear uma intenção específica, mas os insights abaixo cobrem os principais indicadores.`,
          valor: ''
        });
      }
    }

    return insights;
  }

  function gerarResumo(reportKey, dados) {
    const fn = resumoTemplates[reportKey];
    return fn ? fn(dados) : [`Dados do relatório de ${reportKey} analisados com sucesso.`];
  }

  function gerarRecomendacoes(reportKey, dados) {
    const fn = recomendacoesTemplates[reportKey];
    return fn ? fn(dados) : [`Revise periodicamente os dados para identificar oportunidades de melhoria.`];
  }

  function calcularKPIs(reportKey, dados) {
    if (reportKey === 'clientes') {
      const va = analisarVendas(dados);
      return {
        totalClientes:  dados.clientes.length,
        clientesAtivos: dados.clientes.filter(c => c.ativo).length,
        totalPedidos:   dados.pedidos.length,
        receitaTotal:   va.receitaTotal
      };
    }
    if (reportKey === 'produtos') {
      const pa = analisarProdutos(dados);
      const mm = pa.reduce((max, p) => p.margem > max ? p.margem : max, 0);
      const rec = pa.reduce((s, p) => s + p.receitaGerada, 0);
      return {
        totalProdutos:   dados.produtos.length,
        produtosAtivos:  dados.produtos.filter(p => p.ativo).length,
        maiorMargem:     `${mm.toFixed(1)}%`,
        receitaProdutos: rec
      };
    }
    if (reportKey === 'estoque') {
      const ea = analisarEstoque(dados);
      const val = ea.reduce((s, e) => s + e.valorEstoque, 0);
      return {
        itensEstoque:  ea.length,
        abaixoMinimo:  ea.filter(e => e.criticidade === 'baixo').length,
        semEstoque:    ea.filter(e => e.criticidade === 'critico').length,
        valorEstoque:  val
      };
    }
    if (reportKey === 'funcionarios') {
      const ativos = dados.funcionarios.filter(f => f.ativo);
      const massa  = ativos.reduce((s, f) => s + f.salario, 0);
      const set    = new Set(dados.funcionarios.map(f => f.setor)).size;
      return {
        totalFuncionarios: dados.funcionarios.length,
        ativos:            ativos.length,
        setores:           set,
        massaSalarial:     massa
      };
    }
    if (reportKey === 'notasFiscais') {
      const nfs = dados.notasFiscais;
      return {
        totalNFs:      nfs.length,
        valorTotalNFs: nfs.reduce((s, n) => s + n.valor, 0),
        totalImpostos: nfs.reduce((s, n) => s + n.impostos, 0),
        nfsPendentes:  nfs.filter(n => n.status !== 'Autorizada').length
      };
    }
    if (reportKey === 'vendas') {
      const va = analisarVendas(dados);
      return {
        totalPedidos:   dados.pedidos.length,
        receitaTotal:   va.receitaTotal,
        ticketMedio:    va.ticketMedio,
        pedidosAbertos: va.emAberto
      };
    }
    return {};
  }

  function getChartData(reportKey, dados) {
    if (reportKey === 'clientes') {
      const seg = contarPorCampo(dados.clientes, 'segmento');
      const va  = analisarVendas(dados);
      return {
        bar:  { labels: Object.keys(va.receitaPorCliente), values: Object.values(va.receitaPorCliente), title: 'Receita por Cliente' },
        pie:  { labels: Object.keys(seg), values: Object.values(seg), title: 'Clientes por Segmento' }
      };
    }
    if (reportKey === 'produtos') {
      const pa  = analisarProdutos(dados);
      const cat = {};
      pa.forEach(p => { cat[p.categoria] = (cat[p.categoria] || 0) + p.receitaGerada; });
      const sorted = pa.filter(p => p.qtdVendida > 0).sort((a, b) => b.qtdVendida - a.qtdVendida).slice(0, 8);
      return {
        bar:  { labels: sorted.map(p => p.nome.split(' ').slice(0,2).join(' ')), values: sorted.map(p => p.qtdVendida), title: 'Volume de Vendas por Produto' },
        pie:  { labels: Object.keys(cat), values: Object.values(cat), title: 'Receita por Categoria' }
      };
    }
    if (reportKey === 'estoque') {
      const ea  = analisarEstoque(dados);
      const crit = contarPorCampo(ea, 'criticidade');
      const sorted = ea.sort((a, b) => b.quantidade - a.quantidade).slice(0, 8);
      return {
        bar:  { labels: sorted.map(e => e.nomeProduto.split(' ').slice(0,2).join(' ')), values: sorted.map(e => e.quantidade), title: 'Quantidade em Estoque por Produto' },
        pie:  { labels: Object.keys(crit).map(k => ({ critico:'Crítico',baixo:'Abaixo Mín.',normal:'Normal',alto:'Acima Máx.' }[k] || k)), values: Object.values(crit), title: 'Distribuição por Criticidade' }
      };
    }
    if (reportKey === 'funcionarios') {
      const setores = contarPorCampo(dados.funcionarios.filter(f => f.ativo), 'setor');
      const salPorSetor = {};
      dados.funcionarios.filter(f => f.ativo).forEach(f => {
        salPorSetor[f.setor] = (salPorSetor[f.setor] || 0) + f.salario;
      });
      return {
        pie:  { labels: Object.keys(setores), values: Object.values(setores), title: 'Colaboradores por Setor' },
        bar:  { labels: Object.keys(salPorSetor), values: Object.values(salPorSetor), title: 'Massa Salarial por Setor' }
      };
    }
    if (reportKey === 'notasFiscais') {
      const nfs = analisarNFs(dados);
      const porMes = {};
      nfs.forEach(nf => {
        const mes = nf.data.substring(0, 7);
        porMes[mes] = (porMes[mes] || 0) + nf.valor;
      });
      const status = contarPorCampo(nfs, 'status');
      return {
        bar:   { labels: Object.keys(porMes), values: Object.values(porMes), title: 'Faturamento por Mês' },
        pie:   { labels: Object.keys(status), values: Object.values(status), title: 'NFs por Status' }
      };
    }
    if (reportKey === 'vendas') {
      const va = analisarVendas(dados);
      const topClientes = Object.entries(va.receitaPorCliente).sort((a,b)=>b[1]-a[1]).slice(0,6);
      const topProd = Object.entries(va.qtdPorProduto).sort((a,b)=>b[1]-a[1]).slice(0,6);
      return {
        bar:  { labels: topClientes.map(e=>e[0].split(' ')[0]), values: topClientes.map(e=>e[1]), title: 'Receita por Cliente' },
        pie:  { labels: topProd.map(e=>e[0].split(' ').slice(0,2).join(' ')), values: topProd.map(e=>e[1]), title: 'Volume por Produto' }
      };
    }
    return {};
  }

  return { gerarInsights, gerarResumo, gerarRecomendacoes, calcularKPIs, getChartData, analisarEstoque, analisarNFs, analisarVendas, analisarProdutos };
})();
