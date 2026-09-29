# PoetryCalc

## Sestina

**Live page:** <https://goblinikhan.github.io/PoetryCalc/dist/sestina.html> (served by GitHub Pages from `main`)

Sestina is a writing tool for the sestina form. Write the first stanza and the
app takes the last word of each line (ignoring punctuation) as one of the six
end words. On every keystroke it fills in the other five stanzas and the envoi,
with each line's required word pinned at its right edge. You can then write the
rest of the poem in any order.

- Each end word has its own color everywhere it appears, so you can see the rotation.
- Each line gets a check when it's written and ends with its word. A counter at the top shows progress out of 39 lines.
- If a line ends with a variant (plural, other tense, homophone), it's marked *variant*, and you can accept it. You can also accept a pun the app can't spot by hand.
- If two stanza 1 end words are identical, you get a warning, but nothing is blocked.
- In the envoi, each line shows its mid-line word as a hint and its end word pinned. The envoi pattern is configurable (presets or custom).
- The poem autosaves to `localStorage` when the browser allows it. Otherwise it stays in memory and a note says autosave is off.
- Buttons: copy the poem as plain text, download it as `.txt`, import a `.txt` file (or pasted text), and start a new poem (after a confirmation).

### The rotation (retrogradatio cruciata)

End words are numbered 1–6 by their line in stanza 1.

| Stanza | Line 1 | Line 2 | Line 3 | Line 4 | Line 5 | Line 6 |
|-------:|:------:|:------:|:------:|:------:|:------:|:------:|
| I      | 1 | 2 | 3 | 4 | 5 | 6 |
| II     | 6 | 1 | 5 | 2 | 4 | 3 |
| III    | 3 | 6 | 4 | 1 | 2 | 5 |
| IV     | 5 | 3 | 2 | 6 | 1 | 4 |
| V      | 4 | 5 | 1 | 3 | 6 | 2 |
| VI     | 2 | 4 | 6 | 5 | 3 | 1 |

Envoi, default pattern (mid-line word … end word): **2 … 5**, **4 … 3**, **6 … 1**.

### Files

| Path | What it is |
|------|------------|
| `src/sestina.js` | Pure logic with no DOM code: end-word extraction, rotation, envoi mapping, variant matching, plain-text export/import |
| `src/ui.js`, `src/styles.css`, `src/template.html` | The page |
| `build.js` | Dependency-free build that inlines everything into one file |
| `dist/sestina.html` | The built, self-contained app. Open it in a browser or upload it as an artifact |
| `test/sestina.test.js` | Unit tests |

### Running the tests

Requires Node 18 or newer. There are no dependencies to install.

```sh
node --test      # or: npm test
```

### Rebuilding `dist/sestina.html`

After changing anything in `src/`:

```sh
node build.js    # or: npm run build
```

Commit the regenerated `dist/sestina.html` along with your source changes.
