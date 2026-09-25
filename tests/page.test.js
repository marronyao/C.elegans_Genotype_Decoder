"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// A DOM stub checks browser-script wiring without adding a dependency.
// This is not a browser rendering or layout test.
test("page loads modules in order and displays changes, unknowns and warnings", () => {
  function element() {
    return {
      value: "", textContent: "", children: [], handlers: {},
      classList: { toggle() {} },
      append(...items) { this.children.push(...items); },
      replaceChildren() { this.children = []; },
      addEventListener(name, handler) { this.handlers[name] = handler; },
      focus() {},
    };
  }
  const elements = Object.fromEntries(["#genotype-form", "#genotype", "#results", "#status", "#example-button"].map(id => [id, element()]));
  const context = vm.createContext({ document: { querySelector: id => elements[id], createElement: element } });
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const match of html.matchAll(/<script src="([^"]+)" defer><\/script>/g)) {
    vm.runInContext(fs.readFileSync(path.join(root, match[1]), "utf8"), context);
  }
  const submit = () => elements["#genotype-form"].handlers.submit({ preventDefault() {} });
  const allText = node => [node.textContent, ...node.children.map(allText)].join("\n");
  elements["#example-button"].handlers.click();
  submit();
  assert.match(elements["#status"].textContent, /Structure parsed: 2/);
  elements["#genotype"].value = "abEx1 ［mystery：：GFP";
  submit();
  const rendered = allText(elements["#results"]);
  assert.match(rendered, /Normalisation record/);
  assert.match(rendered, /3 changes/);
  assert.match(rendered, /Unclosed/);
  assert.match(rendered, /Unknown or unclassified fragments/);
  assert.match(rendered, /mystery/);
  assert.match(elements["#status"].textContent, /Partial result/);
  elements["#genotype"].handlers.input();
  assert.equal(elements["#results"].children.length, 0);
  const findButton = (node, label) => {
    if (node.textContent === label && node.handlers.click) return node;
    for (const child of node.children) {
      const found = findButton(child, label);
      if (found) return found;
    }
  };
  elements["#genotype"].value = "abEx1 [Pmtl2::GFP + unc54]";
  submit();
  assert.match(elements["#status"].textContent, /Confirmation needed/);
  assert.doesNotMatch(allText(elements["#results"]), /Construct 1/);
  findButton(elements["#results"], "Use mtl-2p").handlers.click();
  assert.match(elements["#status"].textContent, /Confirmation needed/);
  findButton(elements["#results"], "Keep unc54").handlers.click();
  assert.match(elements["#status"].textContent, /Structure parsed/);
  assert.match(allText(elements["#results"]), /promoter notation/);
  assert.match(allText(elements["#results"]), /Spellings kept by you/);
  assert.equal(elements["#genotype"].value, "abEx1 [Pmtl2::GFP + unc54]");
  elements["#genotype"].handlers.input();
  submit();
  assert.match(elements["#status"].textContent, /Confirmation needed/);
  elements["#genotype"].value = "unc-30(e191); unc-30(变异编号); rol-6(+)";
  elements["#genotype"].handlers.input();
  submit();
  const alleleText = allText(elements["#results"]);
  assert.match(alleleText, /gene: unc-30; allele identifier: e191/);
  assert.match(alleleText, /annotation: 变异编号/);
  assert.match(alleleText, /not a mutant allele identifier/);
});

test("asynchronous annotations render safely and stale responses cannot overwrite new input", async () => {
  function element() {
    return { value: "", textContent: "", children: [], handlers: {}, classList: { toggle() {} },
      append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; },
      addEventListener(name, handler) { this.handlers[name] = handler; }, focus() {} };
  }
  const elements = Object.fromEntries(["#genotype-form", "#genotype", "#results", "#status", "#example-button"].map(id => [id, element()]));
  const requests = [];
  const context = vm.createContext({ AbortController, setTimeout, clearTimeout,
    fetch: () => new Promise(resolve => requests.push(resolve)),
    document: { querySelector: id => elements[id], createElement: element } });
  const root = path.join(__dirname, "..");
  for (const file of ["src/normalise.js", "src/marker-catalogue.js", "src/construct-catalogue.js", "src/parser.js", "src/strain-catalogue.js", "src/knowledge.js", "app.js"]) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
  const text = node => [node.textContent, ...node.children.map(text)].join("\n");
  const submit = () => elements["#genotype-form"].handlers.submit({ preventDefault() {} });
  elements["#genotype"].value = "unc-30";
  submit();
  assert.equal(requests.length, 1);
  elements["#genotype"].value = "FLAG";
  elements["#genotype"].handlers.input();
  submit();
  requests[0]({ ok: true, json: async () => ({ total: 1, results: [{ id: "WB:WBGene00006766", symbol: "unc-30", category: "gene_search_result", species: "Caenorhabditis elegans", geneDescription: "<img src=x onerror=alert(1)>" }] }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.doesNotMatch(text(elements["#results"]), /Knowledge annotations|onerror/);
  elements["#genotype"].value = "unc-30";
  elements["#genotype"].handlers.input();
  submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(text(elements["#results"]), /matched.*WBGene00006766/);
  // Remote descriptions are assigned as text, never parsed as markup.
  assert.match(text(elements["#results"]), /<img src=x onerror=alert\(1\)>/);
  assert.equal(requests.length, 1);
  elements["#genotype"].value = "N2";
  elements["#genotype"].handlers.input();
  submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(text(elements["#results"]), /Bristol wild-type reference strain/);
  assert.match(text(elements["#results"]), /Source: CGC strain catalogue; WormBook nomenclature\. Reviewed/);
  assert.equal(requests.length, 1);
  elements["#genotype"].value = "eGFP::pHTomato + pRF4; unc-54 3'UTR; FLAG";
  elements["#genotype"].handlers.input();
  submit();
  await new Promise(resolve => setImmediate(resolve));
  const rendered = text(elements["#results"]);
  assert.match(rendered, /Enhanced green fluorescent protein/);
  assert.match(rendered, /excitation 488 nm; emission 507 nm/);
  assert.match(rendered, /Sensor properties: pH-sensitive intensity reporter/);
  assert.match(rendered, /Marker: pRF4/);
  assert.match(rendered, /Source: FPbase/);
  assert.match(rendered, /Regulatory element: unc-54 3′ UTR/);
  elements["#genotype"].value = "Abeta1-42::unc-54 3’ UTR";
  elements["#genotype"].handlers.input();
  submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(text(elements["#results"]), /Peptide: Aβ1-42/);
  assert.match(text(elements["#results"]), /42 residues/);
  assert.doesNotMatch(text(elements["#results"]), /Unknown or unclassified|undefined/);
  assert.equal(requests.length, 1);
  elements["#genotype"].value = "HSP-4::eGFP";
  elements["#genotype"].handlers.input();
  submit();
  assert.equal(requests.length, 2);
  requests[1]({ ok: true, json: async () => ({ results: [{ primaryAccession: "P20163", entryType: "UniProtKB reviewed (Swiss-Prot)", organism: { taxonId: 6239 }, genes: [{ geneName: { value: "hsp-4" } }], sequence: { length: 657 }, proteinDescription: { recommendedName: { fullName: { value: "Endoplasmic reticulum chaperone BiP homolog" } } } }] }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(text(elements["#results"]), /Reference protein: HSP-4 — matched \(P20163\)/);
  assert.match(text(elements["#results"]), /657 amino acids/);
  assert.match(text(elements["#results"]), /Source: UniProtKB/);
});
