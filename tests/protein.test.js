"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseGenotype } = require("../src/parser.js");
const { createClient } = require("../src/knowledge.js");
// Reduced UniProt response shape verified for P20163 on 2026-09-23.
const reviewed = { primaryAccession: "P20163", entryType: "UniProtKB reviewed (Swiss-Prot)", organism: { taxonId: 6239 },
  genes: [{ geneName: { value: "hsp-4" }, synonyms: [{ value: "hsp70d" }] }],
  proteinDescription: { recommendedName: { fullName: { value: "Endoplasmic reticulum chaperone BiP homolog" } } },
  sequence: { length: 657 }, comments: [
    { commentType: "FUNCTION", texts: [{ value: "ER chaperone (By similarity).", evidences: [{ evidenceCode: "ECO:0000250" }] }] },
    { commentType: "SUBCELLULAR LOCATION", subcellularLocations: [{ location: { value: "Endoplasmic reticulum lumen", evidences: [{ evidenceCode: "ECO:0000250" }] } }] },
  ] };
const unreviewed = { ...reviewed, primaryAccession: "V6CL98", entryType: "UniProtKB unreviewed (TrEMBL)", comments: [], sequence: { length: 324 } };
function clientFor(rows, headers) {
  const calls = [];
  return { calls, client: createClient(async url => {
    calls.push(url);
    return { ok: true, headers: { get: key => headers?.[key] || null }, json: async () => url.startsWith("https://rest.uniprot.org/") ? { results: rows } : { total: 0 } };
  }) };
}
test("requested spelling variants map to the same protein without changing original input or offsets", () => {
  for (const input of ["hsp-4p::hsp-4::eGFP", "hsp-4p::HSP-4::EGFP", "HSP-4::eGFP", "Hsp-4::EGFP", "EGFP::hsp-4"]) {
    const parsed = parseGenotype(input);
    const protein = parsed.fragments.find(f => f.proteinCandidate);
    assert.equal(protein.gene, "hsp-4");
    assert.equal(protein.protein, "HSP-4");
    assert.equal(protein.verified, false);
    assert.equal(parsed.original, input);
    assert.equal(parsed.complete, true);
    for (const f of parsed.fragments) assert.equal(parsed.normalised.slice(f.start, f.end), f.text);
  }
});
test("promoter-only reporters, underscores and allele notation do not create an endogenous protein candidate", () => {
  for (const input of ["hsp-4p::GFP", "hsp-4", "hsp-4_GFP", "hsp-4(e1)::GFP", "hsp-4(+)", "hsp-4; GFP", "hsp-4 + GFP", "hsp-4p::GFP + hsp-4"]) {
    assert.equal(parseGenotype(input).fragments.some(f => f.proteinCandidate || f.kind === "protein"), false, input);
  }
  assert.equal(parseGenotype("HSP-4").fragments[0].kind, "protein");
  assert.equal(parseGenotype("HSP-4_GFP").fragments[0].proteinCandidate, undefined);
});
test("all user examples share an exact-species UniProt query; reviewed reference is not claimed as the isoform", async () => {
  const { client, calls } = clientFor([unreviewed, reviewed], { "X-UniProt-Release": "2026_03" });
  for (const input of ["hsp-4p::hsp-4::eGFP", "hsp-4p::HSP-4::EGFP", "HSP-4::eGFP"]) {
    const f = parseGenotype(input).fragments.find(f => f.proteinCandidate);
    const r = (await client.annotate(f)).protein;
    assert.equal(r.id, "P20163");
    assert.equal(r.proteinLength, 657);
    assert.match(r.summary, /By similarity/);
    assert.match(r.location, /by similarity/);
    assert.match(r.note, /2 matching protein entries/);
    assert.match(r.note, /does not specify an isoform/);
    assert.match(r.evidence, /2026_03/);
    assert.equal(r.links.length, 2);
  }
  assert.equal(calls.filter(url => url.startsWith("https://rest.uniprot.org/")).length, 1);
});
test("wrong species and fuzzy gene matches are discarded; multiple reviewed entries remain ambiguous", async () => {
  const f = parseGenotype("HSP-4").fragments[0];
  const wrongSpecies = { ...reviewed, organism: { taxonId: 9606 } };
  const wrongGene = { ...reviewed, genes: [{ geneName: { value: "hsp-40" } }] };
  assert.equal((await clientFor([wrongSpecies, wrongGene]).client.annotate(f)).protein.status, "not_found");
  const duplicate = { ...reviewed, primaryAccession: "P99999" };
  const r = (await clientFor([reviewed, duplicate]).client.annotate(f)).protein;
  assert.equal(r.status, "ambiguous");
  assert.equal(r.proteinLength, undefined);
  assert.equal(r.links.length, 2);
  assert.equal((await clientFor([reviewed], { "X-Total-Results": "101" }).client.annotate(f)).protein.status, "ambiguous");
});
test("unreviewed-only identity is labelled, missing function and location are not invented", async () => {
  const r = (await clientFor([unreviewed]).client.annotate(parseGenotype("HSP-4").fragments[0])).protein;
  assert.match(r.note, /Only an unreviewed entry/);
  assert.match(r.summary, /No functional description/);
  assert.equal(r.location, null);
});
test("failed or malformed protein responses remain retryable", async () => {
  let count = 0;
  const client = createClient(async () => {
    if (++count === 1) throw new Error("offline");
    return { ok: true, json: async () => count === 2 ? { error: "bad response" } : { results: [reviewed] } };
  });
  const f = parseGenotype("HSP-4").fragments[0];
  assert.equal((await client.annotate(f)).protein.status, "unavailable");
  assert.equal((await client.annotate(f)).protein.status, "unavailable");
  assert.equal((await client.annotate(f)).protein.status, "matched");
});
