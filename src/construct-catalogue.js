(function (root) {
  "use strict";
  // Matching keys only: original text and source offsets are never rewritten.
  function key(text) {
    return text.replace(/[’‘′]/g, "'").replace(/[–−₋]/g, "-")
      .replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080));
  }
  function classify(text) {
    const value = key(text);
    const utr = /^(?:([a-z]{3}-\d+(?:\.\d+)?|[A-Z][A-Za-z0-9]*\d\.\d+)\s*[-_]?\s*)?(?:([35])\s*'?\s*UTR|\(\s*([35])\s*'?\s*UTR\s*\))$/i.exec(value);
    if (utr) return { kind: "utr", gene: utr[1] || null, utrEnd: utr[2] || utr[3], verified: false };
    const peptide = /^(?:Aβ|Abeta|A-beta)\s*(?:([13])\s*-\s*(40|42)|\(\s*([13])\s*-\s*(40|42)\s*\))$/i.exec(value);
    if (peptide) {
      const start = peptide[1] || peptide[3];
      const end = peptide[2] || peptide[4];
      if (start === "3" && end !== "42") return null;
      return { kind: "peptide", peptide: `Aβ${start}-${end}`, peptideLength: Number(end) - Number(start) + 1, verified: false };
    }
    return null;
  }
  function annotate(fragment) {
    const base = { query: fragment.text.trim(), status: "matched", reviewedAt: "2026-09-24",
      evidence: "Curated notation-level annotation; construct sequence and activity are not verified" };
    if (fragment.kind === "peptide") return { ...base, type: "peptide", symbol: fragment.peptide,
      source: "UniProtKB human APP; McColl et al. (2009, 2012)",
      summary: `Amyloid-beta peptide ${fragment.peptide.slice(2)}: ${fragment.peptideLength} residues in the named peptide. Human APP-derived peptide notation used in heterologous C. elegans disease models; not an endogenous worm gene or full-length APP.`,
      note: "Aggregation and toxicity depend on sequence, processing and experimental conditions. The name does not establish the mature product: McColl et al. found Aβ3-42 in CL2006 and CL2120 despite Aβ1-42 construct nomenclature; an improved model (GMC101) expressed Aβ1-42. No strain or phenotype is inferred from this fragment.",
      links: [{ label: "UniProtKB: human APP precursor (P05067)", url: "https://www.uniprot.org/uniprotkb/P05067/entry" },
        { label: "McColl et al. 2009: peptide processing", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2755678/" },
        { label: "McColl et al. 2012: improved Aβ1-42 model", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3519830/" }] };
    if (fragment.kind !== "utr") return null;
    const common = ["unc-54", "let-858", "tbb-2", "glh-2"].includes(fragment.gene);
    return { ...base, type: "utr", symbol: `${fragment.gene ? `${fragment.gene} ` : ""}${fragment.utrEnd}′ UTR`,
      source: "WormBook: translation; Genetics (2025): bipartite reporter expression",
      summary: `${fragment.utrEnd}′ untranslated region${fragment.gene ? ` labelled as derived from ${fragment.gene}` : "; source gene unspecified"}. ${fragment.utrEnd === "3" ? "A non-coding region downstream of the coding sequence that can influence mRNA stability, localisation and translation." : "A non-coding region upstream of the coding sequence that can influence translation initiation."}${common && fragment.utrEnd === "3" ? " This source gene is among the commonly used C. elegans transgene 3′ UTRs." : ""}`,
      note: "The source-gene label is recognised as notation only. Sequence boundaries, polyadenylation/termination efficiency and tissue-specific effects are not determined from this label; a UTR does not encode the source gene's protein.",
      links: [{ label: "WormBook: mechanism and regulation of translation", url: "https://www.ncbi.nlm.nih.gov/books/NBK19664/" },
        { label: "Genetics (2025): reporter expression and 3′ UTR choice", url: "https://academic.oup.com/genetics/article/230/2/iyaf076/8127868" }] };
  }
  const api = { classify, annotate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ConstructCatalogue = api;
})(globalThis);
