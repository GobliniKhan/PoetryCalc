/*
 * ui.js: the DOM layer for Sestina. All sestina rules live in the global
 * `Sestina` module (src/sestina.js); this file only renders and saves.
 */
(function () {
  'use strict';

  const S = window.Sestina;
  const STORAGE_KEY = 'sestina.poem.v1';
  const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ---------- storage (optional) ---------- */

  const storage = (function () {
    try {
      const ls = window.localStorage;
      const probe = '__sestina_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    } catch (e) {
      return null;
    }
  })();
  let storageOn = !!storage;

  function loadPoem() {
    if (!storage) return S.createPoem();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return raw ? S.normalizePoem(JSON.parse(raw)) : S.createPoem();
    } catch (e) {
      return S.createPoem();
    }
  }

  let saveTimer = null;
  function scheduleSave() {
    if (!storageOn) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }
  function saveNow() {
    if (!storageOn) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(poem));
    } catch (e) {
      storageOn = false;
      $('storage-note').hidden = false;
    }
  }

  /* ---------- state ---------- */

  let poem = loadPoem();
  const refs = { stanzas: [], envoi: [] }; // DOM references per line

  /* ---------- building the page ---------- */

  function colorClass(index) {
    return 'w' + index;
  }

  function stanzaHead(numeral, pattern, hint) {
    const head = el('h2', 'stanza-head');
    head.appendChild(el('span', 'numeral', numeral));
    if (pattern) {
      const p = el('span', 'pattern');
      p.setAttribute('aria-label', 'End word order ' + pattern.join(' '));
      pattern.forEach((n) => p.appendChild(el('span', colorClass(n), String(n))));
      head.appendChild(p);
    }
    if (hint) head.appendChild(el('span', 'stanza-hint', hint));
    return head;
  }

  // Lines are one-row textareas that grow, so long lines wrap on a phone.
  function autosize(t) {
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
  }

  function lineInput(label, value, placeholder) {
    const input = el('textarea', 'line-text');
    input.rows = 1;
    input.value = value;
    input.placeholder = placeholder || '';
    input.autocomplete = 'off';
    input.spellcheck = true;
    input.setAttribute('aria-label', label);
    input.setAttribute('autocapitalize', 'sentences');
    input.addEventListener('keydown', onLineKeydown);
    // A line is one line: pasted newlines become spaces.
    input.addEventListener('input', () => {
      if (/[\r\n]/.test(input.value)) input.value = input.value.replace(/\s*[\r\n]+\s*/g, ' ');
      autosize(input);
    });
    return input;
  }

  // Buttons inside a line keep the input focused, so the note under a
  // focused line stays open while it is clicked.
  function keepFocus(btn) {
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    return btn;
  }

  function buildLaterLine(label, getLine, isEnvoi) {
    const wrap = el('div', 'line');
    let mid = null;
    if (isEnvoi) {
      mid = { row: el('div', 'mid'), word: el('span', 'mid-word'), state: el('span', 'mid-state') };
      mid.row.appendChild(el('span', '', 'include'));
      mid.row.appendChild(mid.word);
      mid.row.appendChild(mid.state);
      wrap.appendChild(mid.row);
    }
    const row = el('div', 'line-row');
    const input = lineInput(label, getLine().text);
    const pin = el('span', 'pin');
    const mark = el('span', 'mark');
    mark.setAttribute('aria-hidden', 'true');
    row.append(input, pin, mark);
    wrap.appendChild(row);

    // Variant awaiting acceptance / accepted.
    const note = el('div', 'line-note');
    const noteText = el('span');
    const noteBtn = keepFocus(el('button', 'link-btn'));
    noteBtn.type = 'button';
    note.append(noteText, noteBtn);
    note.hidden = true;
    wrap.appendChild(note);

    // Offer to keep the poet's own last word (for puns the matcher misses).
    const own = el('div', 'line-note own');
    const ownBtn = keepFocus(el('button', 'link-btn'));
    ownBtn.type = 'button';
    own.appendChild(ownBtn);
    own.hidden = true;
    wrap.appendChild(own);

    input.addEventListener('input', () => {
      getLine().text = input.value;
      update();
    });
    noteBtn.addEventListener('click', () => {
      const line = getLine();
      const st = refsFor(line).state;
      line.accepted = st.status === 'variant' ? st.lastWord : '';
      update();
    });
    ownBtn.addEventListener('click', () => {
      const line = getLine();
      line.accepted = refsFor(line).state.lastWord;
      update();
      input.focus();
    });

    return { wrap, input, pin, mark, note, noteText, noteBtn, own, ownBtn, mid, getLine, isEnvoi, state: null };
  }

  const lineRefs = new Map();
  function refsFor(line) {
    return lineRefs.get(line);
  }

  function buildPoem() {
    const root = $('poem');
    root.textContent = '';
    refs.stanzas = [];
    refs.envoi = [];
    lineRefs.clear();

    // Stanza 1: the poet's own lines.
    const s1 = el('section', 'stanza');
    s1.appendChild(stanzaHead(NUMERALS[0], S.ROTATION[0], 'Your end words come from these lines'));
    const s1refs = [];
    for (let i = 0; i < S.LINES; i++) {
      const wrap = el('div', 'line ' + colorClass(i + 1));
      const row = el('div', 'line-row');
      const input = lineInput('Stanza 1, line ' + (i + 1), poem.stanza1[i], i === 0 ? 'Begin your first line…' : '');
      const pin = el('span', 'pin');
      const mark = el('span', 'mark');
      mark.setAttribute('aria-hidden', 'true');
      row.append(input, pin, mark);
      wrap.appendChild(row);
      input.addEventListener('input', () => {
        poem.stanza1[i] = input.value;
        update();
      });
      s1.appendChild(wrap);
      s1refs.push({ wrap, input, pin, mark });
    }
    refs.stanzas.push(s1refs);
    root.appendChild(s1);

    // Stanzas 2–6.
    for (let s = 1; s < S.STANZAS; s++) {
      const sec = el('section', 'stanza');
      sec.appendChild(stanzaHead(NUMERALS[s], S.ROTATION[s]));
      const list = [];
      for (let i = 0; i < S.LINES; i++) {
        const r = buildLaterLine('Stanza ' + (s + 1) + ', line ' + (i + 1), () => poem.later[s - 1][i], false);
        lineRefs.set(poem.later[s - 1][i], r);
        sec.appendChild(r.wrap);
        list.push(r);
      }
      refs.stanzas.push(list);
      root.appendChild(sec);
    }

    // Envoi.
    const env = el('section', 'stanza');
    const head = stanzaHead('Envoi');
    head.appendChild(buildEnvoiSettings());
    env.appendChild(head);
    for (let i = 0; i < S.ENVOI_LINES; i++) {
      const r = buildLaterLine('Envoi, line ' + (i + 1), () => poem.envoi[i], true);
      lineRefs.set(poem.envoi[i], r);
      env.appendChild(r.wrap);
      refs.envoi.push(r);
    }
    root.appendChild(env);
  }

  function buildEnvoiSettings() {
    const det = el('details', 'envoi-settings');
    det.appendChild(el('summary', '', 'Envoi pattern'));
    const panel = el('div', 'panel');

    const presetLabel = el('label');
    presetLabel.appendChild(el('span', '', 'Preset'));
    const preset = el('select');
    S.ENVOI_PRESETS.forEach((p) => {
      const o = el('option', '', p.label);
      o.value = p.id;
      preset.appendChild(o);
    });
    preset.appendChild(Object.assign(el('option', '', 'Custom'), { value: 'custom' }));
    presetLabel.appendChild(preset);
    panel.appendChild(presetLabel);

    const selects = [];
    for (let i = 0; i < S.ENVOI_LINES; i++) {
      const lab = el('label');
      lab.appendChild(el('span', '', 'Line ' + (i + 1) + ': middle'));
      const mid = numberSelect();
      lab.appendChild(mid);
      lab.appendChild(el('span', '', 'end'));
      const end = numberSelect();
      lab.appendChild(end);
      panel.appendChild(lab);
      selects.push([mid, end]);
    }
    det.appendChild(panel);

    function sync() {
      const pat = poem.envoiPattern;
      selects.forEach(([m, e], i) => {
        m.value = String(pat[i][0]);
        e.value = String(pat[i][1]);
      });
      const match = S.ENVOI_PRESETS.find((p) => JSON.stringify(p.pattern) === JSON.stringify(pat));
      preset.value = match ? match.id : 'custom';
    }
    preset.addEventListener('change', () => {
      const p = S.ENVOI_PRESETS.find((x) => x.id === preset.value);
      if (!p) return;
      poem.envoiPattern = p.pattern.map((x) => x.slice());
      sync();
      update();
    });
    selects.forEach(([m, e], i) => {
      const onChange = () => {
        poem.envoiPattern[i] = [Number(m.value), Number(e.value)];
        sync();
        update();
      };
      m.addEventListener('change', onChange);
      e.addEventListener('change', onChange);
    });
    sync();
    envoiSync = sync;
    return det;
  }
  let envoiSync = () => {};

  function numberSelect() {
    const s = el('select');
    for (let n = 1; n <= 6; n++) {
      const o = el('option', '', String(n));
      o.value = String(n);
      s.appendChild(o);
    }
    return s;
  }

  // Enter moves to the next line, Shift+Enter to the previous one.
  function onLineKeydown(e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const all = Array.from(document.querySelectorAll('.line-text'));
    const i = all.indexOf(e.target);
    const next = all[i + (e.shiftKey ? -1 : 1)];
    if (next) next.focus();
  }

  /* ---------- updating ---------- */

  function setPin(pin, req, cls) {
    pin.className = 'pin ' + colorClass(req.index) + (cls ? ' ' + cls : '');
    pin.textContent = req.word || 'word ' + req.index;
    if (!req.word) pin.classList.add('unset');
  }

  function renderLaterLine(r, st) {
    r.state = st;
    const req = st.required;
    r.wrap.className = 'line ' + colorClass(req.index);

    let pinCls = '';
    if (st.status === 'ok' && !st.appended) pinCls = 'typed';
    if (st.status === 'variant' || st.status === 'accepted') pinCls = 'replaced';
    setPin(r.pin, req, pinCls);
    r.pin.title = req.word
      ? 'Required end word ' + req.index + ': “' + req.word + '”'
      : 'End word ' + req.index + ' (write stanza 1, line ' + req.index + ')';

    r.mark.className = 'mark';
    r.mark.textContent = '';
    if (st.complete) r.mark.textContent = '✓';
    else if (st.status === 'variant') {
      r.mark.textContent = '~';
      r.mark.classList.add('variant');
    }

    // Variant note.
    if (st.status === 'variant') {
      r.note.hidden = false;
      r.note.className = 'line-note variant';
      r.noteText.textContent = '“' + st.lastWord + '” is a variant of “' + req.word + '”.';
      r.noteBtn.textContent = 'Accept variant';
    } else if (st.status === 'accepted') {
      r.note.hidden = false;
      r.note.className = 'line-note';
      r.noteText.textContent = 'Variant accepted: “' + st.lastWord + '” for “' + req.word + '”.';
      r.noteBtn.textContent = 'Undo';
    } else {
      r.note.hidden = true;
    }

    // "End with … instead": only for a written line whose own last word is
    // being followed by the pinned word.
    const canOwn = st.status === 'ok' && st.appended && req.word && st.lastWord;
    r.own.hidden = !canOwn;
    if (canOwn) r.ownBtn.textContent = 'End with “' + st.lastWord + '” instead (pun or variant)';

    if (r.mid) {
      const mid = st.mid;
      r.mid.word.className = 'mid-word ' + colorClass(mid.index) + (mid.word ? '' : ' unset');
      r.mid.word.textContent = mid.word || 'word ' + mid.index;
      r.mid.state.className = 'mid-state' + (st.midFound === 'variant' ? ' variant' : '');
      r.mid.state.textContent = st.midFound === 'exact' ? '✓' : st.midFound === 'variant' ? '~ variant' : '';
      r.mid.row.title = 'Use end word ' + mid.index + ' somewhere in this line';
    }
  }

  function renderLegend(words) {
    const legend = $('legend');
    legend.textContent = '';
    words.forEach((w, i) => {
      const li = el('li', colorClass(i + 1) + (w ? '' : ' unset'));
      li.appendChild(el('span', 'n', String(i + 1)));
      li.appendChild(el('span', '', w || 'line ' + (i + 1)));
      legend.appendChild(li);
    });
  }

  function renderWarnings(ev) {
    const box = $('warnings');
    box.textContent = '';
    ev.duplicates.forEach(([a, b]) => {
      box.appendChild(
        el('p', '', 'Lines ' + a + ' and ' + b + ' of stanza I both end with “' + ev.schema.endWords[a - 1] +
          '”. That’s allowed, but that word will fill two slots in every stanza.')
      );
    });
    const missing = S.envoiMissing(poem.envoiPattern);
    if (missing.length) {
      box.appendChild(el('p', '', 'This envoi pattern leaves out end word ' + missing.join(' and ') + '.'));
    }
  }

  function update(opts) {
    const ev = S.evaluate(poem);

    // Stanza 1.
    refs.stanzas[0].forEach((r, i) => {
      const req = ev.stanzas[0][i].required;
      setPin(r.pin, req, 'source');
      if (!req.word) r.pin.textContent = 'end word ' + (i + 1);
      r.pin.title = req.word ? 'End word ' + (i + 1) : 'The last word of this line becomes end word ' + (i + 1);
      r.mark.textContent = ev.stanzas[0][i].complete ? '✓' : '';
    });

    for (let s = 1; s < S.STANZAS; s++) {
      refs.stanzas[s].forEach((r, i) => renderLaterLine(r, ev.stanzas[s][i]));
    }
    refs.envoi.forEach((r, i) => renderLaterLine(r, ev.envoi[i]));

    renderLegend(ev.schema.endWords);
    renderWarnings(ev);

    $('progress-text').textContent = ev.done + ' / ' + ev.total + ' lines complete';
    $('progress-fill').style.width = (100 * ev.done) / ev.total + '%';

    if (!(opts && opts.noSave)) scheduleSave();
  }

  function autosizeAll() {
    document.querySelectorAll('.line-text').forEach(autosize);
  }

  function renderAll(opts) {
    $('title').value = poem.title;
    buildPoem();
    envoiSync();
    update(opts);
    autosizeAll();
  }

  /* ---------- modal & toast ---------- */

  let lastFocus = null;
  function openModal(title, body, actions) {
    lastFocus = document.activeElement;
    $('modal-title').textContent = title;
    const b = $('modal-body');
    b.textContent = '';
    (Array.isArray(body) ? body : [body]).forEach((n) => b.appendChild(typeof n === 'string' ? el('p', '', n) : n));
    const a = $('modal-actions');
    a.textContent = '';
    actions.forEach(({ label, cls, onClick }) => {
      const btn = el('button', 'btn' + (cls ? ' ' + cls : ''), label);
      btn.type = 'button';
      btn.addEventListener('click', onClick);
      a.appendChild(btn);
    });
    $('modal').hidden = false;
    const first = b.querySelector('textarea, input') || a.lastElementChild;
    if (first) first.focus();
  }
  function closeModal() {
    $('modal').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('modal').addEventListener('click', (e) => {
    if (e.target === $('modal')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modal').hidden) closeModal();
  });

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  /* ---------- actions ---------- */

  function fileName() {
    const slug = poem.title
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return (slug || 'sestina') + '.txt';
  }

  function showCopyFallback(text) {
    const ta = el('textarea');
    ta.value = text;
    ta.readOnly = true;
    openModal('Copy your poem', ['This page isn’t allowed to use the clipboard. Select the text below and copy it.', ta], [
      { label: 'Done', cls: 'primary', onClick: closeModal },
    ]);
    ta.select();
  }

  function legacyCopy(text) {
    const ta = el('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  $('btn-copy').addEventListener('click', () => {
    const text = S.toPlainText(poem);
    const done = () => toast('Poem copied as plain text');
    const fallback = () => (legacyCopy(text) ? done() : showCopyFallback(text));
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
        return;
      }
    } catch (e) {
      /* fall through */
    }
    fallback();
  });

  $('btn-download').addEventListener('click', () => {
    const text = S.toPlainText(poem);
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const a = el('a');
      a.href = url;
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Saving ' + a.download + '. If nothing downloads, use Copy instead.');
    } catch (e) {
      showCopyFallback(text);
    }
  });

  $('btn-new').addEventListener('click', () => {
    openModal('Start a new poem?', 'This clears every line on the page. Download or copy your poem first if you want to keep it.', [
      { label: 'Cancel', onClick: closeModal },
      {
        label: 'Clear and start over',
        cls: 'danger',
        onClick: () => {
          poem = S.createPoem();
          closeModal();
          renderAll();
          saveNow();
          $('title').focus();
        },
      },
    ]);
  });

  $('btn-import').addEventListener('click', () => {
    const file = el('input', 'file-pick');
    file.type = 'file';
    file.accept = '.txt,text/plain';
    const ta = el('textarea');
    ta.placeholder = '…or paste the text of an exported poem here';
    const err = el('p', 'error');
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => (ta.value = String(reader.result || ''));
      reader.onerror = () => (err.textContent = 'Could not read that file.');
      reader.readAsText(f);
    });
    openModal(
      'Import a poem',
      ['Choose a .txt file you downloaded from Sestina, or paste its text. This replaces the poem on the page.', file, ta, err],
      [
        { label: 'Cancel', onClick: closeModal },
        {
          label: 'Import',
          cls: 'primary',
          onClick: () => {
            if (!ta.value.trim()) {
              err.textContent = 'Choose a file or paste some text first.';
              return;
            }
            try {
              poem = S.fromPlainText(ta.value, poem.envoiPattern);
            } catch (e) {
              err.textContent = e.message || 'That text doesn’t look like a poem.';
              return;
            }
            closeModal();
            renderAll();
            saveNow();
            toast('Poem imported');
          },
        },
      ]
    );
  });

  $('title').addEventListener('input', (e) => {
    poem.title = e.target.value;
    scheduleSave();
  });
  $('title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = document.querySelector('.line-text');
      if (first) first.focus();
    }
  });

  window.addEventListener('pagehide', saveNow);
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(autosizeAll, 100);
  });
  // Web fonts change line widths once they load.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(autosizeAll, () => {});

  /* ---------- start ---------- */

  $('storage-note').hidden = storageOn;
  renderAll({ noSave: true });
})();
