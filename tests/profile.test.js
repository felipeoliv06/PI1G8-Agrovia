const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const profile = fs.readFileSync(path.join(root, 'js/modules/profile.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');

test('perfil possui tela simples com dados da conta', () => {
  for (const id of ['perfil', 'profileName', 'profileEmail', 'profileCreatedAt', 'profileStatus', 'profileBackBtn']) {
    assert.ok(html.includes(`id="${id}"`), `Elemento ausente: ${id}`);
  }
});

test('cartão do usuário abre o perfil e permite voltar ao painel', () => {
  assert.match(html, /id="profileCard"/);
  assert.match(main, /profileCard[\s\S]*UI\.switchTab\('perfil'\)/);
  assert.match(main, /profileBackBtn[\s\S]*UI\.switchTab\('visao-geral'\)/);
  assert.match(main, /ProfileModule\.init\(e\.detail\.user\)/);
});

test('perfil usa os dados da sessão autenticada sem expor metadados extras', () => {
  assert.match(profile, /user\.user_metadata\?\.full_name/);
  assert.match(profile, /user\.email/);
  assert.match(profile, /user\.created_at/);
  assert.match(profile, /user\.email_confirmed_at/);
  assert.match(profile, /UI\.safeTextUpdate/);
});
