# Agrovia — integração com o projeto original

## Referência de produto

O documento original define o AgroVia como uma aplicação web de gestão interna para pequenos produtores rurais. O foco é centralizar produtos, estoque, pedidos, clientes e entregas. O sistema não deve se transformar em e-commerce ou marketplace: clientes são cadastrados para apoiar o atendimento e o controle dos pedidos, sem vitrine pública, carrinho ou checkout.

## O que já existia na versão 1.9.2

- Autenticação e perfil do produtor.
- Visão geral conectada aos dados agrícolas.
- Cadastro e edição de propriedades.
- Culturas, talhões e safras.
- Controle financeiro rural.
- Segurança por usuário com Supabase RLS.

Esses módulos serão preservados. Eles representam uma ampliação da solução original para também apoiar a gestão da propriedade e das atividades agrícolas.

## Matriz de integração dos requisitos originais

| Requisito do documento | Situação identificada na 1.9.2 | Integração planejada |
|---|---|---|
| Cadastro/autenticação de produtores | Parcialmente atendido por Auth e perfil | Preservar e conferir permissões administrativas |
| Cadastro, edição e inativação de produtos | Não localizado como módulo comercial | Novo módulo Produtos |
| Controle de quantidade disponível | Não localizado como estoque comercial | Estoque no cadastro de produtos, com histórico de movimentações em etapa posterior |
| Registro e consulta de pedidos | Não localizado | Novo módulo Pedidos e itens |
| Dados de clientes ligados aos pedidos | Não localizado | Novo módulo Clientes, vinculado aos pedidos |
| Atualização do status do pedido | Não localizado | Fluxo de status em Pedidos |
| Histórico de pedidos | Não localizado | Consulta e filtros em Pedidos |
| Atualização do status das entregas | Não localizado | Novo módulo Entregas ligado a pedidos |
| Aviso de estoque insuficiente | Não localizado | Validação antes de confirmar/separar pedido |
| Interface responsiva e simples | Base visual já existe | Ajustar as novas telas ao padrão atual |
| Banco relacional, validação e permissões | Base Supabase/RLS existente | Novas tabelas com chaves, constraints e RLS por usuário |

## Primeira etapa técnica adicionada

A migration `database/06_commercial_management.sql` prepara as tabelas `products`, `customers`, `orders`, `order_items` e `deliveries`. Ela usa UUIDs, validações, índices, vínculos que impedem relacionar registros de usuários diferentes e políticas RLS para isolar os dados por conta.

**Importante:** a migration foi adicionada ao projeto local, mas não foi executada no Supabase. O frontend desses módulos também ainda precisa ser implementado. O campo de estoque inicial fica no produto; movimentações detalhadas e baixa automática por pedido devem ser implementadas junto do fluxo transacional, para evitar divergência de quantidades.

## Limites preservados do documento original

- Sem vitrine pública ou marketplace.
- Sem carrinho ou checkout para clientes.
- Sem pagamento online nesta primeira versão.
- Sem GPS, rastreamento em tempo real ou cálculo automático de rotas.
- Sem automação de produção agrícola, previsão de safra ou análise agronômica.
- Sem substituir sistemas contábeis ou fiscais.

## Próximas etapas

1. Implementar as telas e operações de Produtos/Estoque.
2. Implementar cadastro e consulta de Clientes.
3. Implementar Pedidos com itens, cálculo de total e validação de estoque.
4. Implementar Entregas e atualização de status.
5. Integrar os indicadores comerciais à Visão Geral sem remover os indicadores agrícolas e financeiros.
6. Só então revisar os testes e validar o fluxo no Supabase com contas de teste.

## Atualização 1.11.0 — fluxo de pedidos e entregas

- Interface de pedidos recebidos com cliente, itens, quantidade, tipo de atendimento, observações e agendamento opcional.
- A migration `07_order_workflow.sql` adiciona funções transacionais com bloqueio de estoque, total calculado pelo servidor e validação de proprietário.
- Pedidos reservam estoque no cadastro. Cancelamentos devolvem as quantidades.
- Pedidos para retirada são concluídos após o status Pronto; pedidos para entrega são concluídos ao registrar a entrega como Entregue.
- Interface de acompanhamento de pedidos e entregas com mudanças de status.
- O acesso direto de escrita nas tabelas de pedidos, itens e entregas é revogado para usuários autenticados; alterações passam pelas funções autorizadas.

**Instalação:** não execute o instalador 00 novamente. Em ambiente que ainda não possui as tabelas comerciais, execute primeiro a migration 06 e depois a 07 no SQL Editor, após backup e revisão. Nenhuma das duas foi aplicada automaticamente no Supabase.

**Limitações:** os testes atuais são estáticos e de sintaxe; falta executar um teste de ponta a ponta com dados de exemplo em um ambiente Supabase seguro. O estoque pode ser ajustado manualmente pelo proprietário na tela de Produtos. Não há loja pública, checkout nem pagamento online.


## Atualização de implantação (15/11/2026)

As tabelas e funções comerciais foram implantadas no Supabase conectado. Os testes de pedido, total, baixa e devolução de estoque e cancelamento de entrega passaram em transação com rollback. Nenhum dado de exemplo ficou salvo. O teste pelo navegador com sessão real ainda é pendente.
