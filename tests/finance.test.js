const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const finance = fs.readFileSync(path.join(root, 'js/modules/finance.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database/05_financial_module.sql'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');

test('módulo financeiro possui navegação, formulário e listagem', () => {
  assert.match(html, /data-target="financeiro"/);
  assert.match(html, /id="financeiro"/);
  for (const id of ['financeForm', 'financeTransactionList', 'financeSummary', 'financeProperty', 'financeHarvest']) {
    assert.ok(finance.includes(`id=\"${id}\"`), `Elemento ausente: ${id}`);
  }
});

test('módulo financeiro executa CRUD com filtros, edição e categorias', () => {
  for (const feature of ['financial_transactions', 'transaction_type', 'update', 'insert', 'delete', 'getFilteredTransactions', 'CATEGORY_OPTIONS', 'renderReports', 'exportCsv']) {
    assert.ok(finance.includes(feature), `Recurso ausente: ${feature}`);
  }
  assert.match(finance, /Receitas confirmadas/);
  assert.match(finance, /Despesas confirmadas/);
  assert.match(finance, /Resultado/);
  assert.match(finance, /Despesas por categoria/);
  assert.match(finance, /Resultado por propriedade/);
  assert.match(finance, /text\/csv/);
});

test('módulo financeiro é iniciado após autenticação', () => {
  assert.match(main, /FinanceModule\.init\(e\.detail\.user\)/);
});

test('migration protege os lançamentos com RLS e propriedade do usuário', () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    assert.match(migration, new RegExp(`FOR ${operation} TO authenticated`, 'i'));
  }
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /financial_transactions_user_date/);
});
