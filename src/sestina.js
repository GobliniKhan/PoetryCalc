/*
 * sestina.js: pure sestina logic, with no DOM code.
 *
 * Works as a CommonJS module in Node (for tests) and as a plain script in the
 * browser, where it defines a global `Sestina`.
 *
 * End words are numbered 1–6 by their line in stanza 1.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Sestina = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STANZAS = 6;
  const LINES = 6;
  const ENVOI_LINES = 3;
  const TOTAL_LINES = STANZAS * LINES + ENVOI_LINES; // 39

  // Retrogradatio cruciata: each stanza takes the previous one's end words in
  // the order last, first, second-to-last, second, and so on.
  const ROTATION_STEP = [6, 1, 5, 2, 4, 3];

  function nextStanza(prev) {
    return ROTATION_STEP.map((pos) => prev[pos - 1]);
  }

  const ROTATION = (function () {
    const rows = [[1, 2, 3, 4, 5, 6]];
    for (let s = 1; s < STANZAS; s++) rows.push(nextStanza(rows[s - 1]));
    return rows.map((r) => Object.freeze(r));
  })();
  Object.freeze(ROTATION);

  // Envoi patterns are three [mid, end] pairs of end-word numbers.
  const DEFAULT_ENVOI = Object.freeze([[2, 5], [4, 3], [6, 1]]);

  const ENVOI_PRESETS = Object.freeze([
    { id: 'default', label: '2…5 · 4…3 · 6…1', pattern: DEFAULT_ENVOI },
    { id: 'reversed', label: '5…2 · 3…4 · 1…6', pattern: [[5, 2], [3, 4], [1, 6]] },
    { id: 'order', label: '1…2 · 3…4 · 5…6', pattern: [[1, 2], [3, 4], [5, 6]] },
    { id: 'last-stanza', label: '2…4 · 6…5 · 3…1', pattern: [[2, 4], [6, 5], [3, 1]] },
  ]);

  /* ---------- words ---------- */

  // Characters that belong to a word: letters, marks, digits, and apostrophes
  // or hyphens between them.
  const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
  const EDGE_JUNK = /^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu;

  function tokens(line) {
    // Split on whitespace and on dashes used as punctuation (em/en dash, "--").
    return String(line || '')
      .split(/[\s—–]+|-{2,}/u)
      .map((t) => t.replace(EDGE_JUNK, ''))
      .filter((t) => WORD_CHAR.test(t));
  }

  /** The last word of a line, ignoring trailing punctuation and whitespace. */
  function extractEndWord(line) {
    const t = tokens(line);
    return t.length ? t[t.length - 1] : '';
  }

  /** Lowercase comparison key: curly quotes and diacritics folded. */
  function normalizeWord(word) {
    return String(word || '')
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[‘’ʼ]/g, "'")
      .replace(EDGE_JUNK, '');
  }

  function stem(w) {
    w = w.replace(/'s$|s'$/, '');
    // Inflections only; comparatives like "darker" are caught by the prefix rule.
    const rules = [
      [/ies$/, 'y'], [/ied$/, 'y'], [/(ss|sh|ch|x|z)es$/, '$1'],
      [/ing$/, ''], [/ed$/, ''], [/es$/, 'e'], [/([^s])s$/, '$1'],
    ];
    for (const [re, rep] of rules) {
      if (re.test(w) && w.replace(re, rep).length >= 2) {
        w = w.replace(re, rep);
        break;
      }
    }
    // "running" → "runn" → "run"; "hoped" → "hop" ≈ "hope" is handled below.
    w = w.replace(/([^aeiou])\1$/, '$1');
    return w.replace(/e$/, '');
  }

  // A rough sound-alike key, so homophones like "knight/night" or
  // "rain/reign" can be matched.
  function soundKey(w) {
    return w
      .replace(/^kn|^gn|^pn/, 'n')
      .replace(/^wr/, 'r')
      .replace(/^wh/, 'w')
      .replace(/igh/g, 'i')
      .replace(/eigh/g, 'ay')
      .replace(/ign$/, 'in')
      .replace(/mb$/, 'm')
      .replace(/ph/g, 'f')
      .replace(/gh/g, '')
      .replace(/ck/g, 'k')
      .replace(/c(?=[eiy])/g, 's')
      .replace(/c/g, 'k')
      .replace(/q/g, 'k')
      .replace(/z/g, 's')
      .replace(/(ee|ea|ie|ei|ey)/g, 'E')
      .replace(/(ai|ay|ei)/g, 'A')
      .replace(/(oa|ow|oe)/g, 'O')
      .replace(/e$/, '')
      .replace(/(.)\1+/g, '$1');
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /**
   * Compare a written word with the word it is supposed to be.
   * Returns 'exact', 'variant' (plural, tense, homophone, near-spelling) or 'none'.
   */
  function compareWords(written, required) {
    const a = normalizeWord(written);
    const b = normalizeWord(required);
    if (!a || !b) return 'none';
    if (a === b) return 'exact';
    if (stem(a) === stem(b)) return 'variant';
    const sa = soundKey(a);
    const sb = soundKey(b);
    if (sa === sb && Math.min(a.length, b.length) >= 3) return 'variant';
    const min = Math.min(a.length, b.length);
    const dist = Math.min(levenshtein(a, b), levenshtein(sa, sb));
    if (min >= 3 && dist <= 1) return 'variant';
    if (min >= 6 && dist <= 2) return 'variant';
    // Prefix forms: "sea" / "season" are too far apart, "light" / "lightning" are not.
    if (min >= 4 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 4) {
      return 'variant';
    }
    return 'none';
  }

  /** Pairs [i, j] (1-based) of stanza 1 end words that are identical. */
  function duplicateEndWords(endWords) {
    const out = [];
    const norm = endWords.map(normalizeWord);
    for (let i = 0; i < norm.length; i++) {
      for (let j = i + 1; j < norm.length; j++) {
        if (norm[i] && norm[i] === norm[j]) out.push([i + 1, j + 1]);
      }
    }
    return out;
  }

  /* ---------- structure ---------- */

  /** End-word number (1–6) for stanza s (1–6), line l (1–6). */
  function endWordIndex(stanza, line) {
    return ROTATION[stanza - 1][line - 1];
  }

  function isValidEnvoiPattern(pattern) {
    return (
      Array.isArray(pattern) &&
      pattern.length === ENVOI_LINES &&
      pattern.every(
        (p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 1 && n <= 6)
      )
    );
  }

  /** Numbers 1–6 that the envoi pattern never uses, for a gentle warning. */
  function envoiMissing(pattern) {
    const used = new Set(pattern.flat());
    return [1, 2, 3, 4, 5, 6].filter((n) => !used.has(n));
  }

  /**
   * The required word for every line, given the six stanza 1 lines (or end
   * words) and an envoi pattern.
   */
  function buildSchema(stanza1Lines, envoiPattern) {
    const pattern = isValidEnvoiPattern(envoiPattern) ? envoiPattern : DEFAULT_ENVOI;
    const words = [];
    for (let i = 0; i < LINES; i++) words.push(extractEndWord(stanza1Lines[i] || ''));
    const at = (n) => ({ index: n, word: words[n - 1] });
    return {
      endWords: words,
      stanzas: ROTATION.map((row) => row.map(at)),
      envoi: pattern.map(([mid, end]) => ({ mid: at(mid), end: at(end) })),
    };
  }

  /* ---------- line checking ---------- */

  /**
   * State of a later line (stanzas 2–6) given what the poet typed and the
   * required end word. The required word is pinned after the text unless the
   * text already ends with it (or with a variant of it).
   *
   *   status: 'empty'    nothing written yet
   *           'ok'       complete: either typed the word or it is appended
   *           'variant'  ends with a variant of the word, awaiting acceptance
   *           'accepted' ends with a variant the poet accepted
   *   full:   the complete line as it will be exported
   *   appended: true when the pinned word is added after the typed text
   */
  function lineState(text, required, acceptedWord) {
    const raw = String(text || '');
    const trimmed = raw.trim();
    const last = extractEndWord(trimmed);
    if (!last) {
      return { status: 'empty', full: required || '', lastWord: '', appended: true, match: 'none' };
    }
    const match = required ? compareWords(last, required) : 'none';
    const accepted = !!acceptedWord && normalizeWord(acceptedWord) === normalizeWord(last);
    if (match === 'exact') {
      return { status: 'ok', full: trimmed, lastWord: last, appended: false, match };
    }
    if (accepted) {
      return { status: 'accepted', full: trimmed, lastWord: last, appended: false, match };
    }
    if (match === 'variant') {
      return { status: 'variant', full: trimmed, lastWord: last, appended: false, match };
    }
    const full = required ? trimmed.replace(/\s+$/, '') + ' ' + required : trimmed;
    return { status: 'ok', full, lastWord: last, appended: true, match };
  }

  /**
   * Like lineState, and also looks for the mid-line word somewhere before
   * the end word. midFound is 'exact', 'variant' or null.
   */
  function envoiLineState(text, mid, end, acceptedWord) {
    const st = lineState(text, end, acceptedWord);
    const words = tokens(text);
    const body = st.appended ? words : words.slice(0, -1);
    let midFound = null;
    for (const w of body) {
      const m = compareWords(w, mid);
      if (m === 'exact') { midFound = 'exact'; break; }
      if (m === 'variant') midFound = 'variant';
    }
    return Object.assign(st, { midFound });
  }

  function isLineComplete(state, isEnvoi) {
    if (state.status !== 'ok' && state.status !== 'accepted') return false;
    return isEnvoi ? state.midFound !== null : true;
  }

  /* ---------- poem model ---------- */

  function emptyLine() {
    return { text: '', accepted: '' };
  }

  function createPoem() {
    const later = [];
    for (let s = 1; s < STANZAS; s++) later.push(Array.from({ length: LINES }, emptyLine));
    return {
      version: 1,
      title: '',
      stanza1: Array(LINES).fill(''),
      later, // stanzas 2–6
      envoi: Array.from({ length: ENVOI_LINES }, emptyLine),
      envoiPattern: DEFAULT_ENVOI.map((p) => p.slice()),
    };
  }

  /** Repair a poem loaded from storage or elsewhere into a valid shape. */
  function normalizePoem(p) {
    const base = createPoem();
    if (!p || typeof p !== 'object') return base;
    const str = (v) => (typeof v === 'string' ? v : '');
    const line = (v) => ({ text: str(v && v.text), accepted: str(v && v.accepted) });
    base.title = str(p.title);
    for (let i = 0; i < LINES; i++) base.stanza1[i] = str(p.stanza1 && p.stanza1[i]);
    for (let s = 0; s < STANZAS - 1; s++) {
      for (let i = 0; i < LINES; i++) base.later[s][i] = line(p.later && p.later[s] && p.later[s][i]);
    }
    for (let i = 0; i < ENVOI_LINES; i++) base.envoi[i] = line(p.envoi && p.envoi[i]);
    if (isValidEnvoiPattern(p.envoiPattern)) base.envoiPattern = p.envoiPattern.map((x) => x.slice());
    return base;
  }

  /** Full evaluation of a poem: the schema plus the state of every line. */
  function evaluate(poem) {
    const schema = buildSchema(poem.stanza1, poem.envoiPattern);
    const stanzas = [];
    stanzas.push(
      poem.stanza1.map((text, i) => {
        const word = schema.endWords[i];
        return {
          status: word ? 'ok' : 'empty',
          full: String(text).trim(),
          complete: !!word,
          required: schema.stanzas[0][i],
        };
      })
    );
    for (let s = 1; s < STANZAS; s++) {
      stanzas.push(
        poem.later[s - 1].map((ln, i) => {
          const req = schema.stanzas[s][i];
          const st = lineState(ln.text, req.word, ln.accepted);
          return Object.assign(st, { complete: isLineComplete(st, false), required: req });
        })
      );
    }
    const envoi = poem.envoi.map((ln, i) => {
      const req = schema.envoi[i];
      const st = envoiLineState(ln.text, req.mid.word, req.end.word, ln.accepted);
      return Object.assign(st, { complete: isLineComplete(st, true), required: req.end, mid: req.mid });
    });
    const all = stanzas.flat().concat(envoi);
    return {
      schema,
      stanzas,
      envoi,
      done: all.filter((l) => l.complete).length,
      total: TOTAL_LINES,
      duplicates: duplicateEndWords(schema.endWords),
    };
  }

  /* ---------- plain text ---------- */

  const EMPTY_MARK = '…';

  /**
   * Plain-text export: optional title, then stanzas separated by blank lines.
   * An unwritten line in stanzas 2–6 or the envoi is exported as "…" so the
   * stanza shape survives a round trip.
   */
  function toPlainText(poem) {
    const ev = evaluate(poem);
    const blocks = [];
    if (poem.title.trim()) blocks.push(poem.title.trim());
    blocks.push(poem.stanza1.map((t) => t.trim() || EMPTY_MARK).join('\n'));
    for (let s = 1; s < STANZAS; s++) {
      blocks.push(ev.stanzas[s].map((l) => (l.status === 'empty' ? EMPTY_MARK : l.full)).join('\n'));
    }
    blocks.push(ev.envoi.map((l) => (l.status === 'empty' ? EMPTY_MARK : l.full)).join('\n'));
    return blocks.join('\n\n') + '\n';
  }

  /**
   * Parse a plain-text sestina (as written by toPlainText) back into a poem.
   * Stanzas are split on blank lines. A leading block of one line counts as
   * the title when there are more blocks than a sestina needs. If the blocks
   * are malformed, the non-empty lines are read in order instead.
   */
  function fromPlainText(text, envoiPattern) {
    const clean = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    let blocks = clean
      .split(/\n[ \t]*\n+/)
      .map((b) => b.split('\n').map((l) => l.trim()).filter((l) => l !== ''))
      .filter((b) => b.length);

    let title = '';
    let lines;
    const shapeOk = (bs) => bs.length === 7 && bs.slice(0, 6).every((b) => b.length === 6) && bs[6].length === 3;
    if (blocks.length === 8 && blocks[0].length === 1 && shapeOk(blocks.slice(1))) {
      title = blocks[0][0];
      lines = blocks.slice(1).flat();
    } else if (shapeOk(blocks)) {
      lines = blocks.flat();
    } else {
      lines = blocks.flat();
      if (lines.length === TOTAL_LINES + 1) title = lines.shift();
      if (lines.length < 1) throw new Error('No poem found in that text.');
    }

    const poem = createPoem();
    if (isValidEnvoiPattern(envoiPattern)) poem.envoiPattern = envoiPattern.map((x) => x.slice());
    poem.title = title;
    const val = (l) => (l === undefined || l === EMPTY_MARK || l === '...' ? '' : l);
    for (let i = 0; i < LINES; i++) poem.stanza1[i] = val(lines[i]);
    for (let s = 1; s < STANZAS; s++) {
      for (let i = 0; i < LINES; i++) poem.later[s - 1][i].text = val(lines[s * LINES + i]);
    }
    for (let i = 0; i < ENVOI_LINES; i++) poem.envoi[i].text = val(lines[STANZAS * LINES + i]);

    // An imported line that ends in a variant was accepted when it was
    // exported, so keep it accepted.
    const ev = evaluate(poem);
    ev.stanzas.slice(1).forEach((st, s) =>
      st.forEach((l, i) => { if (l.status === 'variant') poem.later[s][i].accepted = l.lastWord; })
    );
    ev.envoi.forEach((l, i) => { if (l.status === 'variant') poem.envoi[i].accepted = l.lastWord; });
    return poem;
  }

  return {
    STANZAS,
    LINES,
    ENVOI_LINES,
    TOTAL_LINES,
    ROTATION,
    ROTATION_STEP,
    DEFAULT_ENVOI,
    ENVOI_PRESETS,
    nextStanza,
    extractEndWord,
    normalizeWord,
    compareWords,
    duplicateEndWords,
    endWordIndex,
    isValidEnvoiPattern,
    envoiMissing,
    buildSchema,
    lineState,
    envoiLineState,
    isLineComplete,
    createPoem,
    normalizePoem,
    evaluate,
    toPlainText,
    fromPlainText,
  };
});
