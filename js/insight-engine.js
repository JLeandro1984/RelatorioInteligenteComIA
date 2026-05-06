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
    },
    {
      id: 'itens_ativos',
      palavrasChave: [
        'itens ativos',
        'liste os itens ativos',
        'listar itens ativos',
        'mostre os ativos',
        'quais estao ativos',
        'quais estão ativos',
        'somente ativos',
        'apenas ativos'
      ],
      contextos: ['clientes', 'produtos', 'funcionarios', 'estoque', 'vendas', 'notasFiscais', 'acoes'],
      handler: 'getItensAtivos'
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
    },

    getItensAtivos(payload) {
      const { reportKey, dados } = payload || {};
      if (!reportKey || !dados) return null;

      let ativos = [];
      let label = 'itens';

      if (reportKey === 'clientes') {
        ativos = (dados.clientes || []).filter(c => c.ativo).map(c => c.nome);
        label = 'clientes';
      } else if (reportKey === 'produtos') {
        ativos = (dados.produtos || []).filter(p => p.ativo).map(p => p.nome);
        label = 'produtos';
      } else if (reportKey === 'funcionarios') {
        ativos = (dados.funcionarios || []).filter(f => f.ativo).map(f => f.nome);
        label = 'colaboradores';
      } else if (reportKey === 'estoque') {
        ativos = (analisarEstoque(dados) || []).filter(e => e.quantidade > 0).map(e => e.nomeProduto);
        label = 'itens em estoque';
      } else if (reportKey === 'vendas') {
        ativos = (dados.pedidos || []).filter(p => p.status !== 'Cancelado').map(p => p.id);
        label = 'pedidos ativos';
      } else if (reportKey === 'notasFiscais') {
        ativos = (dados.notasFiscais || []).filter(nf => nf.status === 'Autorizada').map(nf => nf.id);
        label = 'NFs autorizadas';
      } else if (reportKey === 'acoes') {
        ativos = (dados.acoes || [])
          .filter(a => !['Cancelado', 'Pagamento Recusado'].includes(a.status))
          .map(a => a.numAcao);
        label = 'ações ativas';
      }

      const exemplos = ativos.slice(0, 6).join(', ');
      return {
        tipo: 'info', icone: 'check-circle',
        titulo: 'Itens Ativos',
        texto: `Foram identificados ${ativos.length} ${label} no contexto atual.`,
        valor: exemplos ? exemplos : 'Nenhum item ativo encontrado.'
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

  /* ─────────────────────────────────────────────────────
     GERADOR DE INSIGHTS — AÇÕES COMERCIAIS
  ───────────────────────────────────────────────────── */
  function gerarInsightsAcoes(dados) {
    const acoes      = dados.acoes || [];
    const valorTotal = acoes.reduce((s, a) => s + a.valorAcao, 0);
    const pagas      = acoes.filter(a => a.status === 'Pago');
    const pendentes  = acoes.filter(a => a.status.startsWith('Aguardando'));
    const canceladas = acoes.filter(a => a.status === 'Cancelado');
    const recusadas  = acoes.filter(a => a.status === 'Pagamento Recusado');

    const valorPorDir = {};
    acoes.forEach(a => { valorPorDir[a.diretoria] = (valorPorDir[a.diretoria] || 0) + a.valorAcao; });
    const topDir  = topEntry(valorPorDir);
    const topResp = topEntry(contarPorCampo(acoes, 'responsavel'));

    const hoje = new Date().toISOString().split('T')[0];
    const STATUS_ABERTO = ['Comprometido','Aguardando aprovação da ação','Aguardando Liberação de verba','Aguardando Acordo','Aguardando Comprovação'];
    const atrasadas = acoes.filter(a => a.dataFinal < hoje && STATUS_ABERTO.includes(a.status));

    return [
      {
        tipo: 'purple', icone: 'target',
        titulo: 'Visão Geral das Ações',
        texto: `Total de ${acoes.length} ação(ões) comercial(is) registrada(s), com valor consolidado de ${formatMoeda(valorTotal)}.`,
        valor: formatMoeda(valorTotal)
      },
      pagas.length > 0 && {
        tipo: 'success', icone: 'check-circle',
        titulo: 'Ações Pagas',
        texto: `${pagas.length} ação(ões) com status "Pago". Valor realizado: ${formatMoeda(pagas.reduce((s, a) => s + a.valorAcao, 0))}.`,
        valor: `${pagas.length} paga(s)`
      },
      pendentes.length > 0 && {
        tipo: 'warning', icone: 'clock',
        titulo: 'Aguardando Aprovação ou Comprovação',
        texto: `${pendentes.length} ação(ões) em status de espera. Verifique o fluxo de aprovação para evitar atrasos.`,
        valor: `${pendentes.length} pendente(s)`
      },
      topDir && {
        tipo: 'blue', icone: 'layers',
        titulo: 'Diretoria com Maior Volume',
        texto: `A diretoria "${topDir.key}" concentra o maior valor em ações comerciais no período.`,
        valor: formatMoeda(topDir.value)
      },
      topResp && {
        tipo: 'info', icone: 'user-check',
        titulo: 'Responsável Mais Ativo',
        texto: `${topResp.key} é o responsável com mais ações cadastradas no período.`,
        valor: `${topResp.value} ação(ões)`
      },
      atrasadas.length > 0 && {
        tipo: 'danger', icone: 'alert-triangle',
        titulo: 'Ações com Prazo Vencido',
        texto: `${atrasadas.length} ação(ões) com data final já ultrapassada e status ainda pendente. Requer ação imediata.`,
        valor: `${atrasadas.length} atrasada(s)`
      },
      (canceladas.length + recusadas.length) > 0 && {
        tipo: 'danger', icone: 'x-circle',
        titulo: 'Ações Não Efetivadas',
        texto: `${canceladas.length} ação(ões) cancelada(s) e ${recusadas.length} com pagamento recusado no período.`,
        valor: `${canceladas.length + recusadas.length} não efetivada(s)`
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
    },
    acoes(dados) {
      const acoes      = dados.acoes || [];
      const valorTotal = acoes.reduce((s, a) => s + a.valorAcao, 0);
      const pagas      = acoes.filter(a => a.status === 'Pago');
      const valorPago  = pagas.reduce((s, a) => s + a.valorAcao, 0);
      const dirs       = new Set(acoes.map(a => a.diretoria)).size;
      return [
        `O período conta com <strong>${acoes.length} ações comerciais</strong> registradas em <strong>${dirs} diretoria(s)</strong>, totalizando <strong>${formatMoeda(valorTotal)}</strong> em valor comprometido.`,
        pagas.length > 0
          ? `Das ações registradas, <strong>${pagas.length}</strong> foram efetivamente pagas, representando <strong>${formatMoeda(valorPago)}</strong> (${valorTotal > 0 ? ((valorPago / valorTotal) * 100).toFixed(1) : 0}% do total).`
          : `Nenhuma ação foi marcada como paga até o momento. Verifique o fluxo de aprovação e liberação de verba.`,
        `A gestão das ações exige atenção ao fluxo de aprovação e comprovação para garantir a execução dentro dos prazos e orçamentos definidos.`
      ];
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
    },
    acoes(dados) {
      const acoes = dados.acoes || [];
      const STATUS_ABERTO = ['Comprometido','Aguardando aprovação da ação','Aguardando Liberação de verba','Aguardando Acordo','Aguardando Comprovação'];
      const hoje      = new Date().toISOString().split('T')[0];
      const pendentes = acoes.filter(a => a.status.startsWith('Aguardando'));
      const recusadas = acoes.filter(a => a.status === 'Pagamento Recusado');
      const atrasadas = acoes.filter(a => a.dataFinal < hoje && STATUS_ABERTO.includes(a.status));
      const recs = [];
      if (atrasadas.length)
        recs.push(`<strong>${atrasadas.length} ação(ões)</strong> com data final já vencida e status pendente. Priorize a conclusão ou renegocie o prazo com o responsável.`);
      if (pendentes.length)
        recs.push(`<strong>${pendentes.length} ação(ões)</strong> aguardando aprovação, verba ou comprovação. Identifique o gargalo no fluxo e acione as áreas responsáveis.`);
      if (recusadas.length)
        recs.push(`<strong>${recusadas.length} pagamento(s) recusado(s)</strong>. Investigue os motivos e encaminhe para reprocessamento junto à área financeira.`);
      recs.push(`Mantenha <strong>ciclos de revisão semanais</strong> das ações comprometidas para garantir alinhamento entre responsáveis e metas de diretoria.`);
      recs.push(`Implemente <strong>alertas automáticos de vencimento</strong> para ações próximas ao prazo final, evitando descumprimentos de agenda.`);
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
      vendas:       gerarInsightsVendas,
      acoes:        gerarInsightsAcoes
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
          } else if (intencao.handler === 'getItensAtivos') {
            const d = _aplicarFiltros(reportKey, dados, filtros || {});
            resultado = handler({ reportKey, dados: d });
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

  function gerarResumo(reportKey, dados, filtros = {}) {
    const d = _aplicarFiltros(reportKey, dados, filtros);
    const fn = resumoTemplates[reportKey];
    return fn ? fn(d) : [`Dados do relatório de ${reportKey} analisados com sucesso.`];
  }

  function gerarRecomendacoes(reportKey, dados, filtros = {}) {
    const d = _aplicarFiltros(reportKey, dados, filtros);
    const fn = recomendacoesTemplates[reportKey];
    return fn ? fn(d) : [`Revise periodicamente os dados para identificar oportunidades de melhoria.`];
  }

  /* ─────────────────────────────────────────────────────
     FILTRO AUXILIAR — aplica os mesmos critérios usados
     em enriquecerDados para KPIs e gráficos
  ───────────────────────────────────────────────────── */
  function _aplicarFiltros(reportKey, dados, filtros) {
    if (!filtros || !Object.keys(filtros).length) return dados;
    const d = { ...dados };
    if (reportKey === 'clientes') {
      d.clientes = dados.clientes.filter(c => {
        if (filtros.segmento && c.segmento !== filtros.segmento) return false;
        if (filtros.estado   && c.estado   !== filtros.estado)   return false;
        if (filtros.ativo !== undefined && filtros.ativo !== '' &&
            String(c.ativo) !== filtros.ativo) return false;
        return true;
      });
    } else if (reportKey === 'produtos') {
      d.produtos = dados.produtos.filter(p => {
        if (filtros.categoria && p.categoria !== filtros.categoria) return false;
        if (filtros.marca     && p.marca     !== filtros.marca)     return false;
        if (filtros.ativo !== undefined && filtros.ativo !== '' &&
            String(p.ativo) !== filtros.ativo) return false;
        return true;
      });
    } else if (reportKey === 'estoque') {
      const ea       = analisarEstoque(dados);
      const filtered = ea.filter(e => {
        if (filtros.deposito    && e.deposito    !== filtros.deposito)    return false;
        if (filtros.criticidade && e.criticidade !== filtros.criticidade) return false;
        return true;
      });
      const ids = new Set(filtered.map(e => e.produtoId));
      d.estoque = dados.estoque.filter(e => ids.has(e.produtoId));
    } else if (reportKey === 'funcionarios') {
      d.funcionarios = dados.funcionarios.filter(f => {
        if (filtros.setor  && f.setor  !== filtros.setor)  return false;
        if (filtros.estado && f.estado !== filtros.estado) return false;
        if (filtros.ativo !== undefined && filtros.ativo !== '' &&
            String(f.ativo) !== filtros.ativo) return false;
        return true;
      });
    } else if (reportKey === 'notasFiscais') {
      d.notasFiscais = dados.notasFiscais.filter(nf => {
        if (filtros.status && nf.status !== filtros.status) return false;
        if (filtros.mes    && !nf.data.startsWith(`2026-${filtros.mes}`)) return false;
        return true;
      });
    } else if (reportKey === 'vendas') {
      d.pedidos = dados.pedidos.filter(p => {
        if (filtros.status && p.status !== filtros.status) return false;
        if (filtros.mes    && !p.data.startsWith(`2026-${filtros.mes}`)) return false;
        return true;
      });
  } else if (reportKey === 'acoes') {
    d.acoes = (dados.acoes || []).filter(a => {
      if (filtros.status      && a.status      !== filtros.status)      return false;
      if (filtros.diretoria   && a.diretoria   !== filtros.diretoria)   return false;
      if (filtros.divisao     && a.divisao     !== filtros.divisao)     return false;
      if (filtros.responsavel && a.responsavel !== filtros.responsavel) return false;
      return true;
    });
  }
  return d;
}

  function calcularKPIs(reportKey, dados, filtros = {}) {
    const d = _aplicarFiltros(reportKey, dados, filtros);
    if (reportKey === 'clientes') {
      const va = analisarVendas(d);
      return {
        totalClientes:  d.clientes.length,
        clientesAtivos: d.clientes.filter(c => c.ativo).length,
        totalPedidos:   d.pedidos.length,
        receitaTotal:   va.receitaTotal
      };
    }
    if (reportKey === 'produtos') {
      const pa = analisarProdutos(d);
      const mm = pa.reduce((max, p) => p.margem > max ? p.margem : max, 0);
      const rec = pa.reduce((s, p) => s + p.receitaGerada, 0);
      return {
        totalProdutos:   d.produtos.length,
        produtosAtivos:  d.produtos.filter(p => p.ativo).length,
        maiorMargem:     `${mm.toFixed(1)}%`,
        receitaProdutos: rec
      };
    }
    if (reportKey === 'estoque') {
      const ea = analisarEstoque(d);
      const val = ea.reduce((s, e) => s + e.valorEstoque, 0);
      return {
        itensEstoque:  ea.length,
        abaixoMinimo:  ea.filter(e => e.criticidade === 'baixo').length,
        semEstoque:    ea.filter(e => e.criticidade === 'critico').length,
        valorEstoque:  val
      };
    }
    if (reportKey === 'funcionarios') {
      const ativos = d.funcionarios.filter(f => f.ativo);
      const massa  = ativos.reduce((s, f) => s + f.salario, 0);
      const set    = new Set(d.funcionarios.map(f => f.setor)).size;
      return {
        totalFuncionarios: d.funcionarios.length,
        ativos:            ativos.length,
        setores:           set,
        massaSalarial:     massa
      };
    }
    if (reportKey === 'notasFiscais') {
      const nfs = d.notasFiscais;
      return {
        totalNFs:      nfs.length,
        valorTotalNFs: nfs.reduce((s, n) => s + n.valor, 0),
        totalImpostos: nfs.reduce((s, n) => s + n.impostos, 0),
        nfsPendentes:  nfs.filter(n => n.status !== 'Autorizada').length
      };
    }
    if (reportKey === 'vendas') {
      const va = analisarVendas(d);
      return {
        totalPedidos:   d.pedidos.length,
        receitaTotal:   va.receitaTotal,
        ticketMedio:    va.ticketMedio,
        pedidosAbertos: va.emAberto
      };
    }
    if (reportKey === 'acoes') {
      const acoes = d.acoes || [];
      const STATUS_ABERTO = ['Comprometido','Aguardando aprovação da ação','Aguardando Liberação de verba','Aguardando Acordo','Aguardando Comprovação'];
      return {
        totalAcoes:    acoes.length,
        valorTotal:    acoes.reduce((s, a) => s + a.valorAcao, 0),
        acoesPagas:    acoes.filter(a => a.status === 'Pago').length,
        acoesEmAberto: acoes.filter(a => STATUS_ABERTO.includes(a.status)).length
      };
    }
    return {};
  }

  function _monthShort(dateStr) {
    const m = String(dateStr || '').slice(5, 7);
    return {
      '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
      '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
    }[m] || '—';
  }

  function _buildHeatmapMatrix({ title, rowTitle, rows, cols, metrics, valueGetter, defaultMetric }) {
    const matrix = {};
    const kpis = {};

    metrics.forEach(metric => {
      const m = rows.map((row, rIdx) => cols.map((col, cIdx) => {
        const value = valueGetter(row, col, metric.key, rIdx, cIdx);
        return Number(value || 0);
      }));

      matrix[metric.key] = m;

      const flat = m.flat();
      const sum = flat.reduce((s, v) => s + v, 0);
      const avg = flat.length ? sum / flat.length : 0;
      let max = Number.NEGATIVE_INFINITY;
      let maxRow = rows[0] || '—';

      m.forEach((line, rIdx) => {
        line.forEach(v => {
          if (v > max) {
            max = v;
            maxRow = rows[rIdx] || '—';
          }
        });
      });

      const fmt = metric.format || 'number';
      const asNumber = v => new Intl.NumberFormat('pt-BR').format(v || 0);
      const asCurrency = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v || 0);
      const asPercent = v => `${Number(v || 0).toFixed(1)}%`;

      const formatter = fmt === 'currency' ? asCurrency : (fmt === 'percent' ? asPercent : asNumber);

      kpis[metric.key] = [
        { label: metric.kpiLabels?.[0] || 'Total', value: formatter(sum) },
        { label: metric.kpiLabels?.[1] || 'Média', value: formatter(avg) },
        { label: metric.kpiLabels?.[2] || 'Maior ponto', value: formatter(Number.isFinite(max) ? max : 0) },
        { label: metric.kpiLabels?.[3] || 'Linha de destaque', value: maxRow }
      ];
    });

    return {
      title,
      rowTitle,
      rows,
      cols,
      metrics,
      matrix,
      kpis,
      defaultMetric: defaultMetric || metrics[0]?.key
    };
  }

  function getChartData(reportKey, dados, filtros = {}) {
    const d = _aplicarFiltros(reportKey, dados, filtros);
    if (reportKey === 'clientes') {
      const seg = contarPorCampo(d.clientes, 'segmento');
      const va  = analisarVendas(d);
      const rows = Object.keys(seg);
      const cols = [...new Set((d.clientes || []).map(c => c.estado))].sort();
      const bySegUf = {};
      const creditBySegUf = {};

      (d.clientes || []).forEach(c => {
        const key = `${c.segmento}__${c.estado}`;
        bySegUf[key] = (bySegUf[key] || 0) + 1;
        creditBySegUf[key] = (creditBySegUf[key] || 0) + (c.limiteCredito || 0);
      });

      return {
        bar:  { labels: Object.keys(va.receitaPorCliente), values: Object.values(va.receitaPorCliente), title: 'Receita por Cliente' },
        pie:  { labels: Object.keys(seg), values: Object.values(seg), title: 'Clientes por Segmento' },
        heatmap: _buildHeatmapMatrix({
          title: 'Heatmap de clientes por segmento e estado',
          rowTitle: 'Segmento',
          rows,
          cols,
          metrics: [
            { key: 'qtd', label: 'Quantidade de clientes', format: 'number', kpiLabels: ['Total de clientes', 'Média por célula', 'Maior célula', 'Segmento destaque'] },
            { key: 'credito', label: 'Limite de crédito (R$)', format: 'currency', kpiLabels: ['Crédito total', 'Média por célula', 'Maior célula', 'Segmento destaque'] }
          ],
          valueGetter: (row, col, metricKey) => {
            const key = `${row}__${col}`;
            if (metricKey === 'credito') return creditBySegUf[key] || 0;
            return bySegUf[key] || 0;
          },
          defaultMetric: 'qtd'
        })
      };
    }
    if (reportKey === 'produtos') {
      const pa  = analisarProdutos(d);
      const cat = {};
      pa.forEach(p => { cat[p.categoria] = (cat[p.categoria] || 0) + p.receitaGerada; });
      const sorted = pa.filter(p => p.qtdVendida > 0).sort((a, b) => b.qtdVendida - a.qtdVendida).slice(0, 8);

      const produtoById = {};
      (d.produtos || []).forEach(p => { produtoById[p.id] = p; });
      const rows = sorted.slice(0, 6).map(p => p.nome.split(' ').slice(0, 2).join(' '));
      const rowId = sorted.slice(0, 6).map(p => p.id);
      const cols = [...new Set((d.pedidos || []).map(p => _monthShort(p.data)))];

      const productMetric = {};
      rowId.forEach(id => {
        productMetric[id] = {};
        cols.forEach(month => {
          productMetric[id][month] = { units: 0, revenue: 0, cost: 0 };
        });
      });

      (d.pedidos || []).forEach(pedido => {
        const month = _monthShort(pedido.data);
        (pedido.itens || []).forEach(item => {
          if (!rowId.includes(item.produtoId)) return;
          const prod = produtoById[item.produtoId];
          if (!prod) return;
          const slot = productMetric[item.produtoId][month] || { units: 0, revenue: 0, cost: 0 };
          slot.units += item.quantidade || 0;
          slot.revenue += (item.quantidade || 0) * (item.precoUnitario || prod.precoUnitario || 0);
          slot.cost += (item.quantidade || 0) * (prod.custo || 0);
          productMetric[item.produtoId][month] = slot;
        });
      });

      return {
        bar:  { labels: sorted.map(p => p.nome.split(' ').slice(0,2).join(' ')), values: sorted.map(p => p.qtdVendida), title: 'Volume de Vendas por Produto' },
        pie:  { labels: Object.keys(cat), values: Object.values(cat), title: 'Receita por Categoria' },
        heatmap: _buildHeatmapMatrix({
          title: 'Heatmap de vendas por produto e período',
          rowTitle: 'Produto',
          rows,
          cols,
          metrics: [
            { key: 'units', label: 'Unidades vendidas', format: 'number', kpiLabels: ['Total de unidades', 'Média por célula', 'Maior ponto', 'Top produto'] },
            { key: 'revenue', label: 'Receita (R$)', format: 'currency', kpiLabels: ['Receita total', 'Média por célula', 'Pico de receita', 'Top produto'] },
            { key: 'margin', label: 'Margem (%)', format: 'percent', kpiLabels: ['Margem acumulada', 'Margem média', 'Pico de margem', 'Top produto'] }
          ],
          valueGetter: (_, col, metricKey, rIdx) => {
            const id = rowId[rIdx];
            const slot = (productMetric[id] && productMetric[id][col]) || { units: 0, revenue: 0, cost: 0 };
            if (metricKey === 'units') return slot.units;
            if (metricKey === 'revenue') return slot.revenue;
            if (slot.revenue <= 0) return 0;
            return ((slot.revenue - slot.cost) / slot.revenue) * 100;
          },
          defaultMetric: 'margin'
        })
      };
    }
    if (reportKey === 'estoque') {
      const ea  = analisarEstoque(d);
      const crit = contarPorCampo(ea, 'criticidade');
      const sorted = ea.sort((a, b) => b.quantidade - a.quantidade).slice(0, 8);

      const rows = [...new Set((ea || []).map(e => e.deposito))].sort();
      const cols = ['Crítico', 'Abaixo Mín.', 'Normal', 'Acima Máx.'];
      const critLabel = { critico: 'Crítico', baixo: 'Abaixo Mín.', normal: 'Normal', alto: 'Acima Máx.' };
      const map = {};
      rows.forEach(dep => {
        map[dep] = {};
        cols.forEach(c => { map[dep][c] = { itens: 0, valor: 0 }; });
      });
      (ea || []).forEach(item => {
        const dep = item.deposito;
        const col = critLabel[item.criticidade] || item.criticidade;
        if (!map[dep] || !map[dep][col]) return;
        map[dep][col].itens += 1;
        map[dep][col].valor += item.valorEstoque || 0;
      });

      return {
        bar:  { labels: sorted.map(e => e.nomeProduto.split(' ').slice(0,2).join(' ')), values: sorted.map(e => e.quantidade), title: 'Quantidade em Estoque por Produto' },
        pie:  { labels: Object.keys(crit).map(k => ({ critico:'Crítico',baixo:'Abaixo Mín.',normal:'Normal',alto:'Acima Máx.' }[k] || k)), values: Object.values(crit), title: 'Distribuição por Criticidade' },
        heatmap: _buildHeatmapMatrix({
          title: 'Heatmap de estoque por depósito e criticidade',
          rowTitle: 'Depósito',
          rows,
          cols,
          metrics: [
            { key: 'itens', label: 'Itens por criticidade', format: 'number', kpiLabels: ['Total de itens', 'Média por célula', 'Maior célula', 'Depósito destaque'] },
            { key: 'valor', label: 'Valor em estoque (R$)', format: 'currency', kpiLabels: ['Valor total', 'Média por célula', 'Maior célula', 'Depósito destaque'] }
          ],
          valueGetter: (row, col, metricKey) => map[row]?.[col]?.[metricKey] || 0,
          defaultMetric: 'itens'
        })
      };
    }
    if (reportKey === 'funcionarios') {
      const setores = contarPorCampo(d.funcionarios.filter(f => f.ativo), 'setor');
      const salPorSetor = {};
      d.funcionarios.filter(f => f.ativo).forEach(f => {
        salPorSetor[f.setor] = (salPorSetor[f.setor] || 0) + f.salario;
      });

      const ativos = d.funcionarios.filter(f => f.ativo);
      const rows = [...new Set(ativos.map(f => f.setor))].sort();
      const cols = [...new Set(ativos.map(f => f.estado))].sort();
      const map = {};
      rows.forEach(setor => {
        map[setor] = {};
        cols.forEach(uf => { map[setor][uf] = { qtd: 0, salario: 0, avaliacao: 0 }; });
      });
      ativos.forEach(f => {
        map[f.setor][f.estado].qtd += 1;
        map[f.setor][f.estado].salario += f.salario || 0;
        map[f.setor][f.estado].avaliacao += f.avaliacao || 0;
      });

      return {
        pie:  { labels: Object.keys(setores), values: Object.values(setores), title: 'Colaboradores por Setor' },
        bar:  { labels: Object.keys(salPorSetor), values: Object.values(salPorSetor), title: 'Massa Salarial por Setor' },
        heatmap: _buildHeatmapMatrix({
          title: 'Heatmap de colaboradores por setor e estado',
          rowTitle: 'Setor',
          rows,
          cols,
          metrics: [
            { key: 'qtd', label: 'Colaboradores ativos', format: 'number', kpiLabels: ['Total de colaboradores', 'Média por célula', 'Maior célula', 'Setor destaque'] },
            { key: 'salario', label: 'Massa salarial (R$)', format: 'currency', kpiLabels: ['Massa salarial', 'Média por célula', 'Maior célula', 'Setor destaque'] },
            { key: 'avaliacao', label: 'Avaliação média', format: 'percent', kpiLabels: ['Soma de avaliação', 'Média por célula', 'Maior célula', 'Setor destaque'] }
          ],
          valueGetter: (row, col, metricKey) => {
            const slot = map[row]?.[col] || { qtd: 0, salario: 0, avaliacao: 0 };
            if (metricKey === 'qtd') return slot.qtd;
            if (metricKey === 'salario') return slot.salario;
            return slot.qtd ? (slot.avaliacao / slot.qtd) * 20 : 0;
          },
          defaultMetric: 'qtd'
        })
      };
    }
    if (reportKey === 'notasFiscais') {
      const nfs = analisarNFs(d);
      const porMes = {};
      nfs.forEach(nf => {
        const mes = nf.data.substring(0, 7);
        porMes[mes] = (porMes[mes] || 0) + nf.valor;
      });
      const status = contarPorCampo(nfs, 'status');

      const rows = Object.keys(status);
      const cols = [...new Set(nfs.map(nf => _monthShort(nf.data)))];
      const map = {};
      rows.forEach(st => {
        map[st] = {};
        cols.forEach(m => { map[st][m] = { qtd: 0, valor: 0, impostos: 0 }; });
      });
      nfs.forEach(nf => {
        const m = _monthShort(nf.data);
        map[nf.status][m].qtd += 1;
        map[nf.status][m].valor += nf.valor || 0;
        map[nf.status][m].impostos += nf.impostos || 0;
      });

      return {
        bar:   { labels: Object.keys(porMes), values: Object.values(porMes), title: 'Faturamento por Mês' },
        pie:   { labels: Object.keys(status), values: Object.values(status), title: 'NFs por Status' },
        heatmap: _buildHeatmapMatrix({
          title: 'Heatmap de notas fiscais por status e período',
          rowTitle: 'Status',
          rows,
          cols,
          metrics: [
            { key: 'qtd', label: 'Quantidade de NFs', format: 'number', kpiLabels: ['Total de NFs', 'Média por célula', 'Maior célula', 'Status destaque'] },
            { key: 'valor', label: 'Valor faturado (R$)', format: 'currency', kpiLabels: ['Faturamento total', 'Média por célula', 'Maior célula', 'Status destaque'] },
            { key: 'impostos', label: 'Impostos (R$)', format: 'currency', kpiLabels: ['Impostos totais', 'Média por célula', 'Maior célula', 'Status destaque'] }
          ],
          valueGetter: (row, col, metricKey) => map[row]?.[col]?.[metricKey] || 0,
          defaultMetric: 'valor'
        })
      };
    }
    if (reportKey === 'vendas') {
      const va = analisarVendas(d);
      const topClientes = Object.entries(va.receitaPorCliente).sort((a,b)=>b[1]-a[1]).slice(0,6);
      const topProd = Object.entries(va.qtdPorProduto).sort((a,b)=>b[1]-a[1]).slice(0,6);

      const byProduct = Object.entries(va.qtdPorProduto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([nome]) => nome);
      const cols = [...new Set((d.pedidos || []).map(p => _monthShort(p.data)))];
      const produtoByNome = {};
      (d.produtos || []).forEach(p => { produtoByNome[p.nome] = p; });
      const map = {};
      byProduct.forEach(nome => {
        map[nome] = {};
        cols.forEach(m => { map[nome][m] = { units: 0, revenue: 0, cost: 0 }; });
      });
      (d.pedidos || []).forEach(pedido => {
        const month = _monthShort(pedido.data);
        (pedido.itens || []).forEach(item => {
          const prod = (d.produtos || []).find(p => p.id === item.produtoId);
          const nome = prod?.nome;
          if (!nome || !map[nome] || !map[nome][month]) return;
          map[nome][month].units += item.quantidade || 0;
          map[nome][month].revenue += (item.quantidade || 0) * (item.precoUnitario || 0);
          map[nome][month].cost += (item.quantidade || 0) * (prod?.custo || 0);
        });
      });

      return {
        bar:  { labels: topClientes.map(e=>e[0].split(' ')[0]), values: topClientes.map(e=>e[1]), title: 'Receita por Cliente' },
        pie:  { labels: topProd.map(e=>e[0].split(' ').slice(0,2).join(' ')), values: topProd.map(e=>e[1]), title: 'Volume por Produto' },
        heatmap: _buildHeatmapMatrix({
          title: 'Heatmap de vendas por produto e período',
          rowTitle: 'Produto',
          rows: byProduct.map(nome => nome.split(' ').slice(0, 2).join(' ')),
          cols,
          metrics: [
            { key: 'units', label: 'Unidades vendidas', format: 'number', kpiLabels: ['Total de unidades', 'Média por célula', 'Maior ponto', 'Top produto'] },
            { key: 'revenue', label: 'Receita (R$)', format: 'currency', kpiLabels: ['Receita total', 'Média por célula', 'Pico de receita', 'Top produto'] },
            { key: 'margin', label: 'Margem (%)', format: 'percent', kpiLabels: ['Margem acumulada', 'Margem média', 'Pico de margem', 'Top produto'] }
          ],
          valueGetter: (_, col, metricKey, rIdx) => {
            const rowNome = byProduct[rIdx];
            const slot = map[rowNome]?.[col] || { units: 0, revenue: 0, cost: 0 };
            if (metricKey === 'units') return slot.units;
            if (metricKey === 'revenue') return slot.revenue;
            if (slot.revenue <= 0) return 0;
            return ((slot.revenue - slot.cost) / slot.revenue) * 100;
          },
          defaultMetric: 'margin'
        })
      };
    }
    if (reportKey === 'acoes') {
      const acoes = d.acoes || [];
      const valorPorDir = {};
      acoes.forEach(a => { valorPorDir[a.diretoria] = (valorPorDir[a.diretoria] || 0) + a.valorAcao; });
      const statusCount = contarPorCampo(acoes, 'status');

      const rows = [...new Set(acoes.map(a => a.diretoria))].sort();
      const cols = [...new Set(acoes.map(a => a.status))];
      const map = {};
      rows.forEach(r => {
        map[r] = {};
        cols.forEach(c => { map[r][c] = { qtd: 0, valor: 0 }; });
      });
      acoes.forEach(a => {
        map[a.diretoria][a.status].qtd += 1;
        map[a.diretoria][a.status].valor += a.valorAcao || 0;
      });

      return {
        bar: { labels: Object.keys(valorPorDir), values: Object.values(valorPorDir), title: 'Valor por Diretoria' },
        pie: { labels: Object.keys(statusCount), values: Object.values(statusCount), title: 'Ações por Status' },
        heatmap: _buildHeatmapMatrix({
          title: 'Heatmap de ações por diretoria e status',
          rowTitle: 'Diretoria',
          rows,
          cols,
          metrics: [
            { key: 'qtd', label: 'Quantidade de ações', format: 'number', kpiLabels: ['Total de ações', 'Média por célula', 'Maior célula', 'Diretoria destaque'] },
            { key: 'valor', label: 'Valor total (R$)', format: 'currency', kpiLabels: ['Valor total', 'Média por célula', 'Maior célula', 'Diretoria destaque'] }
          ],
          valueGetter: (row, col, metricKey) => map[row]?.[col]?.[metricKey] || 0,
          defaultMetric: 'valor'
        })
      };
    }
    return {};
  }

  return { gerarInsights, gerarResumo, gerarRecomendacoes, calcularKPIs, getChartData, analisarEstoque, analisarNFs, analisarVendas, analisarProdutos };
})();
