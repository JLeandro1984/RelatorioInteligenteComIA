/**
 * report-config.js
 * ─────────────────────────────────────────────────────────────────
 * Configuração declarativa de cada tipo de relatório.
 * Para adicionar um novo relatório, basta inserir um novo objeto
 * neste array — sem alterar nenhum outro arquivo.
 * ─────────────────────────────────────────────────────────────────
 */

const REPORT_CONFIGS = [
  /* ──────────────────────────────────────────
     CLIENTES
  ────────────────────────────────────────── */
  {
    key: 'clientes',
    label: 'Clientes',
    icon: 'users',
    color: 'blue',
    subtitle: 'Análise completa da base de clientes',
    entidade: 'clientes',
    relacoes: ['pedidos', 'notasFiscais'],

    filtros: [
      { campo: 'segmento', label: 'Segmento', tipo: 'select', opcoesDe: 'clientes.segmento' },
      { campo: 'estado',   label: 'Estado',   tipo: 'select', opcoesDe: 'clientes.estado' },
      { campo: 'ativo',    label: 'Status',   tipo: 'select', opcoes: [
          { value: '', label: 'Todos' },
          { value: 'true', label: 'Ativo' },
          { value: 'false', label: 'Inativo' }
        ]
      }
    ],

    kpis: [
      { key: 'totalClientes',   label: 'Total de Clientes',   icon: 'users',       cor: 'blue' },
      { key: 'clientesAtivos',  label: 'Clientes Ativos',     icon: 'user-check',  cor: 'green' },
      { key: 'totalPedidos',    label: 'Total de Pedidos',    icon: 'shopping-bag', cor: 'purple' },
      { key: 'receitaTotal',    label: 'Receita Total',       icon: 'dollar-sign', cor: 'gold' }
    ],

    colunas: [
      { campo: 'id',            label: 'ID',          tipo: 'text' },
      { campo: 'nome',          label: 'Cliente',     tipo: 'text' },
      { campo: 'segmento',      label: 'Segmento',    tipo: 'badge' },
      { campo: 'cidade',        label: 'Cidade',      tipo: 'text' },
      { campo: 'estado',        label: 'UF',          tipo: 'text' },
      { campo: 'ativo',         label: 'Status',      tipo: 'status' },
      { campo: 'limiteCredito', label: 'Limite Créd.', tipo: 'moeda' },
      { campo: 'dataCadastro',  label: 'Cadastro',    tipo: 'data' }
    ],

    graficos: ['bar', 'pie'],

    perguntasSugeridas: [
      'qual cliente mais comprou?',
      'quais clientes estão inativos?',
      'qual segmento tem mais clientes?',
      'qual cliente tem maior limite de crédito?'
    ]
  },

  /* ──────────────────────────────────────────
     PRODUTOS
  ────────────────────────────────────────── */
  {
    key: 'produtos',
    label: 'Produtos',
    icon: 'package',
    color: 'purple',
    subtitle: 'Desempenho e análise do portfólio de produtos',
    entidade: 'produtos',
    relacoes: ['estoque', 'pedidos'],

    filtros: [
      { campo: 'categoria', label: 'Categoria', tipo: 'select', opcoesDe: 'produtos.categoria' },
      { campo: 'marca',     label: 'Marca',     tipo: 'select', opcoesDe: 'produtos.marca' },
      { campo: 'ativo',     label: 'Status',    tipo: 'select', opcoes: [
          { value: '', label: 'Todos' },
          { value: 'true', label: 'Ativo' },
          { value: 'false', label: 'Inativo' }
        ]
      }
    ],

    kpis: [
      { key: 'totalProdutos',    label: 'Total de Produtos',   icon: 'package',      cor: 'purple' },
      { key: 'produtosAtivos',   label: 'Produtos Ativos',     icon: 'check-circle', cor: 'green' },
      { key: 'maiorMargem',      label: 'Maior Margem',        icon: 'trending-up',  cor: 'gold' },
      { key: 'receitaProdutos',  label: 'Receita (por Vendas)', icon: 'bar-chart',   cor: 'blue' }
    ],

    colunas: [
      { campo: 'id',            label: 'ID',          tipo: 'text' },
      { campo: 'nome',          label: 'Produto',     tipo: 'text' },
      { campo: 'categoria',     label: 'Categoria',   tipo: 'badge' },
      { campo: 'marca',         label: 'Marca',       tipo: 'text' },
      { campo: 'precoUnitario', label: 'Preço',       tipo: 'moeda' },
      { campo: 'margem',        label: 'Margem %',    tipo: 'percentual' },
      { campo: 'ativo',         label: 'Status',      tipo: 'status' }
    ],

    graficos: ['bar', 'pie', 'line'],

    perguntasSugeridas: [
      'qual o produto mais vendido?',
      'qual produto tem maior margem?',
      'quais produtos estão inativos?',
      'qual categoria gera mais receita?'
    ]
  },

  /* ──────────────────────────────────────────
     ESTOQUE
  ────────────────────────────────────────── */
  {
    key: 'estoque',
    label: 'Estoque',
    icon: 'archive',
    color: 'orange',
    subtitle: 'Controle e alertas de estoque',
    entidade: 'estoque',
    relacoes: ['produtos'],

    filtros: [
      { campo: 'deposito',   label: 'Depósito',       tipo: 'select', opcoesDe: 'estoque.deposito' },
      { campo: 'criticidade',label: 'Criticidade',    tipo: 'select', opcoes: [
          { value: '', label: 'Todos' },
          { value: 'critico', label: 'Crítico' },
          { value: 'baixo',   label: 'Abaixo do Mínimo' },
          { value: 'normal',  label: 'Normal' },
          { value: 'alto',    label: 'Acima do Máximo' }
        ]
      }
    ],

    kpis: [
      { key: 'itensEstoque',   label: 'Itens em Estoque',   icon: 'archive',       cor: 'blue' },
      { key: 'abaixoMinimo',   label: 'Abaixo do Mínimo',  icon: 'alert-triangle', cor: 'orange' },
      { key: 'semEstoque',     label: 'Sem Estoque',        icon: 'x-circle',      cor: 'red' },
      { key: 'valorEstoque',   label: 'Valor em Estoque',   icon: 'dollar-sign',   cor: 'green' }
    ],

    colunas: [
      { campo: 'produtoId',     label: 'Cód. Produto', tipo: 'text' },
      { campo: 'nomeProduto',   label: 'Produto',      tipo: 'text' },
      { campo: 'quantidade',    label: 'Qtd. Atual',   tipo: 'numero' },
      { campo: 'minimo',        label: 'Mínimo',       tipo: 'numero' },
      { campo: 'maximo',        label: 'Máximo',       tipo: 'numero' },
      { campo: 'criticidade',   label: 'Situação',     tipo: 'criticidade' },
      { campo: 'deposito',      label: 'Depósito',     tipo: 'text' },
      { campo: 'ultimaEntrada', label: 'Últ. Entrada', tipo: 'data' }
    ],

    graficos: ['bar', 'pie'],

    perguntasSugeridas: [
      'o que está com estoque baixo?',
      'quais produtos estão zerados?',
      'qual produto tem mais estoque?',
      'qual depósito tem mais itens?'
    ]
  },

  /* ──────────────────────────────────────────
     FUNCIONÁRIOS
  ────────────────────────────────────────── */
  {
    key: 'funcionarios',
    label: 'Funcionários',
    icon: 'briefcase',
    color: 'cyan',
    subtitle: 'Equipe, setores e desempenho',
    entidade: 'funcionarios',
    relacoes: ['pedidos'],

    filtros: [
      { campo: 'setor',  label: 'Setor',  tipo: 'select', opcoesDe: 'funcionarios.setor' },
      { campo: 'estado', label: 'Estado', tipo: 'select', opcoesDe: 'funcionarios.estado' },
      { campo: 'ativo',  label: 'Status', tipo: 'select', opcoes: [
          { value: '', label: 'Todos' },
          { value: 'true', label: 'Ativo' },
          { value: 'false', label: 'Inativo' }
        ]
      }
    ],

    kpis: [
      { key: 'totalFuncionarios', label: 'Total de Colaboradores', icon: 'briefcase',    cor: 'cyan' },
      { key: 'ativos',            label: 'Colaboradores Ativos',   icon: 'user-check',   cor: 'green' },
      { key: 'setores',           label: 'Setores',                icon: 'layers',       cor: 'purple' },
      { key: 'massaSalarial',     label: 'Massa Salarial',         icon: 'dollar-sign',  cor: 'gold' }
    ],

    colunas: [
      { campo: 'id',        label: 'ID',         tipo: 'text' },
      { campo: 'nome',      label: 'Nome',       tipo: 'text' },
      { campo: 'setor',     label: 'Setor',      tipo: 'badge' },
      { campo: 'cargo',     label: 'Cargo',      tipo: 'text' },
      { campo: 'salario',   label: 'Salário',    tipo: 'moeda' },
      { campo: 'avaliacao', label: 'Avaliação',  tipo: 'avaliacao' },
      { campo: 'ativo',     label: 'Status',     tipo: 'status' },
      { campo: 'admissao',  label: 'Admissão',   tipo: 'data' }
    ],

    graficos: ['bar', 'pie'],

    perguntasSugeridas: [
      'quais funcionários tiveram mais pedidos?',
      'qual setor tem mais colaboradores?',
      'qual funcionário tem melhor avaliação?',
      'qual a folha salarial por setor?'
    ]
  },

  /* ──────────────────────────────────────────
     NOTAS FISCAIS
  ────────────────────────────────────────── */
  {
    key: 'notasFiscais',
    label: 'Notas Fiscais',
    icon: 'file-text',
    color: 'green',
    subtitle: 'Faturamento, notas e impostos',
    entidade: 'notasFiscais',
    relacoes: ['clientes', 'pedidos'],

    filtros: [
      { campo: 'status', label: 'Status', tipo: 'select', opcoesDe: 'notasFiscais.status' },
      { campo: 'mes',    label: 'Mês',    tipo: 'select', opcoes: [
          { value: '', label: 'Todos' },
          { value: '01', label: 'Janeiro' },
          { value: '02', label: 'Fevereiro' },
          { value: '03', label: 'Março' },
          { value: '04', label: 'Abril' },
          { value: '05', label: 'Maio' },
          { value: '06', label: 'Junho' },
          { value: '07', label: 'Julho' },
          { value: '08', label: 'Agosto' },
          { value: '09', label: 'Setembro' },
          { value: '10', label: 'Outubro' },
          { value: '11', label: 'Novembro' },
          { value: '12', label: 'Dezembro' }
        ]
      }
    ],

    kpis: [
      { key: 'totalNFs',         label: 'Total de NFs',        icon: 'file-text',   cor: 'green' },
      { key: 'valorTotalNFs',    label: 'Valor Total',         icon: 'dollar-sign', cor: 'gold' },
      { key: 'totalImpostos',    label: 'Impostos',            icon: 'receipt',     cor: 'orange' },
      { key: 'nfsPendentes',     label: 'NFs Pendentes',       icon: 'clock',       cor: 'red' }
    ],

    colunas: [
      { campo: 'id',           label: 'Número NF',    tipo: 'text' },
      { campo: 'nomeCliente',  label: 'Cliente',      tipo: 'text' },
      { campo: 'data',         label: 'Data',         tipo: 'data' },
      { campo: 'valor',        label: 'Valor',        tipo: 'moeda' },
      { campo: 'impostos',     label: 'Impostos',     tipo: 'moeda' },
      { campo: 'status',       label: 'Status',       tipo: 'statusNF' }
    ],

    graficos: ['bar', 'line', 'pie'],

    perguntasSugeridas: [
      'quais notas fiscais tiveram maior valor?',
      'qual o total de impostos no período?',
      'quais notas estão pendentes?',
      'qual cliente gerou mais faturamento?'
    ]
  },

  /* ──────────────────────────────────────────
     VENDAS (PEDIDOS)
  ────────────────────────────────────────── */
  {
    key: 'vendas',
    label: 'Vendas',
    icon: 'trending-up',
    color: 'gold',
    subtitle: 'Análise de pedidos e performance de vendas',
    entidade: 'pedidos',
    relacoes: ['clientes', 'produtos', 'funcionarios'],

    filtros: [
      { campo: 'status', label: 'Status do Pedido', tipo: 'select', opcoesDe: 'pedidos.status' },
      { campo: 'mes',    label: 'Mês',              tipo: 'select', opcoes: [
          { value: '', label: 'Todos' },
          { value: '01', label: 'Janeiro' },
          { value: '02', label: 'Fevereiro' },
          { value: '03', label: 'Março' }
        ]
      }
    ],

    kpis: [
      { key: 'totalPedidos',   label: 'Total de Pedidos', icon: 'shopping-bag',  cor: 'gold' },
      { key: 'receitaTotal',   label: 'Receita Total',    icon: 'dollar-sign',   cor: 'green' },
      { key: 'ticketMedio',    label: 'Ticket Médio',     icon: 'credit-card',   cor: 'blue' },
      { key: 'pedidosAbertos', label: 'Pedidos em Aberto',icon: 'clock',         cor: 'orange' }
    ],

    colunas: [
      { campo: 'id',            label: 'Pedido',     tipo: 'text' },
      { campo: 'nomeCliente',   label: 'Cliente',    tipo: 'text' },
      { campo: 'nomeFuncionario',label: 'Vendedor',  tipo: 'text' },
      { campo: 'data',          label: 'Data',       tipo: 'data' },
      { campo: 'valorTotal',    label: 'Total',      tipo: 'moeda' },
      { campo: 'status',        label: 'Status',     tipo: 'statusPedido' },
      { campo: 'itensCount',    label: 'Itens',      tipo: 'numero' }
    ],

    graficos: ['bar', 'line', 'pie'],

    perguntasSugeridas: [
      'qual cliente mais comprou?',
      'qual o produto mais vendido?',
      'qual vendedor fechou mais pedidos?',
      'qual mês teve mais vendas?'
    ]
  }
];

// Indexado por key para acesso O(1)
const REPORT_CONFIG_MAP = Object.fromEntries(
  REPORT_CONFIGS.map(c => [c.key, c])
);
