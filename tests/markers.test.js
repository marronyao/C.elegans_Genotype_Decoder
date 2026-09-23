"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseGenotype } = require("../src/parser.js");
const { createClient } = require("../src/knowledge.js");
const { marker } = require("../src/marker-catalogue.js");
const fragment = value => parseGenotype(value).fragments[0];
test("explicit fluorescent names and aliases resolve offline with sourced spectral peaks", async () => {
  const client = createClient(() => { throw new Error("Should not call a remote service"); });
  for (const [name, canonical, ex, em] of [
    ["eGFP", "EGFP", 488, 507], ["EGFP", "EGFP", 488, 507], ["EYFP", "EYFP", 513, 527],
    ["mCherry", "mCherry", 587, 610], ["sfGFP", "sfGFP", 485, 510],
    ["tdTomato", "tdTomato", 554, 581], ["mNeonGreen", "mNeonGreen", 506, 517], ["ECFP", "ECFP", 434, 477],
  ]) {
    assert.equal(fragment(name).kind, "fluorescent_protein");
    const r = (await client.annotate(fragment(name))).fluorescent;
    assert.equal(r.symbol, canonical);
    assert.equal(r.excitationNm, ex);
    assert.equal(r.emissionNm, em);
    assert.equal(r.referenceVariant, null);
    assert.equal(r.source, "FPbase");
    assert.ok(r.links[0].url.startsWith("https://www.fpbase.org/"));
  }
});
test("generic GFP, YFP and CFP keep variant uncertainty instead of being assigned to an enhanced variant", async () => {
  const client = createClient();
  for (const name of ["GFP", "YFP", "CFP"]) {
    const r = (await client.annotate(fragment(name))).fluorescent;
    assert.equal(r.symbol, name);
    assert.match(r.standardName, /variant unspecified/);
    assert.match(r.spectralLabel, /Representative/);
    assert.equal(r.referenceVariant, `E${name}`);
  }
});
test("pHTomato is a pH intensity sensor with original-paper peaks, not tdTomato", async () => {
  const r = (await createClient().annotate(fragment("pHTomato"))).fluorescent;
  assert.equal(r.excitationNm, 550);
  assert.equal(r.emissionNm, 580);
  assert.match(r.sensor, /7\.8/);
  assert.match(r.sensor, /increases as pH rises/);
  assert.match(r.sensor, /calibration/);
  assert.match(r.source, /original study/);
});
test("marker context depends on the allele or rescue construct; existing gene kinds survive", async () => {
  assert.equal(fragment("rol-6(su1006)").kind, "gene_allele");
  assert.match(marker(fragment("rol-6(su1006)")).summary, /Dominant Roller/);
  assert.match(marker(fragment("rol-6")).summary, /does not specify/);
  assert.match(marker(fragment("rol-6(+)")).summary, /Rolling is not assigned/);
  assert.equal(marker(fragment("rol-6(e187)")), null);
  assert.equal(marker(fragment("rol-6p")), null);
  assert.equal(marker(fragment("unc-119(ed3)")), null);
  assert.match(marker(fragment("unc-119(+)")).summary, /rescue selection/);
  assert.match(marker(fragment("pha-1(+)")).summary, /temperature-sensitive host/);
  const client = createClient(async () => { throw new Error("offline"); });
  const r = await client.annotate(fragment("rol-6(su1006)"));
  assert.equal(r.gene.status, "unavailable");
  assert.match(r.marker.summary, /Dominant Roller/);
  assert.match((await client.annotate(fragment("pRF4"))).marker.summary, /su1006/);
  assert.match((await client.annotate(fragment("pPD10.46"))).marker.summary, /twitching/);
});
test("UTRs, tags, unknown sensors and partial protein names remain unannotated", async () => {
  const client = createClient();
  for (const text of ["unc-54 3'UTR", "FLAG", "HA", "NLS", "GFPmutUnknown", "mCherry2", "pHTomatoVariant", "unc-22"]) {
    assert.equal(marker(fragment(text)), null);
    if (fragment(text).kind === "unknown") assert.equal(await client.annotate(fragment(text)), null);
  }
  const parsed = parseGenotype("unc-30p::eGFP + rol-6(su1006); pHTomato::FLAG");
  assert.equal(parsed.complete, true);
  assert.equal(parsed.suggestions.length, 0);
  for (const f of parsed.fragments) assert.equal(parsed.normalised.slice(f.start, f.end), f.text);
});
