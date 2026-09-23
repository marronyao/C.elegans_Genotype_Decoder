"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseGenotype } = require("../src/parser.js");

test("gene and allele identifier are extracted without claiming a verified mutation", () => {
  const result = parseGenotype("unc-30(e191)");
  const fragment = result.fragments[0];
  assert.equal(fragment.kind, "gene_allele");
  assert.equal(fragment.gene, "unc-30");
  assert.equal(fragment.allele, "e191");
  assert.equal(fragment.verified, false);
  assert.equal(fragment.text, "unc-30(e191)");
  assert.equal(result.complete, true);
  assert.equal(result.unknownFragments.length, 0);
});

test("spaces, full-width parentheses and a chromosome label are supported", () => {
  const result = parseGenotype(" unc-30 （ e191 ） IV ");
  assert.equal(result.original, " unc-30 （ e191 ） IV ");
  assert.equal(result.fragments[0].gene, "unc-30");
  assert.equal(result.fragments[0].allele, "e191");
  assert.equal(result.fragments[0].chromosome, "IV");
});

test("allele identifiers must not generate missing-hyphen corrections", () => {
  const result = parseGenotype("unc-30(abc123); unc-30(tm12); unc-30(ok345)");
  assert.equal(result.suggestions.length, 0);
  assert.equal(result.changes.length, 0);
  assert.ok(result.fragments.every(f => f.kind === "gene_allele"));
});

test("gene-name corrections still require confirmation outside allele parentheses", () => {
  const original = "unc30(abc123)";
  const first = parseGenotype(original);
  assert.equal(first.suggestions.length, 1);
  assert.equal(first.suggestions[0].before, "unc30");
  const result = parseGenotype(original, { acceptedCorrections: [first.suggestions[0].id] });
  assert.equal(result.fragments[0].gene, "unc-30");
  assert.equal(result.fragments[0].allele, "abc123");
});

test("placeholders and annotations are retained, not labelled as mutations", () => {
  for (const annotation of ["变异编号", "rER", "1.6k", "", "191", "e191 e192"]) {
    const result = parseGenotype(`unc-30(${annotation})`);
    assert.equal(result.fragments[0].kind, "gene_annotation");
    assert.equal(result.fragments[0].gene, "unc-30");
    assert.equal(result.fragments[0].annotation, annotation);
    assert.equal(result.unknownFragments.length, 1);
  }
  const result = parseGenotype("ser-2P3(1.6k)_GFP::C34B2.10(rER)");
  assert.ok(result.fragments.every(f => f.kind !== "gene_allele"));
});

test("plus notation is not split or classified as a mutant allele", () => {
  const result = parseGenotype("rol-6(+) + unc-30(e191)");
  assert.equal(result.constructs.length, 2);
  assert.equal(result.fragments[0].kind, "gene_reference");
  assert.equal(result.fragments[1].kind, "gene_allele");
});

test("mutant notation coexists with arrays; malformed and compound forms remain intact", () => {
  const result = parseGenotype("unc-30(e191); abEx1 [Pmtl-2::GFP]");
  assert.equal(result.fragments[0].kind, "gene_allele");
  assert.equal(result.fragments[1].kind, "promoter");
  assert.equal(result.complete, true);
  assert.equal(parseGenotype("unc-30(e191").complete, false);
  const compound = parseGenotype("unc-30(e191)/unc-30(+)");
  assert.equal(compound.fragments[0].kind, "unknown");
  assert.equal(compound.fragments[0].text, "unc-30(e191)/unc-30(+)");
});
