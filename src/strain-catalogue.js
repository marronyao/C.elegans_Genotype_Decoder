(function (root) {
  "use strict";
  // Small, source-backed supplement to Alliance's disease-model index.
  // Names are exact and case-sensitive; never equate WT, Bristol or a sub-strain with N2.
  const records = {
    N2: {
      summary: "C. elegans Bristol wild-type reference strain, commonly used as the laboratory wild-type control. Originally isolated near Bristol, England.",
      note: "Wild type is a reference designation, not a guarantee that every laboratory stock is genetically identical. CGC notes a possible alh-2 background variant in its N2 stock; consult the catalogue for stock-specific details.",
      source: "CGC strain catalogue; WormBook nomenclature",
      links: [
        { label: "CGC: N2", url: "https://cgc.umn.edu/strain/N2" },
        { label: "WormBook: Caenorhabditis nomenclature", url: "https://www.ncbi.nlm.nih.gov/books/NBK535515/" },
      ],
    },
    CB4856: {
      summary: "C. elegans Hawaiian wild isolate. Genetically distinct from the Bristol N2 reference strain and used in studies of natural genetic variation and genetic mapping.",
      source: "Thompson et al. (2015); Wicks et al. (2001)",
      links: [
        { label: "CB4856 genome study", url: "https://academic.oup.com/genetics/article/200/3/975/5936244" },
        { label: "High-throughput gene mapping study", url: "https://genome.cshlp.org/highwire_display/entity_view/node/1007618/full" },
        { label: "CGC catalogue", url: "https://cgc.umn.edu/strain/CB4856" },
      ],
    },
    CB1370: {
      summary: "C. elegans strain carrying daf-2(e1370) on chromosome III. CGC describes a temperature-sensitive dauer-constitutive, long-lived phenotype.",
      source: "CGC strain catalogue",
      links: [{ label: "CGC: CB1370", url: "https://cgc.umn.edu/strain/CB1370" }],
    },
    CF1038: {
      summary: "C. elegans strain carrying daf-16(mu86) on chromosome I. A daf-16 mutant strain used in studies of DAF-16/FOXO, stress responses and ageing.",
      source: "DAF-16 stabilizes the aging transcriptome (2019)",
      links: [
        { label: "DAF-16 ageing study", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6516157/" },
        { label: "CGC catalogue", url: "https://cgc.umn.edu/strain/CF1038" },
      ],
    },
  };
  function lookup(query) {
    if (!Object.hasOwn(records, query)) return null;
    const record = records[query];
    return { ...record, links: record.links.map(link => ({ ...link })), type: "strain", query, symbol: query,
      status: "matched", evidence: "Locally curated strain summary; exact name match", reviewedAt: "2026-09-23" };
  }
  const api = { lookup };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StrainCatalogue = api;
})(globalThis);

