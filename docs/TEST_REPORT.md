# Relatório de verificações — Agrovia 1.9.0 (desenvolvimento)

## Verificações locais executadas

- `npm test`: 16 testes aprovados, 0 falhas.
- `npm run check:js`: sintaxe JavaScript dos módulos, incluindo `finance.js`.
- Testes estáticos do painel, dos módulos agrícolas, do módulo financeiro e das políticas/migrations SQL.

## Verificações no Supabase conectado

- Migration `create_financial_transactions_module` aplicada com sucesso.
- Tabela `public.financial_transactions` confirmada.
- RLS habilitado na tabela.
- Quatro políticas confirmadas: SELECT, INSERT, UPDATE e DELETE, todas destinadas ao papel `authenticated`.
- 14 colunas confirmadas, incluindo vínculo com usuário, propriedade e safra.
- Tabela sem lançamentos no momento da verificação.

## Limites ainda pendentes

- Ainda não foi realizado um fluxo completo de cadastro, edição e exclusão pelo navegador.
- Não foi executado teste de isolamento com duas contas autenticadas distintas.
- O aviso atual do Security Advisor sobre proteção contra senhas vazadas está relacionado à configuração geral do Auth do projeto, não à nova tabela financeira.
- Os avisos de índices não utilizados para os novos índices são esperados enquanto ainda não há lançamentos registrados.

Os testes locais e a inspeção do schema remoto são verificações parciais; não substituem os testes funcionais no navegador.
