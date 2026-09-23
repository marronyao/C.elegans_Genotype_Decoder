"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseGenotype } = require("../src/parser.js");

test("general example has three expressions and six intact fragments", () => {
  const original = "ser-2P3(1.6k)_GFP::C34B2.10(rER); POLO36; ord-1::GFP";
  const result = parseGenotype(original);
  assert.equal(result.original, original);
  assert.equal(result.normalised, original);
  assert.equal(result.complete, true);
  assert.equal(result.expressions.length, 3);
  assert.deepEqual(result.constructs.map(c => c.elements.map(e => e.text.trim())), [
    ["ser-2P3(1.6k)", "GFP", "C34B2.10(rER)"], ["POLO36"], ["ord-1", "GFP"],
  ]);
  assert.equal(result.fragments.length, 6);
  assert.equal(result.suggestions.length, 0);
  for (const fragment of result.fragments) assert.equal(result.normalised.slice(fragment.start, fragment.end), fragment.text);
});

test("Markdown escaped underscore is normalised with a change record", () => {
  const original = String.raw`ser-2P3(1.6k)\_GFP::C34B2.10(rER)`;
  const result = parseGenotype(original);
  assert.equal(result.original, original);
  assert.equal(result.fragments.length, 3);
  assert.equal(result.changes[0].stage, "escape");
  assert.equal(result.changes[0].before, String.raw`\_`);
});

test("nested annotations protect every separator", () => {
  const result = parseGenotype("tag(a;b+c_d::e)::GFP; rol-6(+); name{x;y}::tail");
  assert.equal(result.complete, true);
  assert.equal(result.expressions.length, 3);
  assert.deepEqual(result.fragments.map(f => f.text.trim()), ["tag(a;b+c_d::e)", "GFP", "rol-6(+)", "name{x;y}", "tail"]);
});

test("mixed arrays and free expressions retain their grouping", () => {
  const result = parseGenotype("abEx1 [a::b + c]; POLO36; cdIs2 [d::e] + ord-1::GFP");
  assert.equal(result.complete, true);
  assert.equal(result.constructs.length, 5);
  assert.deepEqual(result.constructs.map(c => c.expressionIndex), [0, 0, 1, 2, 2]);
  assert.deepEqual(result.identifiers.map(i => i.text), ["abEx1", "cdIs2"]);
});

test("promoter normalisation and confirmation also work outside arrays", () => {
  const first = parseGenotype("Pmtl-2::GFP; mtl2p::X");
  assert.equal(first.normalised, "mtl-2p::GFP; mtl2p::X");
  assert.equal(first.suggestions.length, 1);
  const result = parseGenotype(first.original, { acceptedCorrections: [first.suggestions[0].id] });
  assert.equal(result.normalised, "mtl-2p::GFP; mtl-2p::X");
  assert.equal(result.complete, true);
});

test("unsupported plain text is retained and malformed general expressions are flagged", () => {
  assert.equal(parseGenotype("POLO36").fragments[0].text, "POLO36");
  for (const original of ["a;;b", "a__b", "a::", "a(b;c", "a)b;c"]) {
    const result = parseGenotype(original);
    assert.equal(result.original, original);
    assert.equal(result.complete, false, original);
  }
  const trailing = parseGenotype("abEx1 [x] unseparated");
  assert.ok(trailing.warnings.some(w => w.code === "TRAILING_TEXT"));
});
