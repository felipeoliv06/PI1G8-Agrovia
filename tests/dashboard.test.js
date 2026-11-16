const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'js/modules/dashboard.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');

test('painel consulta dados reais das quatro entidades principais', () => {
  for (const table of ['properties', 'crops', 'fields', 'harvests']) {
    assert.match(dashboard, new RegExp(`from\\(['"]${table}['"]\\)`));
  }
});

test('painel apresenta indicadores e acompanhamento de safras', () => {
  for (const label of ['Propriedades', 'Área total', 'Talhões', 'Safras em andamento', 'Safras em acompanhamento']) {
    assert.ok(dashboard.includes(label), `Indicador ausente: ${label}`);
  }
});

test('painel possui atualização manual e integração após login', () => {
  assert.match(html, /id="refreshDashboardBtn"/);
  assert.match(html, /id="dashboardContent"/);
  assert.match(main, /DashboardModule\.init\(e\.detail\.user\)/);
});

test('módulos notificam o painel quando os dados são alterados', () => {
  const properties = fs.readFileSync(path.join(root, 'js/modules/properties.js'), 'utf8');
  const agricultural = fs.readFileSync(path.join(root, 'js/modules/agricultural.js'), 'utf8');
  assert.match(properties, /agrovia:dataChanged/);
  assert.match(agricultural, /agrovia:dataChanged/);
  assert.match(dashboard, /addEventListener\('agrovia:dataChanged'/);
});
