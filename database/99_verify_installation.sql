-- AGROVIA | Diagnóstico pós-instalação (somente leitura)
-- Execute depois de 00_setup_complete.sql. Não altera dados.

SELECT t.table_name,
       CASE WHEN c.relrowsecurity THEN 'ATIVO' ELSE 'INATIVO' END AS rls
FROM information_schema.tables AS t
JOIN pg_class AS c ON c.relname = t.table_name
JOIN pg_namespace AS n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE t.table_schema = 'public'
  AND t.table_name IN ('profiles', 'properties', 'crops', 'fields', 'harvests')
ORDER BY t.table_name;

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'properties', 'crops', 'fields', 'harvests')
ORDER BY tablename, policyname;

SELECT event_object_table AS table_name, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('profiles', 'properties', 'crops', 'fields', 'harvests')
ORDER BY event_object_table, trigger_name;

SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'properties', 'crops', 'fields', 'harvests')
ORDER BY tablename, indexname;

SELECT 'propriedades' AS entidade, count(*) AS registros FROM public.properties
UNION ALL SELECT 'culturas', count(*) FROM public.crops
UNION ALL SELECT 'talhões', count(*) FROM public.fields
UNION ALL SELECT 'safras', count(*) FROM public.harvests;
