# Agrovia SaaS

Aplicação web de gestão de propriedades rurais, com autenticação Supabase e estrutura de dados para propriedades, culturas, talhões, safras e controle financeiro rural.

## Requisitos

- Projeto Supabase.
- Navegador moderno.
- Servidor HTTP local (XAMPP/Apache ou Live Server do VS Code), pois o projeto utiliza módulos JavaScript ES.
- Node.js 20+ para executar as verificações locais.

## Configuração do frontend

1. A configuração do projeto Agrovia já está preenchida em `js/config/env.js` com URL e chave publishable (pública).
2. Nunca coloque `service_role` ou `sb_secret` no navegador.
3. Sirva a pasta por um servidor HTTP local e abra `index.html`.

### Executar pelo XAMPP

1. Extraia a pasta `agrovia_work` para `C:\xampp\htdocs`.
2. Inicie somente o serviço **Apache** no XAMPP (o banco do Agrovia fica no Supabase).
3. Acesse `http://localhost/agrovia_work/` no navegador.

## Banco de dados — instalação completa

**Para instalar ou alinhar o banco do Agrovia, use um único arquivo:**

`database/00_setup_complete.sql`

1. Faça backup do projeto Supabase antes de alterar um banco com dados importantes.
2. Abra o SQL Editor no painel do Supabase.
3. Cole o conteúdo completo de `database/00_setup_complete.sql` e execute.
4. Depois execute `database/99_verify_installation.sql` para conferir tabelas, RLS, políticas, triggers e índices.

O instalador cria/ajusta as tabelas `profiles`, `properties`, `crops`, `fields` e `harvests`. O módulo financeiro possui a migration incremental `database/05_financial_module.sql`, que cria `financial_transactions` com RLS e políticas de propriedade por usuário. Essa migration já foi aplicada ao projeto Supabase conectado durante o desenvolvimento; em outro ambiente, execute-a uma vez após a instalação principal. Não apaga tabelas nem registros. Ele substitui as políticas RLS dessas cinco tabelas pelas regras do Agrovia; não o use se essas tabelas forem compartilhadas com outro sistema que dependa de políticas próprias.

As migrations `01` a `04` são mantidas como histórico de desenvolvimento. **Não execute as antigas em sequência junto com o instalador completo.** Para novas instalações, use somente o `00_setup_complete.sql`.

## Painel inicial

A Visão Geral consulta o Supabase e apresenta totais de propriedades, área cadastrada, talhões, safras em andamento e safras planejadas. O botão **Atualizar** recarrega os indicadores; alterações feitas nos módulos também atualizam o painel automaticamente.

## Verificações locais

```bash
npm test
npm run check:js
```

Esses testes verificam estrutura e consistência estática dos arquivos e a sintaxe JavaScript. Eles não substituem a execução no PostgreSQL/Supabase real, nem comprovam isolamento entre duas contas reais.

## Segurança

- RLS habilitado nas tabelas expostas do Agrovia, incluindo `financial_transactions`.
- Cada usuário só consulta e altera os próprios dados.
- Talhões dependem de propriedades do mesmo usuário.
- Safras exigem talhão e cultura do mesmo proprietário.
- Chaves administrativas nunca devem ser colocadas no frontend.

## Módulo financeiro rural

O módulo permite registrar receitas e despesas vinculadas a uma propriedade e, opcionalmente, a uma safra da mesma propriedade. Os lançamentos incluem categoria, descrição, valor, data, situação, forma de pagamento e observações. Os indicadores consideram receitas e despesas confirmadas; pendências são exibidas separadamente e lançamentos cancelados não entram no resultado. A tela oferece filtros por período, tipo, situação e busca textual, relatórios de despesas por categoria e resultado por propriedade, além de exportação CSV dos lançamentos filtrados. O histórico é carregado em páginas para não limitar os relatórios aos primeiros 500 registros.

### Perfil básico (1.9.2)
Acesse **Meu perfil** clicando no cartão do usuário na parte inferior do menu lateral. A tela mostra nome, e-mail, status de confirmação e data de criação da conta atualmente autenticada.

## Integração ao escopo comercial original

