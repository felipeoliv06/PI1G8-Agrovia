# Relatório de Segurança - RLS Revisado (Fase 3.1)
- **Atualização de Safras (UPDATE):** A política RLS agora exige explicitamente que o `crop_id` informado na alteração pertença ao usuário logado (`auth.uid()`), prevenindo injeções lógicas de culturas de terceiros.
- **Validação de Status:** O banco de dados bloqueia status inválidos via `CHECK (status IN ('Planejada', 'Em Andamento', 'Concluída', 'Cancelada'))`.

## Complemento da Migration 04

A migration `04_database_integrity_and_security.sql` passa a:
- remover políticas antigas de `properties`, `crops`, `fields` e `harvests` antes de recriar as regras, evitando que políticas permissivas antigas continuem liberando acesso;
- aplicar regras separadas de SELECT, INSERT, UPDATE e DELETE;
- validar no banco se talhão e cultura vinculados a uma safra pertencem ao mesmo usuário;
- adicionar índices únicos para nomes de culturas por usuário e nomes/identificações de talhões por propriedade.

A migration substitui as políticas existentes nessas quatro tabelas. Ela ainda precisa ser aplicada e testada no Supabase real; este relatório não representa um teste remoto concluído.
