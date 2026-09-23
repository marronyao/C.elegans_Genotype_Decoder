"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseGenotype } = require("../src/parser.js");
const { candidates, createClient } = require("../src/knowledge.js");
const transgene = { id: "WB:WBTransgene00000410", symbol: "dvIs2", name: "dvIs2", category: "allele_search_result", species: "Caenorhabditis elegans" };
const strain = { id: "WB:WBStrain00005094", name: "CL2006", category: "model_search_result", species: "Caenorhabditis elegans", diseases: ["Alzheimer's disease"] };
const detail = { allele: { primaryExternalId: transgene.id, taxon: { curie: "NCBITaxon:6239" }, relatedNotes: [{ noteType: { name: "transgene_content_summary" }, freeText: "Registered construct contents." }] } };
const fragment = value => parseGenotype(value).fragments[0];
test("transgenes are annotated once per occurrence, inside arrays or alone; strain names remain candidates", () => {
  const parsed = parseGenotype("CL2006; dvIs2 [unc-30p::GFP]; dvIs2; N2; POLO36");
  const items = candidates(parsed);
  assert.deepEqual(items.map(f => f.kind), ["strain", "transgene", "promoter", "fluorescent_protein", "transgene", "strain", "strain"]);
  for (const f of items) assert.equal(parsed.normalised.slice(f.start, f.end), f.text);
  assert.equal(parsed.fragments[0].verified, false);
  assert.equal(fragment("WBTransgene00000410").kind, "transgene");
  assert.equal(fragment("WB:WBStrain00005094").kind, "strain");
  assert.equal(fragment("FLAG").kind, "unknown");
});
test("transgene lookup uses exact IDs and checked detail records, not similarly named alleles", async () => {
  const calls = [];
  const client = createClient(async url => {
    calls.push(url);
    return { ok: true, json: async () => url.includes("/api/allele/") ? detail : { total: 3, results: [transgene, { ...transgene, id: "WB:WBVar00000001" }, { ...transgene, symbol: "dvIs20", name: "dvIs20", id: "WB:WBTransgene00000414" }] } };
  });
  const record = (await client.annotate(fragment("dvIs2"))).transgene;
  assert.equal(record.status, "matched");
  assert.equal(record.id, transgene.id);
  assert.match(record.summary, /Registered construct/);
  assert.match(record.note, /has not been checked/);
  assert.ok(record.links.some(l => l.url.includes("/transgene/")));
  await client.annotate(fragment("dvIs2"));
  assert.equal(calls.length, 2);
});
test("strain matching rejects composite genotypes and other species", async () => {
  const client = createClient(async () => ({ ok: true, json: async () => ({ total: 3, results: [strain, { ...strain, id: "WB:WBGenotype00000137", name: "CL2006 with RNAi" }, { ...strain, id: "WB:WBStrain00000001", species: "Caenorhabditis briggsae" }] }) }));
  const record = (await client.annotate(fragment("CL2006"))).strain;
  assert.equal(record.id, strain.id);
  assert.match(record.summary, /disease-model associations/);
  assert.match(record.note, /does not provide the full genotype/);
  assert.ok(record.links.some(l => l.url === "https://cgc.umn.edu/strain/CL2006"));
  assert.equal((await client.annotate(fragment("ZZ999999"))).strain.status, "not_found");
});

test("curated common strains resolve offline and retain their own source and review date", async () => {
  let calls = 0;
  const client = createClient(async () => { calls++; throw new Error("offline"); });
  for (const name of ["N2", "CB4856", "CB1370", "CF1038"]) {
    const record = (await client.annotate(fragment(name))).strain;
    assert.equal(record.status, "matched");
    assert.equal(record.symbol, name);
    assert.ok(record.reviewedAt);
    assert.equal(record.retrievedAt, undefined);
    assert.ok(record.links.length);
  }
  const n2 = (await client.annotate(fragment("N2"))).strain;
  assert.match(n2.summary, /Bristol wild-type reference strain/);
  assert.match(n2.source, /WormBook/);
  assert.equal(calls, 0);
  assert.equal((await client.annotate(fragment("N20"))).strain.status, "unavailable");
  assert.equal(calls, 1);
  const { lookup } = require("../src/strain-catalogue.js");
  for (const name of ["WT", "N2 (ancestral)", "n2", "N20", "toString"]) assert.equal(lookup(name), null);
});
test("transgene detail identity mismatch preserves identity only and can be retried", async () => {
  let details = 0;
  const client = createClient(async url => ({ ok: true, json: async () => url.includes("/api/allele/") ? (++details === 1 ? { allele: { ...detail.allele, primaryExternalId: "WB:WBTransgene99999999" } } : detail) : { total: 1, results: [transgene] } }));
  const first = (await client.annotate(fragment("dvIs2"))).transgene;
  assert.equal(first.status, "matched");
  assert.match(first.summary, /unavailable/);
  assert.doesNotMatch(first.summary, /Registered construct/);
  assert.match((await client.annotate(fragment("dvIs2"))).transgene.summary, /Registered construct/);
});
