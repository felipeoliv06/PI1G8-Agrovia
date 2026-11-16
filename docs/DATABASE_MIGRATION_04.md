# Banco completo — Agrovia 1.4.0

O instalador atual e consolidado está em `database/00_setup_complete.sql`. Ele inclui o schema inicial, perfil, propriedades, culturas, talhões, safras, relacionamentos, constraints, índices, triggers e RLS.

Para conferir o resultado depois da execução, use `database/99_verify_installation.sql`.

As migrations `01` a `04` foram preservadas apenas para histórico. Não execute essas migrations antigas junto com o instalador completo.

O instalador não remove tabelas nem registros, mas recria as políticas RLS nas cinco tabelas gerenciadas. Faça backup e confirme que nenhuma outra aplicação depende de políticas personalizadas nessas tabelas antes de executar.
