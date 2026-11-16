# Estrutura do banco Agrovia

```text
auth.users
   ├── profiles (1:1)
   ├── properties (1:N)
   │      ├── fields (1:N)
   │      │      └── harvests (1:N)
   │      └── financial_transactions (1:N)
   ├── crops (1:N)
   │      └── harvests (1:N)
   └── financial_transactions (1:N)
          └── harvests (0..1 por lançamento)
```

| Tabela | Finalidade | Regra de acesso |
|---|---|---|
| `profiles` | Nome público básico do usuário | O próprio usuário lê/atualiza o perfil; criação automática via Auth |
| `properties` | Fazendas/propriedades rurais | Somente o proprietário autenticado |
| `crops` | Catálogo de culturas do usuário | Somente o proprietário autenticado |
| `fields` | Talhões pertencentes a uma propriedade | Acesso herdado da propriedade |
| `harvests` | Safras ligadas a talhão e cultura | Talhão e cultura devem pertencer ao mesmo usuário |
| `financial_transactions` | Receitas e despesas ligadas a uma propriedade e opcionalmente a uma safra | Usuário autenticado deve ser dono da propriedade e da safra vinculada |

## Exclusões e integridade referencial

- Excluir uma conta remove seus perfis, propriedades e culturas via `ON DELETE CASCADE`.
- Excluir uma propriedade remove seus talhões; os talhões removidos removem suas safras.
- Uma cultura referenciada por uma safra não pode ser excluída (`ON DELETE RESTRICT`).
- Uma propriedade com lançamentos financeiros não pode ser excluída até que seus lançamentos sejam tratados (`ON DELETE RESTRICT`).
- Ao excluir uma safra, o vínculo opcional do lançamento financeiro é removido, mas o lançamento permanece (`ON DELETE SET NULL`).
- Áreas devem ser positivas; nomes não podem ser vazios; status e datas das safras são validados.
- Culturas não podem ter nomes repetidos para o mesmo usuário; talhões não podem repetir nome ou identificação dentro da mesma propriedade.

## Próximas áreas a modelar

Estoque, compras, fornecedores, máquinas, funcionários, sensores e integração climática ainda não fazem parte do schema. Essas tabelas serão definidas junto com as respectivas regras de negócio.
