'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/sestina.js');

const STANZA1 = [
  'September rain falls on the house.',
  'In the failing light, the old grandmother',
  'sits in the kitchen with the child',
  'beside the Little Marvel Stove,',
  'reading the jokes from the almanac,',
  'laughing and talking to hide her tears.',
];
const WORDS = ['house', 'grandmother', 'child', 'Stove', 'almanac', 'tears'];

test('extractEndWord ignores trailing punctuation and whitespace', () => {
  const cases = [
    ['September rain falls on the house.', 'house'],
    ['the old grandmother   ', 'grandmother'],
    ['to hide her tears.”', 'tears'],
    ['“Where are you?” ', 'you'],
    ['a question, then the sea?!', 'sea'],
    ['and then—the stove—', 'stove'],
    ['words -- almanac', 'almanac'],
    ['(parenthetical child)', 'child'],
    ['it was, …', 'was'],
    ['she won’t.', 'won’t'],
    ["sea-bound;", 'sea-bound'],
    ['café,', 'café'],
    ['  ', ''],
    ['!!! …', ''],
    ['', ''],
  ];
  for (const [line, word] of cases) assert.equal(S.extractEndWord(line), word, JSON.stringify(line));
});

test('extractEndWord tolerates non-string input', () => {
  assert.equal(S.extractEndWord(undefined), '');
  assert.equal(S.extractEndWord(null), '');
});

test('the full 6-stanza rotation table (retrogradatio cruciata)', () => {
  assert.deepEqual(
    S.ROTATION.map((r) => [...r]),
    [
      [1, 2, 3, 4, 5, 6],
      [6, 1, 5, 2, 4, 3],
      [3, 6, 4, 1, 2, 5],
      [5, 3, 2, 6, 1, 4],
      [4, 5, 1, 3, 6, 2],
      [2, 4, 6, 5, 3, 1],
    ]
  );
});

test('rotation: one more step returns to stanza 1, and every column is a permutation', () => {
  assert.deepEqual(S.nextStanza(S.ROTATION[5]), [1, 2, 3, 4, 5, 6]);
  for (let line = 0; line < 6; line++) {
    const col = S.ROTATION.map((r) => r[line]).sort();
    assert.deepEqual(col, [1, 2, 3, 4, 5, 6], `line ${line + 1} uses every word once`);
  }
});

test('endWordIndex matches the table', () => {
  assert.equal(S.endWordIndex(1, 1), 1);
  assert.equal(S.endWordIndex(2, 1), 6);
  assert.equal(S.endWordIndex(4, 3), 2);
  assert.equal(S.endWordIndex(6, 6), 1);
});

test('buildSchema maps real words through every stanza', () => {
  const schema = S.buildSchema(STANZA1);
  assert.deepEqual(schema.endWords, WORDS);
  const words = schema.stanzas.map((st) => st.map((x) => x.word));
  assert.deepEqual(words[0], WORDS);
  assert.deepEqual(words[1], ['tears', 'house', 'almanac', 'grandmother', 'Stove', 'child']);
  assert.deepEqual(words[5], ['grandmother', 'Stove', 'tears', 'almanac', 'child', 'house']);
  for (let s = 0; s < 6; s++) {
    for (let l = 0; l < 6; l++) assert.equal(schema.stanzas[s][l].word, WORDS[S.ROTATION[s][l] - 1]);
  }
});

test('buildSchema updates when a stanza 1 line changes', () => {
  const lines = STANZA1.slice();
  lines[0] = 'September rain falls on the roof,';
  const schema = S.buildSchema(lines);
  assert.equal(schema.stanzas[1][1].word, 'roof');
  assert.equal(schema.stanzas[5][5].word, 'roof');
  assert.equal(schema.envoi[2].end.word, 'roof');
});

test('default envoi mapping is (2…5), (4…3), (6…1)', () => {
  assert.deepEqual(S.DEFAULT_ENVOI.map((p) => [...p]), [[2, 5], [4, 3], [6, 1]]);
  const env = S.buildSchema(STANZA1).envoi;
  assert.deepEqual(
    env.map((e) => [e.mid.index, e.end.index]),
    [[2, 5], [4, 3], [6, 1]]
  );
  assert.deepEqual(
    env.map((e) => [e.mid.word, e.end.word]),
    [['grandmother', 'almanac'], ['Stove', 'child'], ['tears', 'house']]
  );
});

test('envoi mapping follows a custom pattern and rejects invalid ones', () => {
  const env = S.buildSchema(STANZA1, [[5, 2], [3, 4], [1, 6]]).envoi;
  assert.deepEqual(env.map((e) => [e.mid.word, e.end.word]), [
    ['almanac', 'grandmother'],
    ['child', 'Stove'],
    ['house', 'tears'],
  ]);
  assert.equal(S.isValidEnvoiPattern([[1, 2], [3, 4]]), false);
  assert.equal(S.isValidEnvoiPattern([[1, 2], [3, 4], [5, 7]]), false);
  // An invalid pattern falls back to the default.
  const fallback = S.buildSchema(STANZA1, [[0, 0]]).envoi;
  assert.deepEqual(fallback.map((e) => [e.mid.index, e.end.index]), [[2, 5], [4, 3], [6, 1]]);
  assert.deepEqual(S.envoiMissing([[1, 2], [1, 2], [3, 4]]), [5, 6]);
  for (const preset of S.ENVOI_PRESETS) assert.ok(S.isValidEnvoiPattern(preset.pattern), preset.id);
});

