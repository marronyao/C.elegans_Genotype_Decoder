"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseGenotype } = require("../src/parser.js");
const { candidates, createClient } = require("../src/knowledge.js");

test("UTR suffixes preserve source spans and do not assign the source protein", async () => {
  let calls = 0;
  const client = createClient(() => { calls++; throw new Error("Unexpected lookup"); });
  for (const suffix of [" 3'UTR", " 3’ UTR", " 3′UTR", "(3'UTR)", "_3UTR", "-3'UTR", " 5′ UTR"]) {
    const input = `GFP::unc-54${suffix}`;
    const parsed = parseGenotype(input);
    assert.equal(parsed.original, input);
    assert.equal(parsed.normalised, input);
    assert.equal(parsed.unknownFragments.length, 0);
    assert.equal(parsed.fragments.length, 2);
    const utr = parsed.fragments[1];
    assert.equal(utr.kind, "utr");
    assert.equal(utr.gene, "unc-54");
    assert.equal(utr.proteinCandidate, undefined);
    assert.equal(utr.verified, false);
    assert.equal(parsed.normalised.slice(utr.start, utr.end), utr.text);
    const record = (await client.annotate(utr)).utr;
    assert.match(record.note, /does not encode/);
    assert.ok(record.links.length);
    assert.equal(candidates(parsed).length, 2);
  }
  assert.equal(calls, 0);
});

test("known amyloid peptide aliases resolve offline without worm gene queries", async () => {
  let calls = 0;
  const client = createClient(() => { calls++; throw new Error("Unexpected lookup"); });
  for (const alias of ["Abeta1-42", "Aβ1-42", "Aβ₁–₄₂", "Abeta (1-42)", "A-beta1-42", "ABETA1-42"]) {
    const parsed = parseGenotype(alias);
    assert.equal(parsed.suggestions.length, 0);
    assert.equal(parsed.fragments[0].kind, "peptide");
    const record = (await client.annotate(parsed.fragments[0])).peptide;
    assert.equal(record.symbol, "Aβ1-42");
    assert.match(record.summary, /42 residues/);
    assert.match(record.note, /CL2006/);
    assert.ok(record.reviewedAt);
  }
  for (const [alias, length] of [["Aβ1-40", 40], ["Abeta3-42", 40]]) {
    const fragment = parseGenotype(alias).fragments[0];
    assert.equal(fragment.peptideLength, length);
    assert.equal((await client.annotate(fragment)).peptide.status, "matched");
  }
  assert.equal(calls, 0);
});

test("UTR coverage includes unspecified sources and common transgene source genes", async () => {
  for (const name of ["3′UTR", "5'UTR", "let-858 3'UTR", "tbb-2(3′UTR)", "glh-2_3UTR", "B0564.10 3'UTR"]) {
    const parsed = parseGenotype(name);
    assert.equal(parsed.fragments.length, 1);
    assert.equal(parsed.fragments[0].kind, "utr");
    assert.equal((await createClient().annotate(parsed.fragments[0])).utr.status, "matched");
  }
  const parsed = parseGenotype("unc-54::3'UTR");
  assert.equal(parsed.fragments.length, 2);
  assert.equal(parsed.fragments[0].proteinCandidate, undefined);
  assert.equal(parsed.fragments[1].gene, null);
});

test("unsupported lengths, mutations and regulatory annotations are not guessed", () => {
  for (const name of ["Abeta", "Abeta1-43", "Abeta3-40", "Abeta1-42(A2V)", "xAbeta1-42", "unc-54 3'UTR(long)", "unc-54 3'UTR extra", "unc-54 7'UTR"]) {
    const parsed = parseGenotype(name);
    assert.equal(parsed.fragments[0].kind, "unknown", name);
    assert.equal(parsed.unknownFragments[0].text, name);
  }
  const parsed = parseGenotype("dvIs100 [unc-54p::Abeta1-42::unc-54 3’ UTR + mtl-2p::GFP]");
  assert.equal(parsed.complete, true);
  assert.equal(parsed.unknownFragments.length, 0);
  assert.deepEqual(parsed.constructs[0].elements.map(f => f.kind), ["promoter", "peptide", "utr"]);
});
