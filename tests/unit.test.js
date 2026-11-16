const assert = require('assert');
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
}
try {
    assert.strictEqual(escapeHTML('<script>'), '&lt;script&gt;');
    console.log('✅ Unit Tests: Passou');
} catch (e) {
    console.error('❌ Unit Tests: Falhou', e);
}