test('compareWords: exact, variant, none', () => {
  assert.equal(S.compareWords('House', 'house'), 'exact');
  assert.equal(S.compareWords('houses', 'house'), 'variant');
  assert.equal(S.compareWords('cried', 'cry'), 'variant');
  assert.equal(S.compareWords('laughing', 'laugh'), 'variant');
  assert.equal(S.compareWords('knight', 'night'), 'variant');
  assert.equal(S.compareWords('reign', 'rain'), 'variant');
  assert.equal(S.compareWords('stone', 'house'), 'none');
  assert.equal(S.compareWords('', 'house'), 'none');
});

test('duplicate end words are reported', () => {
  assert.deepEqual(S.duplicateEndWords(['sea', 'Sea.', 'x', '', '', 'y']), [[1, 2]]);
  assert.deepEqual(S.duplicateEndWords(WORDS), []);
});

test('lineState pins the word, recognises typed words and variants', () => {
  assert.equal(S.lineState('', 'house').status, 'empty');
  const appended = S.lineState('I walked back to the', 'house');
  assert.equal(appended.status, 'ok');
  assert.equal(appended.full, 'I walked back to the house');
  const typed = S.lineState('I walked back to the house.', 'house');
  assert.equal(typed.status, 'ok');
  assert.equal(typed.appended, false);
  assert.equal(typed.full, 'I walked back to the house.');
  const variant = S.lineState('between the houses', 'house');
  assert.equal(variant.status, 'variant');
  assert.equal(S.lineState('between the houses', 'house', 'houses').status, 'accepted');
  // A pun the heuristics cannot see can still be accepted by hand.
  assert.equal(S.lineState('a mouse', 'house', 'mouse').status, 'accepted');
});

test('envoi lines need the mid-line word as well', () => {
  const ok = S.envoiLineState('the grandmother reads the almanac', 'grandmother', 'almanac');
  assert.equal(ok.midFound, 'exact');
  assert.ok(S.isLineComplete(ok, true));
  const noMid = S.envoiLineState('she reads the', 'grandmother', 'almanac');
  assert.equal(noMid.midFound, null);
  assert.ok(!S.isLineComplete(noMid, true));
  const variantMid = S.envoiLineState('grandmothers read the', 'grandmother', 'almanac');
  assert.equal(variantMid.midFound, 'variant');
  assert.ok(S.isLineComplete(variantMid, true));
});

test('evaluate counts progress out of 39', () => {
  const poem = S.createPoem();
  assert.equal(S.evaluate(poem).done, 0);
  assert.equal(S.evaluate(poem).total, 39);
  poem.stanza1 = STANZA1.slice();
  poem.later[0][0].text = 'The tea kettle';
  poem.later[0][1].text = 'between the houses';
  assert.equal(S.evaluate(poem).done, 7);
  poem.later[0][1].accepted = 'houses';
  assert.equal(S.evaluate(poem).done, 8);
});

test('plain text export and import round-trip', () => {
  const poem = S.createPoem();
  poem.title = 'Sestina';
  poem.stanza1 = STANZA1.slice();
  poem.later[0][0].text = 'The iron kettle sings and hides her';
  poem.later[0][1].text = 'between the houses';
  poem.later[0][1].accepted = 'houses';
  poem.envoi[0].text = 'Time to plant tears, says the grandmother,';
  const text = S.toPlainText(poem);
  const blocks = text.trim().split('\n\n');
  assert.equal(blocks.length, 8);
  assert.equal(blocks[0], 'Sestina');
  assert.equal(blocks[2].split('\n')[0], 'The iron kettle sings and hides her tears');
  assert.equal(blocks[7].split('\n').length, 3);

  const back = S.fromPlainText(text);
  assert.equal(back.title, 'Sestina');
  assert.deepEqual(back.stanza1, STANZA1);
  assert.equal(back.later[0][0].text, 'The iron kettle sings and hides her tears');
  assert.equal(back.later[0][1].accepted, 'houses');
  assert.equal(back.later[0][2].text, '');
  assert.equal(S.toPlainText(back), text);
});

test('import without a title and with Windows line endings', () => {
  const poem = S.createPoem();
  poem.stanza1 = STANZA1.slice();
  const text = S.toPlainText(poem).replace(/\n/g, '\r\n');
  const back = S.fromPlainText(text);
  assert.equal(back.title, '');
  assert.deepEqual(back.stanza1, STANZA1);
});

test('normalizePoem repairs partial data', () => {
  const p = S.normalizePoem({ title: 'T', stanza1: ['a sea'], envoiPattern: 'bad' });
  assert.equal(p.title, 'T');
  assert.equal(p.stanza1.length, 6);
  assert.equal(p.later.length, 5);
  assert.deepEqual(p.envoiPattern, [[2, 5], [4, 3], [6, 1]]);
});
