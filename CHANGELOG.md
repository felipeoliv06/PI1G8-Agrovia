## v1.23.0 — Refinamento visual
- Melhoria de foco, legibilidade e espaçamento, mantendo as cores originais.
- Realce discreto da navegação, campos e linhas de tabelas.
- Ajustes para dispositivos móveis e preferência por movimento reduzido.
- Sem alterações no banco de dados.

## v1.22.0 — Central de Ajuda discreta
- Botão único Ajuda no menu lateral; tutorial e primeiros passos acessíveis dentro dele.
- Perguntas frequentes expansíveis sem pop-ups automáticos.
- Diálogo com foco, fechamento por Escape e fundo clicável.
- Identidade escura e verde-esmeralda preservada.
- Sem alterações no banco de dados.

## v1.21.0 — Assistente de configuração inicial
- Lista de quatro tarefas baseada em cadastros existentes no Supabase, não em cliques no tutorial.
- Ações para navegar até as telas, atualização ao salvar e ao retornar à página, opção de ocultar e reabrir.
- Sem novas tabelas ou mudanças de cores.

## v1.20.0 — Tutorial de primeiro acesso
- Guia de cinco passos, com navegação pelas áreas reais do sistema.
- Exibição automática uma vez por conta neste navegador; opção de rever pelo menu lateral.
- Voltar, próximo, pular, concluir e tecla Esc; foco contido no diálogo.
- Sem alterações no Supabase. A gestão agrícola é apresentada sem prometer recursos ainda indisponíveis.

## v1.19.0 — Painel de prioridades e ações rápidas
- Avisos organizados por estoque baixo, entregas atrasadas, entregas nos próximos 7 dias e pedidos em aberto.
- Atalhos diretos para gestão comercial em cada aviso.
- Estado vazio claro quando não há pendências; preservadas as cores e a estrutura originais.
- Datas de entregas comparadas por dia local; registros sem data não entram no cálculo de atraso.
- Sem alterações no banco de dados.

## v1.18.0 — Clareza nos cadastros e formulários
- Orientações curtas em produtos, clientes, pedidos e entregas.
- Mensagens de validação com anúncio acessível e indicação de campo.
- Foco automático ao editar produtos, clientes e entregas.
- Campos e botões com áreas de toque maiores, preservando a paleta original.
- Estados de carregamento sinalizados para tecnologias assistivas.
- Nenhuma alteração de banco de dados.

## v1.17.0 — Navegação e acessibilidade
- Preservada a identidade escura original em tons de verde-esmeralda e slate.
- Indicador de seção atual em todas as telas.
- Foco no conteúdo ao navegar pelo menu com teclado.
- Escape fecha o menu móvel; ajuste ao redimensionar a janela.
- Menu ativo com destaque visual, áreas de toque mais confortáveis e ajustes responsivos.
- Preferência por movimento reduzido respeitada.
- Sem alterações no banco de dados.

## 1.16.0 — Relatórios financeiros e comerciais

- Filtro por propriedade e intervalo de datas no financeiro.
- Relatórios comerciais de pedidos com filtros por propriedade e período.
- CSV de pedidos respeita os filtros selecionados.
- Indicadores e comparação financeira respeitam os filtros.
- Sem alterações de esquema do Supabase nesta versão.

## 1.15.0 — Gestão de entregas
- Edição de endereço, data prevista e observações das entregas em andamento.
- RPC autenticada com bloqueio de edição de entregas finalizadas.
- Preservação dos status e da integração financeira.

## 1.14.0 — Histórico de estoque
- Auditoria automática de alterações de estoque por gatilhos do banco.
- Aba de histórico com filtro por produto e exportação CSV.
- Registro de estoque inicial, entradas e saídas.

## 1.12.0 — Dashboard comercial e relatórios
- Dashboard integrado com produtos ativos, estoque baixo, pedidos em aberto e concluídos, alertas e entregas pendentes.
- Aba Relatórios na Gestão Comercial: situação dos pedidos, estoque baixo, pedidos recentes e exportação CSV.
- Corrigido o clique nos atalhos do painel após renderização dinâmica.
- Indicadores comerciais limitados aos 1.000 registros recentes; ampliar com consultas agregadas para operações maiores.
- Mantidos os módulos anteriores e o escopo de gestão interna, sem e-commerce.

## 1.11.1 — Banco conectado e validação transacional
- Tabelas comerciais e funções de pedidos implantadas no Supabase.
- Teste transacional de pedido, estoque, total, entrega e cancelamento com rollback.
- Índices adicionais para chaves estrangeiras compostas.
- Corrigido estilo compartilhado dos formulários comerciais.