O documento de concepção original também prevê produtos, estoque, clientes, pedidos e entregas. A versão atual preserva os módulos agrícolas e financeiros já existentes e acrescenta a migration incremental `database/06_commercial_management.sql` como primeira etapa de estruturação comercial. Leia `docs/INTEGRACAO_PROJETO_ORIGINAL.md` antes de aplicar a migration. As migrations comerciais 06, 07 e 08 já foram aplicadas ao projeto Supabase conectado em 15/11/2026; em outro ambiente, execute-as na ordem 06, 07, 08. Produtos/Estoque e Clientes já possuem operações básicas; o fluxo de Pedidos/Entregas já possui operações transacionais. Não execute o instalador completo para aplicar esta etapa; execute a migration 06 somente após backup e revisão.

## Pedidos e entregas — versão 1.11.0

Após aplicar `database/06_commercial_management.sql`, aplique `database/07_order_workflow.sql` **nesta ordem** e somente depois de backup e revisão. A segunda migration ativa as funções RPC de registro de pedidos, mudança de status e acompanhamento de entregas, com reserva/devolução de estoque dentro de uma transação. Não execute `00_setup_complete.sql` para instalar os módulos comerciais.

O fluxo permanece interno: o produtor registra pedidos recebidos por outros meios, sem vitrine pública, carrinho ou pagamento online. Não há integração com sistema fiscal nem rastreamento de entregas. As migrations equivalentes às versões 06 e 07 e os índices adicionais 08 foram aplicados no Supabase deste projeto em 15/11/2026. Os nomes e políticas da implantação remota foram consolidados separadamente; não reexecute migrations em bancos já atualizados.

## Estado do Supabase em 15/11/2026

Foram criadas as cinco tabelas comerciais e as três funções RPC de pedidos/entregas. As políticas RLS foram habilitadas, escrita direta em pedidos/itens/entregas foi revogada do papel authenticated, e foram adicionados índices de chaves estrangeiras. Foi executado teste transacional com rollback: pedido de 3 unidades, total de R$ 37,50, estoque de 10 para 7, cancelamento e devolução para 10. Nenhum registro de teste permaneceu no banco. O teste do navegador autenticado ainda não foi executado.

**Segurança:** o advisor sinaliza as três RPC SECURITY DEFINER como executáveis por usuários autenticados; isso é intencional para o fluxo transacional, com verificação explícita de auth.uid() e propriedade de cada registro. A proteção de senhas vazadas do Supabase Auth permanece desativada nas configurações do projeto.

## Painel e relatórios comerciais (1.12.0)
A Visão Geral apresenta indicadores agrícolas e comerciais. A Gestão Comercial contém a aba **Relatórios**, com resumo de pedidos, estoque baixo, entregas em aberto e exportação CSV dos pedidos recentes. Os relatórios não equivalem à contabilidade: o valor concluído representa a soma dos pedidos concluídos, não o fluxo de caixa. As consultas de listagem são limitadas a 1.000 registros; para bases maiores, implementar agregações no banco e paginação.


### Integração comercial-financeira (v1.13)
No menu Gestão Comercial, selecione a propriedade ao registrar um pedido. Após concluir o pedido, a receita confirmada é criada automaticamente no Financeiro. Pedidos de entrega são concluídos ao confirmar a entrega; retiradas são concluídas na lista de pedidos. A receita vinculada não pode ser alterada ou excluída manualmente. Para ativar no banco, aplique `database/08_commercial_financial_integration.sql` após as migrations comerciais anteriores.

## Histórico de estoque (v1.14)
A aba **Histórico de estoque** mostra entradas, saídas e estoque inicial automaticamente registrados pelo banco a partir da instalação da migration 09. Inclui filtro por produto e exportação CSV (últimos 500 registros). Alterações anteriores à instalação não são reconstruídas.


### Painel v1.19
A tela inicial reúne alertas de estoque, pedidos e entregas, com atalhos para a gestão comercial. Os indicadores de pedidos refletem os 1.000 registros mais recentes carregados pelo painel.

### Assistente inicial (v1.21)
O painel mostra o progresso real dos primeiros cadastros: propriedade, cultura, talhão e safra. Cada item só fica concluído quando existe um registro acessível para a conta no Supabase. A opção de ocultar é salva apenas no navegador; use “Ver primeiros passos” para reabrir.

### Central de Ajuda (v1.22)
Use **Ajuda** no menu lateral para consultar dúvidas rápidas, rever o tutorial ou abrir o assistente de primeiros passos.
