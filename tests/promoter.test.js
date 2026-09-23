"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normaliseInput } = require("../src/normalise.js");
const { parseGenotype } = require("../src/parser.js");

test("prefix and suffix promoter notation produce the same canonical element", () => {
  for (const spelling of ["Pmtl-2", "mtl-2p"]) {
    const original = `abEx1 [${spelling}::GFP]`;
    const result = parseGenotype(original);
    assert.equal(result.original, original);
    assert.equal(result.normalised, "abEx1 [mtl-2p::GFP]");
    assert.equal(result.constructs[0].elements[0].kind, "promoter");
    assert.equal(result.complete, true);
    assert.equal(result.changes.length, spelling === "Pmtl-2" ? 1 : 0);
  }
});

test("missing hyphens in genes and either promoter form require explicit acceptance", () => {
  for (const [before, after] of [["mtl2", "mtl-2"], ["Pmtl2", "mtl-2p"], ["mtl2p", "mtl-2p"]]) {
    const original = `abEx1 [${before}::GFP]`;
    const pending = parseGenotype(original);
    assert.equal(pending.normalised, original);
    assert.equal(pending.complete, false);
    assert.equal(pending.suggestions[0].after, after);
    assert.equal(pending.suggestions[0].status, "pending");
    const confirmed = parseGenotype(original, { acceptedCorrections: [pending.suggestions[0].id] });
    assert.equal(confirmed.original, original);
    assert.equal(confirmed.normalised, `abEx1 [${after}::GFP]`);
    assert.equal(confirmed.complete, true);
    assert.equal(confirmed.changes[0].stage, "confirmed");
  }
});

test("rejecting a suggestion preserves spelling and allows analysis", () => {
  const original = "abEx1 [mtl2]";
  const initial = parseGenotype(original);
  const result = parseGenotype(original, { dismissedCorrections: [initial.suggestions[0].id] });
  assert.equal(result.normalised, original);
  assert.equal(result.complete, true);
  assert.equal(result.suggestions[0].status, "dismissed");
  assert.deepEqual(result.changes, []);
  assert.equal(result.unknownFragments[0].text, "mtl2");
});

test("several corrections keep stable IDs, accurate final spans and replayable changes", () => {
  const original = "ａｂＥｘ１ ［Ｐmtl-2：：mtl2 ＋ Punc54::mtl2p］";
  const first = parseGenotype(original);
  assert.equal(first.suggestions.length, 3);
  const one = parseGenotype(original, { acceptedCorrections: [first.suggestions[0].id] });
  assert.deepEqual(one.suggestions.map(s => s.id), first.suggestions.map(s => s.id));
  const result = parseGenotype(original, { acceptedCorrections: first.suggestions.map(s => s.id) });
  assert.equal(result.normalised, "abEx1 [mtl-2p::mtl-2 + unc-54p::mtl-2p]");
  assert.equal(result.complete, true);
  let replay = original;
  for (const change of result.changes) {
    assert.equal(replay.slice(change.index, change.index + change.before.length), change.before);
    replay = replay.slice(0, change.index) + change.after + replay.slice(change.index + change.before.length);
  }
  assert.equal(replay, result.normalised);
  for (const construct of result.constructs) {
    assert.equal(result.normalised.slice(construct.start, construct.end), construct.text);
    for (const element of construct.elements) assert.equal(result.normalised.slice(element.start, element.end), element.text);
  }
});

test("whole-token boundaries protect labels, payloads and existing hyphenated tokens", () => {
  const original = "Pmtl2 [GFP2::Aβ1-42 + foo_mtl2 + pre-mtl2 + mtl2α + XPmtl-2 + Pmtl-2suffix + mtl-2]";
  const result = normaliseInput(original);
  assert.equal(result.normalised, original);
  assert.deepEqual(result.suggestions, []);
});

test("confirmation does not resolve independent bracket problems", () => {
  const original = "abEx1 [mtl2";
  const pending = parseGenotype(original);
  const result = parseGenotype(original, { acceptedCorrections: [pending.suggestions[0].id] });
  assert.equal(result.normalised, "abEx1 [mtl-2");
  assert.equal(result.complete, false);
  assert.ok(result.warnings.some(w => w.code === "UNCLOSED_BRACKET"));
});

test("normalising canonical promoters again makes no changes", () => {
  const first = normaliseInput("abEx1 [Pmtl-2::GFP + Punc-54::X]");
  assert.equal(normaliseInput(first.normalised).normalised, first.normalised);
  assert.deepEqual(normaliseInput(first.normalised).changes, []);
});