## 1.11.0 — Pedidos e entregas internos
- Adicionado formulário de pedidos com cliente, itens, atendimento por entrega ou retirada.
- Preparada migration 07 com RPCs transacionais, bloqueio e reserva de estoque.
- Cancelamento de pedido devolve estoque; entrega concluída encerra o pedido.
- Adicionadas ações de status de pedidos e entregas.
- Mantida a separação entre gestão comercial interna e e-commerce.
- Verificações locais de sintaxe e estrutura executadas; fluxo remoto ainda pendente.

## 1.10.1 — Primeira interface comercial
- Adicionado menu Gestão Comercial separado dos módulos agrícolas e financeiros.
- Implementado cadastro, edição, ativação/inativação e consulta de produtos.
- Implementado cadastro, edição, exclusão e consulta de clientes.
- Adicionados indicadores visuais de estoque baixo e filtros de busca.
- Adicionadas telas de consulta de pedidos e entregas, ainda sem criação/alteração pelo frontend.
- Módulo inicializado após autenticação e consultas limitadas ao usuário conectado.
- Adicionados testes estáticos para a integração comercial.

## 1.9.2 - Perfil básico
- Adicionada tela simples de perfil acessada pelo cartão do usuário na barra lateral.
- Exibe nome, e-mail, status de confirmação e data de criação da conta autenticada.
- Incluído botão para voltar à visão geral.

# Changelog

## 1.4.0 — Banco consolidado
- Adicionado instalador único e idempotente para as cinco tabelas centrais.
- Incluídos perfil automático para novas contas e sincronização de perfis existentes.
- Reforçadas constraints, chaves estrangeiras, índices, timestamps e RLS.
- Adicionada validação de propriedade cruzada em safras.
- Adicionado script de diagnóstico pós-instalação e testes estáticos locais.
- Documentado o limite entre verificações locais e testes no Supabase remoto.

## v1.6.0 - 2026-11-13
- Adicionada edição de propriedades cadastradas (nome, área e localização).
- Incluída validação de nome e área antes da atualização.
- Mantida atualização da lista após salvar e mensagens de retorno ao usuário.

## 1.7.0 — Edição dos módulos agrícolas
- Adicionada edição de culturas (nome e descrição).
- Adicionada edição de talhões (nome, identificação e área).
- Adicionada edição de safras (nome, datas e observações).
- Incluídas validações de campos obrigatórios, área e intervalo de datas.
- Mantidas as operações protegidas pelo Supabase/RLS.


## 1.8.0 — Painel com indicadores reais
- Substituída a tela inicial demonstrativa por um painel conectado ao Supabase.
- Adicionados indicadores de propriedades, área total, talhões e safras em andamento.
- Incluído acompanhamento das safras ativas e planejadas e resumo das propriedades.
- Adicionada atualização manual e atualização automática após alterações nos cadastros.
- Incluídos testes estáticos para consultas, indicadores e integração do painel.

## 1.9.0 — Primeira etapa do financeiro rural
- Adicionado menu e tela de Financeiro.
- Criado cadastro, edição e exclusão de receitas e despesas.
- Incluídos vínculo com propriedade e vínculo opcional com safra da mesma propriedade.
- Adicionados categorias, situação, forma de pagamento, observações e filtros por período/tipo/busca.
- Incluídos indicadores de receitas confirmadas, despesas confirmadas, resultado e pendências.
- Criada tabela `financial_transactions` com RLS, políticas de propriedade por usuário, índices e privilégios mínimos.


## 1.9.1 — Refinamentos do financeiro rural
- Adicionado filtro por situação (confirmado, pendente e cancelado).
- Implementada paginação para carregar todo o histórico, sem limitar relatórios e CSV aos primeiros 500 lançamentos.
- Corrigida a consolidação por propriedade para diferenciar propriedades com nomes iguais.
- Evitada atualização duplicada do financeiro após salvar ou excluir lançamentos.
- Reforçada a exportação CSV contra interpretação de textos como fórmulas em planilhas.

## 1.10.0 — Integração ao escopo original (base de dados)
- Documentada a matriz de atendimento dos requisitos do projeto original.
- Preparada migration incremental para produtos/estoque, clientes, pedidos, itens e entregas.
- Incluídos vínculos compostos para impedir relacionamentos entre registros de usuários diferentes.
- Incluídas constraints, índices, timestamps e políticas RLS por usuário.
- Mantidos os módulos agrícolas, financeiros, autenticação e perfil existentes.
- Migration ainda não aplicada no Supabase; telas comerciais permanecem como próxima etapa.


## v1.13.0 — Integração comercial-financeira
- Cada novo pedido exige uma propriedade vinculada.
- Concluir pedido com valor positivo registra uma receita financeira única automaticamente.
- Receitas automáticas não podem ser editadas ou excluídas manualmente.
- Cancelamentos anteriores à conclusão não geram receita.
- Incluída migration 08 para atualizar o banco.
