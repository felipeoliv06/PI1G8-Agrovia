const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const setup = fs.readFileSync(path.join(root, 'database/00_setup_complete.sql'), 'utf8');
const verify = fs.readFileSync(path.join(root, 'database/99_verify_installation.sql'), 'utf8');

test('instalação completa declara as cinco tabelas do Agrovia', () => {
  for (const table of ['profiles', 'properties', 'crops', 'fields', 'harvests']) {
    assert.match(setup, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`, 'i'));
  }
});

test('todas as tabelas de dados habilitam RLS', () => {
  for (const table of ['profiles', 'properties', 'crops', 'fields', 'harvests']) {
    assert.match(setup, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
  }
});

test('políticas não concedem acesso público e limitam dados pelo usuário', () => {
  assert.match(setup, /REVOKE ALL ON public\.profiles, public\.properties, public\.crops, public\.fields, public\.harvests FROM anon/i);
  assert.match(setup, /\(SELECT auth\.uid\(\)\) = user_id/i);
  assert.match(setup, /\(SELECT auth\.uid\(\)\) = id/i);
});

test('funções internas não ficam executáveis pela API', () => {
  for (const fn of ['agrovia_set_updated_at', 'agrovia_handle_new_user', 'agrovia_validate_harvest_ownership']) {
    assert.match(setup, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\(\\) FROM PUBLIC, anon, authenticated`, 'i'));
  }
});

test('safras validam o vínculo entre dono do talhão e dono da cultura', () => {
  assert.match(setup, /agrovia_validate_harvest_ownership/);
  assert.match(setup, /v_field_owner <> v_crop_owner/);
});

test('há restrições para áreas, status e datas', () => {
  assert.match(setup, /properties_total_area_positive_check/);
  assert.match(setup, /fields_area_positive_check/);
  assert.match(setup, /harvests_status_allowed_check/);
  assert.match(setup, /harvests_expected_after_start_check/);
  assert.match(setup, /harvests_actual_after_start_check/);
});

test('script de diagnóstico é somente leitura', () => {
  assert.match(verify, /pg_policies/i);
  assert.match(verify, /pg_indexes/i);
  assert.doesNotMatch(verify, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i);
});
