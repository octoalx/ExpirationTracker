const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const cssnano = require('next/dist/compiled/cssnano-simple');

test('production CSS preserves desktop centering and a mobile transform reset', async () => {
  const source = fs.readFileSync('src/styles/globals.css', 'utf8');
  const compiled = await postcss([tailwind({ base: process.cwd() })]).process(source, { from: 'src/styles/globals.css' });
  const optimized = await postcss([cssnano({}, postcss)]).process(compiled.css, { from: undefined });
  let centered = false;
  let mobileReset = false;
  optimized.root.walkRules(rule => {
    if (rule.selector === '.dialog-surface') {
      const declarations = Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
      assert.equal(declarations.top, '50%');
      assert.equal(declarations.left, '50%');
      assert.match(declarations.transform, /translate\(-50%\s*,\s*-50%\)/);
      centered = true;
    }
    if (rule.selector.includes('.work-panel[data-slot=dialog-content]')) {
      assert.equal(rule.parent.name, 'media');
      assert.match(rule.parent.params, /max-width:\s*767px/);
      const declarations = Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
      assert.equal(declarations.inset, '0');
      assert.ok(['none', 'translate(0)'].includes(declarations.transform));
      assert.equal(declarations.animation, 'none');
      mobileReset = true;
    }
  });
  assert.ok(centered, 'Desktop centering must survive CSS optimization');
  assert.ok(mobileReset, 'Mobile full-screen positioning must survive CSS optimization');
});
