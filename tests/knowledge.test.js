"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseGenotype } = require("../src/parser.js");
const { candidates, createClient } = require("../src/knowledge.js");
// Reduced fixtures follow the live Alliance search response checked on 2026-09-23.
const gene = { id: "WB:WBGene00006766", category: "gene_search_result", species: "Caenorhabditis elegans", symbol: "unc-30", systematicName: "B0564.10", synonyms: ["CELE_B0564.10"], geneDescription: "A database gene description.", automatedGeneDescription: "Predicted activity." };
const allele = { id: "WB:WBVar00143025", category: "allele_search_result", species: "Caenorhabditis elegans", symbol: "e191", geneCrossReferences: [gene.id], variantType: ["point_mutation"], molecularConsequence: ["stop_gained"] };
const fragment = text => parseGenotype(text).fragments[0];
function clientFor(rows) {
  const calls = [];
  return { calls, client: createClient(async url => {
    calls.push(url);
    return { ok: true, json: async () => ({ total: rows.length, results: rows }) };
  }) };
}
test("supported fragments and bracketed array identifiers are selected", () => {
  const parsed = parseGenotype("unc-30; B0564.10; WBGene00006766; unc-30(e191); rol-6(+); unc-30(note); mtl-2p::GFP; abEx1 [mCherry]; C34B2.10(rER)");
  assert.equal(candidates(parsed).length, 10);
  assert.equal(parsed.fragments[0].verified, false);
});
test("exact species and name win over fuzzy matches and other species; allele association is checked", async () => {
  const { client } = clientFor([{ ...gene, species: "Homo sapiens", id: "HGNC:1" }, { ...gene, symbol: "unc-300", id: "WB:WBGene00000001" }, gene, allele]);
  const result = await client.annotate(fragment("unc-30(e191)"));
  assert.equal(result.gene.id, gene.id);
  assert.equal(result.gene.summary, gene.geneDescription);
  assert.equal(result.gene.functionAnnotation, "Predicted activity.");
  assert.equal(result.allele.status, "matched");
  assert.match(result.allele.summary, /stop_gained/);
  assert.match(result.allele.summary, /not inferred/);
  assert.ok(result.gene.links.every(l => l.url.startsWith("https://")));
});
test("wrong gene association never assigns allele effects", async () => {
  const { client } = clientFor([gene, { ...allele, geneCrossReferences: ["WB:WBGene00000001"] }]);
  const result = await client.annotate(fragment("unc-30(e191)"));
  assert.equal(result.allele.status, "unverified");
  assert.doesNotMatch(result.allele.summary, /stop_gained/);
});
test("multiple exact records and missing records do not produce fabricated annotations", async () => {
  const { client } = clientFor([gene, { ...gene, id: "WB:WBGene00000001" }]);
  assert.equal((await client.annotate(fragment("unc-30"))).gene.status, "ambiguous");
  assert.equal((await client.annotate(fragment("ord-1"))).gene.status, "not_found");
});
test("sequence identifiers map to the canonical gene and duplicate requests are cached", async () => {
  const { client, calls } = clientFor([gene]);
  const results = await Promise.all([client.annotate(fragment("B0564.10")), client.annotate(fragment("B0564.10"))]);
  assert.equal(calls.length, 1);
  assert.equal(results[0].gene.symbol, "unc-30");
  assert.equal((await client.annotate(fragment("WB:WBGene00006766"))).gene.id, gene.id);
  assert.equal(await client.annotate(fragment("FLAG")), null);
});

test("promoters show only the corresponding gene and source expression sentence", async () => {
  const { client, calls } = clientFor([{ ...gene, automatedGeneDescription: "Enables DNA binding. Located in nucleus. Is expressed in neurons. Human ortholog(s) implicated in disease." }]);
  const result = await client.annotate(fragment("Punc-30"));
  assert.equal(result.promoter.symbol, "unc-30");
  assert.equal(result.promoter.id, gene.id);
  assert.match(result.promoter.summary, /Is expressed in neurons\./);
  assert.doesNotMatch(result.promoter.summary, /DNA binding|nucleus|disease/);
  assert.equal(result.promoter.functionAnnotation, null);
  assert.equal(result.gene, undefined);
  assert.match(result.promoter.note, /has not been verified/);
  await client.annotate(fragment("unc-30p"));
  await client.annotate(fragment("unc-30"));
  assert.equal(calls.length, 1);
});

test("promoters with no expression or no gene match do not infer an expression pattern", async () => {
  const { client } = clientFor([gene]);
  assert.match((await client.annotate(fragment("unc-30p"))).promoter.summary, /not available/);
  assert.equal((await client.annotate(fragment("zzz-999p"))).promoter.status, "not_found");
  assert.equal(await client.annotate(fragment("ser-2P3(1.6k)")), null);
});
test("network errors and invalid responses remain retryable", async () => {
  let count = 0;
  const client = createClient(async () => {
    if (++count === 1) throw new Error("offline");
    if (count === 2) return { ok: true, json: async () => ({ unexpected: [] }) };
    return { ok: true, json: async () => ({ total: 1, results: [gene] }) };
  });
  assert.equal((await client.annotate(fragment("unc-30"))).gene.status, "unavailable");
  assert.equal((await client.annotate(fragment("unc-30"))).gene.status, "unavailable");
  assert.equal((await client.annotate(fragment("unc-30"))).gene.status, "matched");
});
