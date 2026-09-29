#!/usr/bin/env node
/*
 * build.js: inlines src/styles.css, src/sestina.js and src/ui.js into
 * src/template.html and writes the single self-contained dist/sestina.html.
 * No dependencies. Run with: node build.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

// A literal "</script" or "<!--" inside inlined JS would end the script
// element early, so escape them.
const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const safeStyle = (css) => css.replace(/<\/style/gi, '<\\/style');

const parts = {
  '/*__STYLES__*/': safeStyle(src('styles.css').trim()),
  '/*__SESTINA__*/': safeScript(src('sestina.js').trim()),
  '/*__UI__*/': safeScript(src('ui.js').trim()),
};

let html = src('template.html');
for (const [marker, content] of Object.entries(parts)) {
  if (!html.includes(marker)) throw new Error('Missing placeholder ' + marker + ' in src/template.html');
  // A function replacement avoids "$&"-style patterns in the inlined code.
  html = html.replace(marker, () => content);
}

const out = path.join(__dirname, 'dist', 'sestina.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Wrote ' + path.relative(process.cwd(), out) + ' (' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB)');
