(function (root) {
  "use strict";
  // Reviewed source snapshots, not live FPbase API results. Explicit aliases only.
  const proteins = [
    { symbol: "EGFP", aliases: ["eGFP", "egfp"], name: "Enhanced green fluorescent protein", colour: "Green", excitation: 488, emission: 507, slug: "egfp" },
    { symbol: "GFP", aliases: ["gfp"], name: "Green fluorescent protein (variant unspecified)", colour: "Green", reference: "EGFP", excitation: 488, emission: 507, slug: "egfp" },
    { symbol: "EYFP", aliases: ["eYFP", "eyfp"], name: "Enhanced yellow fluorescent protein", colour: "Yellow-green", excitation: 513, emission: 527, slug: "eyfp" },
    { symbol: "YFP", aliases: ["yfp"], name: "Yellow fluorescent protein (variant unspecified)", colour: "Yellow-green", reference: "EYFP", excitation: 513, emission: 527, slug: "eyfp" },
    { symbol: "ECFP", aliases: ["eCFP", "ecfp"], name: "Enhanced cyan fluorescent protein", colour: "Cyan", excitation: 434, emission: 477, slug: "ecfp" },
    { symbol: "CFP", aliases: ["cfp"], name: "Cyan fluorescent protein (variant unspecified)", colour: "Cyan", reference: "ECFP", excitation: 434, emission: 477, slug: "ecfp" },
    { symbol: "mCherry", aliases: ["mcherry"], name: "mCherry (monomeric red fluorescent protein)", colour: "Red", excitation: 587, emission: 610, slug: "mcherry" },
    { symbol: "tdTomato", aliases: ["tdtomato"], name: "tdTomato (tandem-dimer Tomato fluorescent protein)", colour: "Orange-red", excitation: 554, emission: 581, slug: "tdtomato" },
    { symbol: "sfGFP", aliases: ["sfgfp", "Superfolder GFP"], name: "Superfolder green fluorescent protein", colour: "Green", excitation: 485, emission: 510, slug: "superfolder-gfp" },
    { symbol: "mNeonGreen", aliases: ["mneongreen"], name: "mNeonGreen fluorescent protein", colour: "Green", excitation: 506, emission: 517, slug: "mneongreen" },
    { symbol: "pHTomato", aliases: ["pHtomato", "phtomato"], name: "pHTomato (pH-sensitive red fluorescent protein)", colour: "Orange-red", excitation: 550, emission: 580,
      sensor: "pH-sensitive intensity reporter. Fluorescence increases as pH rises; the original study reports an apparent pKa of about 7.8. Targeted fusions can report vesicle exocytosis/endocytosis. Intensity alone is not an absolute pH measurement: calibration and controls for protein abundance and imaging conditions are needed.",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3959862/" },
  ];
  const index = new Map(proteins.flatMap(p => [p.symbol, ...p.aliases].map(name => [name, p])));
  const markerUrl = "https://www.ncbi.nlm.nih.gov/books/NBK19648/table/A10923/";
  const standalone = new Map([
    ["pRF4", "Co-injection plasmid carrying rol-6(su1006), used to identify transformants by dominant rolling movement."],
    ["pPD10.46", "An unc-22 antisense transformation marker that produces a dominant twitching phenotype."],
    ["unc-22 antisense", "Antisense unc-22 can serve as a visible transformation marker by producing twitching movement. This refers to the antisense construct, not wild-type unc-22."],
  ]);
  function classify(text) {
    if (index.has(text)) return "fluorescent_protein";
    if (standalone.has(text)) return "marker";
    return null;
  }
  function fluorescent(text) {
    const p = index.get(text);
    if (!p) return null;
    const reference = p.reference ? `Representative ${p.reference} values only; the input does not identify this variant. ` : "";
    return { type: "fluorescent_protein", symbol: p.symbol, query: text, status: "matched", standardName: p.name,
      colour: p.colour, excitationNm: p.excitation, emissionNm: p.emission, referenceVariant: p.reference || null,
      summary: p.name, sensor: p.sensor || null,
      spectralLabel: p.reference ? `Representative peaks (${p.reference}; variant unspecified)` : "Reported spectral peaks",
      note: `${reference}Excitation and emission maxima are in nm, not prescribed laser lines or detector/filter bandwidths. Actual acquisition settings depend on the variant and optical setup.`,
      source: p.url ? "Li and Tsien (2012), pHTomato original study" : "FPbase",
      evidence: p.reference ? "Curated family-level annotation with a named spectral reference" : "Curated fluorescent-protein record; explicit name or alias match",
      reviewedAt: "2026-09-23", links: [{ label: p.url ? "pHTomato original study" : `FPbase: ${p.reference || p.symbol}`, url: p.url || `https://www.fpbase.org/protein/${p.slug}/` }] };
  }
  function marker(fragment) {
    const text = fragment.text.trim();
    let summary = standalone.get(text);
    if (fragment.kind === "gene" && fragment.gene === "rol-6") summary = "Marker context: the rol-6(su1006) allele is used for dominant rolling selection. The bare gene name rol-6 does not specify that allele or establish a Roller phenotype.";
    if (fragment.kind === "gene_allele" && fragment.gene === "rol-6" && fragment.allele === "su1006") summary = "Dominant Roller co-injection marker: rol-6(su1006) produces corkscrew-like rolling movement used to recognise transformed worms. The phenotype can be suppressed in some genetic backgrounds.";
    if (fragment.kind === "gene_reference" && fragment.gene === "rol-6") summary = "rol-6(+) denotes the wild-type reference, not the dominant rol-6(su1006) Roller marker. Rolling is not assigned to this notation.";
    if (fragment.kind === "gene_reference" && fragment.gene === "unc-119") summary = "Wild-type unc-119 can be used as a rescue selection marker in an unc-119 loss-of-function host (for example ed3), restoring coordinated movement. Selection depends on the host background.";
    if (fragment.kind === "gene_reference" && fragment.gene === "pha-1") summary = "Wild-type pha-1 can serve as a rescue selection marker in a suitable pha-1 temperature-sensitive host. The marker rescues the host defect; it is not a constitutive visible phenotype.";
    if (!summary) return null;
    return { type: "marker", query: text, symbol: text, status: "matched", summary,
      source: "WormBook: transformation and microinjection", evidence: "Curated marker context; genotype and construct dependent",
      reviewedAt: "2026-09-23", links: [{ label: "WormBook: common transformation markers", url: markerUrl }] };
  }
  const api = { classify, fluorescent, marker };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MarkerCatalogue = api;
})(globalThis);
