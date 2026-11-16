const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(root, 'js/modules/commercial.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database/06_commercial_management.sql'), 'utf8');

assert.match(html, /data-target="comercial"/, 'menu comercial deve existir');
assert.match(html, /id="commercialContent"/, 'área comercial deve existir');
assert.match(main, /CommercialModule\.init\(e\.detail\.user\)/, 'módulo deve iniciar após login');
for (const table of ['products', 'customers', 'orders', 'order_items', 'deliveries']) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`), `migration deve criar ${table}`);
  assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`), `RLS deve estar ativo em ${table}`);
}
assert.match(moduleSource, /saveProduct/);
assert.match(moduleSource, /saveCustomer/);
assert.match(moduleSource, /eq\('user_id', this\.userId\)/, 'consultas devem limitar registros ao usuário autenticado');
assert.match(html, /não é uma loja virtual/i, 'interface deve reforçar que não é e-commerce');
console.log('Commercial module static checks passed.');

const workflow = fs.readFileSync(path.join(root, 'database/07_order_workflow.sql'), 'utf8');
for (const fn of ['agrovia_create_order', 'agrovia_change_order_status', 'agrovia_change_delivery_status']) {
  assert.match(workflow, new RegExp(`FUNCTION public\\.${fn}`));
  assert.match(moduleSource, new RegExp(fn));
}
assert.match(workflow, /FOR UPDATE/, 'deve bloquear produtos para reservar estoque');
assert.match(workflow, /REVOKE INSERT, UPDATE, DELETE ON public\.orders/, 'escrita de pedidos deve passar pela RPC');
