"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normaliseInput } = require("../src/normalise.js");
const { parseGenotype } = require("../src/parser.js");

test("standard input preserves the original and separates two constructs", () => {
  const original = "dvIs100 [unc-54p::Aβ1-42::unc-54 3'UTR + mtl-2p::GFP]";
  const result = parseGenotype(original);
  assert.equal(result.original, original);
  assert.equal(result.normalised, original);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.identifier, { text: "dvIs100", prefix: "dv", designation: "Is", number: "100", start: 0, end: 7 });
  assert.equal(result.complete, true);
  assert.deepEqual(result.constructs.map(c => c.elements.map(e => e.text.trim())), [
    ["unc-54p", "Aβ1-42", "unc-54 3'UTR"], ["mtl-2p", "GFP"],
  ]);
});

test("Ex designation and number text are retained", () => {
  assert.deepEqual(parseGenotype("abEx001 [x]").identifier, { text: "abEx001", prefix: "ab", designation: "Ex", number: "001", start: 0, end: 7 });
});

test("full-width conversion logs every change at its original position", () => {
  const original = "ｄｖＩｓ１００　［unc-54p：：GFP ＋ rol-6（＋）］";
  const result = parseGenotype(original);
  assert.equal(result.original, original);
  assert.equal(result.normalised, "dvIs100 [unc-54p::GFP + rol-6(+)]");
  assert.equal(result.complete, true);
  assert.equal(result.constructs.length, 2);
  let reconstructed = "";
  for (let i = 0; i < original.length; i += 1) {
    const change = result.changes.find(c => c.index === i);
    if (change) assert.equal(change.before, original[i]);
    reconstructed += change ? change.after : original[i];
  }
  assert.equal(reconstructed, result.normalised);
  assert.equal(result.changes.length, [...original].filter((c, i) => c !== result.normalised[i]).length);
});

test("missing closing bracket gives provisional components without inserting text", () => {
  const original = "dvIs100 [a::b + c";
  const result = parseGenotype(original);
  assert.equal(result.normalised, original);
  assert.equal(result.complete, false);
  assert.equal(result.constructs.length, 2);
  assert.ok(result.warnings.some(w => w.code === "UNCLOSED_BRACKET"));
  assert.deepEqual(result.changes, []);
});

test("missing opening bracket does not invent component boundaries", () => {
  const original = "dvIs100 a::b + c]";
  const result = parseGenotype(original);
  assert.equal(result.constructs.length, 0);
  assert.ok(result.warnings.some(w => w.code === "MISSING_OPENING_BRACKET"));
  assert.equal(result.unknownFragments[0].text, original);
});

test("nested plus and double colons remain within their expression", () => {
  const result = parseGenotype("abEx1 [p::GFP + rol-6(+) + wrapper[a::b+c] + tag{x+y}]");
  assert.equal(result.complete, true);
  assert.deepEqual(result.constructs.map(c => c.text.trim()), ["p::GFP", "rol-6(+)", "wrapper[a::b+c]", "tag{x+y}"]);
  assert.equal(result.constructs[2].elements.length, 1);
});

test("unknown elements and source spans survive without guessed identities", () => {
  const result = parseGenotype("dvIs100 [mysteryPromoter::unknownPayload]");
  assert.deepEqual(result.unknownFragments.map(f => f.text), ["mysteryPromoter", "unknownPayload"]);
  assert.ok(result.constructs[0].elements.every(e => e.kind === "unknown"));
  for (const fragment of result.unknownFragments) assert.equal(result.normalised.slice(fragment.start, fragment.end), fragment.text);
});

test("ambiguous labels and scientific characters are not silently corrected", () => {
  for (const label of ["dvls100", "dvis100", "DVIs100"]) {
    const original = `${label} [unc54::Aβ₁–₄₂::3′UTR]`;
    const result = parseGenotype(original);
    assert.equal(result.identifier, null);
    assert.equal(result.normalised, original);
    assert.deepEqual(result.changes, []);
    assert.ok(result.warnings.some(w => w.code === "UNRECOGNISED_IDENTIFIER"));
  }
});

test("mismatched brackets, empty constructs and empty elements require attention", () => {
  for (const text of ["abEx1 [(a]]", "abEx1 [a + ]", "abEx1 [a::::b]", "abEx1 []"]) {
    const result = parseGenotype(text);
    assert.equal(result.complete, false, text);
    assert.ok(result.warnings.length > 0, text);
    assert.equal(result.normalised, text);
  }
});

test("semicolon-separated arrays are parsed independently", () => {
  const result = parseGenotype("abEx1 [x] ; cdIs2 [y]");
  assert.equal(result.constructs.length, 2);
  assert.deepEqual(result.identifiers.map(id => id.text), ["abEx1", "cdIs2"]);
  assert.equal(result.complete, true);
});

test("empty input produces a diagnostic and invalid API types are rejected", () => {
  assert.equal(parseGenotype("  ").warnings[0].code, "EMPTY_INPUT");
  assert.throws(() => normaliseInput(null), TypeError);
});

