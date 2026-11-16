# Relatório de segurança do banco — Agrovia 1.4.0

- RLS ativado em `profiles`, `properties`, `crops`, `fields` e `harvests`.
- Políticas antigas dessas tabelas são removidas e substituídas por políticas específicas para `authenticated`.
- O papel `anon` perde privilégios diretos nas cinco tabelas.
- Propriedades e culturas são isoladas por `auth.uid()`.
- Talhões são acessíveis somente quando sua propriedade pertence ao usuário autenticado.
- Safras validam acesso ao talhão e à cultura; trigger adicional impede vínculo entre registros de proprietários diferentes.
- Constraints protegem nomes não vazios, áreas positivas, status permitidos e ordem de datas.
- Índices apoiam filtros por usuário, propriedade, talhão, status e cultura.

## Limites

O papel `service_role` do Supabase ignora RLS por desenho; mantenha essa chave somente em backend confiável. O script não cria políticas para tabelas futuras nem substitui auditoria de segurança do projeto Supabase completo.
