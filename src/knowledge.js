(function (root) {
  "use strict";
  const constructs = typeof module !== "undefined" && module.exports ? require("./construct-catalogue.js") : root.ConstructCatalogue;
  const markers = typeof module !== "undefined" && module.exports ? require("./marker-catalogue.js") : root.MarkerCatalogue;
  const catalogue = typeof module !== "undefined" && module.exports ? require("./strain-catalogue.js") : root.StrainCatalogue;
  const API = "https://www.alliancegenome.org/api/search";
  const kinds = new Set(["gene", "protein", "gene_allele", "gene_reference", "gene_annotation", "promoter", "transgene", "strain", "fluorescent_protein", "marker"]);
  // Keep the source's expression sentence and qualifiers; do not infer tissue
  // specificity from gene function, subcellular location or orthologue biology.
  function expressionSummary(description) {
    if (typeof description !== "string") return null;
    return description.split(/(?<=[.!?])\s+(?=[A-Z])/)
      .filter(sentence => /^(?:Is expressed in|Expressed in)\s/.test(sentence)).join(" ") || null;
  }
  const strings = value => Array.isArray(value) ? value.filter(v => typeof v === "string") : [];
  function candidates(parsed) {
    const fragments = parsed.fragments.filter(f => kinds.has(f.kind) || ["utr", "peptide"].includes(f.kind));
    const identifiers = parsed.identifiers.filter(id => Number.isInteger(id.start))
      .map(id => ({ ...id, kind: "transgene" }));
    return [...fragments, ...identifiers].sort((a, b) => a.start - b.start);
  }
  function links(type, id) {
    const localId = id.replace(/^WB:/, "");
    return [
      { label: "Alliance of Genome Resources", url: `https://www.alliancegenome.org/${type}/${encodeURIComponent(id)}` },
      { label: "WormBase", url: `https://wormbase.org/species/c_elegans/${type === "gene" ? "gene" : "variation"}/${encodeURIComponent(localId)}` },
    ];
  }
  function createClient(fetcher = (...args) => root.fetch(...args)) {
    const cache = new Map();
    async function request(url) {
      const key = url;
      if (cache.has(key)) return cache.get(key);
      const task = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetcher(url, { signal: controller.signal, credentials: "omit" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          return { data, url, retrievedAt: new Date().toISOString(), totalResults: response.headers?.get("X-Total-Results"),
            release: response.headers?.get("X-UniProt-Release"), hasNextPage: /rel="next"/.test(response.headers?.get("Link") || "") };
        } finally { clearTimeout(timer); }
      })();
      cache.set(key, task);
      try { return await task; } catch (error) { cache.delete(key); throw error; }
    }
    async function search(type, query) {
      const url = `${API}?category=${type}_search_result&q=${encodeURIComponent(query)}&limit=100`;
      const response = await request(url);
      const data = response.data;
      if (!Number.isFinite(data?.total) || (data.total > 0 && !Array.isArray(data.results))) {
        cache.delete(url);
        throw new Error("Unexpected database response");
      }
      return { ...response, rows: data.results || [] };
    }
    async function resolveStock(type, query) {
      if (type === "strain") {
        const local = catalogue.lookup(query);
        if (local) return local;
      }
      const category = type === "transgene" ? "allele" : "model";
      const response = await search(category, query);
      const idPattern = type === "transgene" ? /^WB:WBTransgene\d{8}$/ : /^WB:WBStrain\d{8}$/;
      const matches = response.rows.filter(row => row.category === `${category}_search_result` && row.species === "Caenorhabditis elegans" && idPattern.test(row.id) &&
        [row.symbol, row.name, row.id, row.id.replace(/^WB:/, "")].includes(query));
      const unique = [...new Map(matches.map(row => [row.id, row])).values()];
      const base = { type, query, retrievedAt: response.retrievedAt };
      if (!unique.length) return { ...base, status: "not_found", summary: `No exact C. elegans ${type} match was found in the returned Alliance results. Coverage is incomplete; this does not establish that the record does not exist.`,
        links: type === "strain" && /^[A-Z]+\d+$/.test(query) ? [{ label: "Check CGC (not verified)", url: `https://cgc.umn.edu/strain/${encodeURIComponent(query)}` }] : [] };
      if (unique.length !== 1) return { ...base, status: "ambiguous", summary: "Multiple exact records were returned; no annotation selected." };
      const row = unique[0];
      const record = { ...base, status: "matched", id: row.id, symbol: row.symbol || row.name,
        evidence: "Database identity matched by exact name or stable ID", links: [
          { label: "Alliance of Genome Resources", url: type === "strain" ? response.url : `https://www.alliancegenome.org/allele/${encodeURIComponent(row.id)}` },
          { label: "WormBase", url: `https://wormbase.org/species/c_elegans/${type}/${encodeURIComponent(row.id.slice(3))}` },
        ] };
      if (type === "strain") {
        const diseases = strings(row.diseases);
        if (/^[A-Z]+\d+$/.test(record.symbol)) record.links.push({ label: "CGC strain catalogue (external)", url: `https://cgc.umn.edu/strain/${encodeURIComponent(record.symbol)}` });
        return { ...record, summary: `C. elegans strain. ${diseases.length ? `Database-listed disease-model associations: ${diseases.join("; ")}.` : "No disease-model association is supplied in this record."}`,
          note: "This search record does not provide the full genotype or strain phenotype. Check the source catalogue; a strain is not interchangeable with a transgene." };
      }
      const detailUrl = `https://www.alliancegenome.org/api/allele/${encodeURIComponent(row.id)}`;
      try {
        const detail = await request(detailUrl);
        const entity = detail.data?.allele;
        if (entity?.primaryExternalId !== row.id || entity?.taxon?.curie !== "NCBITaxon:6239") {
          cache.delete(detailUrl);
          throw new Error("Detail identity mismatch");
        }
        const notes = Array.isArray(entity.relatedNotes) ? entity.relatedNotes : [];
        const selected = notes.filter(n => ["transgene_content_summary", "transgene_construction_summary"].includes(n.noteType?.name) && typeof n.freeText === "string");
        return { ...record, retrievedAt: detail.retrievedAt,
          summary: selected.length ? selected.map(n => `${n.noteType.name === "transgene_content_summary" ? "Contents" : "Construction notes"}: ${n.freeText}`).join(" ") : "Transgene identity matched. No construction summary is available in the database record.",
          note: "Database contents describe the registered transgene. Any bracketed construct text supplied in your input has not been checked against this record." };
      } catch {
        return { ...record, summary: "Transgene identity matched, but its detailed construction annotation is unavailable. Parse again to retry." };
      }
    }
    async function resolve(type, query, geneId) {
      const response = await search(type, query);
      const rows = response.rows.filter(r => r.category === `${type}_search_result` && r.species === "Caenorhabditis elegans" &&
        (type === "gene" ? /^WB:WBGene\d{8}$/ : /^WB:WBVar\d+$/).test(r.id));
      const canonical = rows.filter(r => [r.symbol, r.systematicName, r.id, r.id.replace(/^WB:/, "")].includes(query));
      const matches = canonical.length ? canonical : rows.filter(r => strings(r.synonyms).includes(query));
      const unique = [...new Map(matches.map(r => [r.id, r])).values()];
      const base = { type, query, retrievedAt: response.retrievedAt, queryUrl: response.url };
      if (!unique.length) return { ...base, status: "not_found", summary: "No exact C. elegans match was found in the returned results. This does not establish that the entity does not exist." };
      // An allele is accepted only when its stable gene cross-reference agrees.
      const associated = type === "allele" && geneId ? unique.filter(r => strings(r.geneCrossReferences).includes(geneId)) : unique;
      if (type === "allele" && (!geneId || !associated.length)) return { ...base, status: "unverified", summary: "An allele name was found, but its association with the supplied gene could not be verified. No allele effect is assigned." };
      if (associated.length !== 1) return { ...base, status: "ambiguous", summary: "Multiple exact matches were returned. No annotation has been selected." };
      const row = associated[0];
      const record = { ...base, status: "matched", id: row.id, symbol: row.symbol, links: links(type, row.id) };
      if (type === "gene") {
        return { ...record, summary: row.geneDescription || row.automatedGeneDescription || "No English gene description is available in this record.",
          expression: expressionSummary(row.automatedGeneDescription),
          evidence: row.geneDescription ? "Database-provided gene description" : row.automatedGeneDescription ? "Automated gene description (database prediction qualifiers retained)" : "Identity only",
          functionAnnotation: row.geneDescription ? row.automatedGeneDescription || null : null };
      }
      const variant = strings(row.variantType).join(", ");
      const consequence = strings(row.molecularConsequence).join(", ");
      return { ...record, evidence: "Database-reported allele–gene association and variant annotations",
        summary: `Allele ${row.symbol} is associated with the resolved gene. ${variant ? `Variant type: ${variant}. ` : ""}${consequence ? `Molecular consequence: ${consequence}. ` : ""}Loss or gain of function and phenotype are not inferred from the name or consequence alone.` };
    }
    async function resolveProtein(fragment) {
      const geneName = fragment.gene;
      const base = { type: "protein", query: geneName, symbol: fragment.protein || geneName.toUpperCase(), source: "UniProtKB" };
      const context = fragment.proteinContext || "Protein-name notation recognised; no expression construct or experimental expression is established by the name alone.";
      const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(`(gene_exact:${geneName}) AND (organism_id:6239)`)}&format=json&size=100`;
      try {
        const response = await request(url);
        if (!Array.isArray(response.data?.results)) {
          cache.delete(url);
          throw new Error("Unsupported protein response");
        }
        const records = response.data.results.filter(r => r.organism?.taxonId === 6239 && typeof r.primaryAccession === "string" &&
          (r.genes || []).some(g => [g.geneName, ...(g.synonyms || [])].some(n => n?.value?.toLowerCase() === geneName)));
        const unique = [...new Map(records.map(r => [r.primaryAccession, r])).values()];
        const sourceLinks = unique.map(r => ({ label: `UniProtKB: ${r.primaryAccession}`, url: `https://www.uniprot.org/uniprotkb/${encodeURIComponent(r.primaryAccession)}/entry` }));
        const provenance = { ...base, retrievedAt: response.retrievedAt, release: response.release, note: context };
        if (response.hasNextPage || Number(response.totalResults) > 100) return { ...provenance, status: "ambiguous", summary: "The protein search returned more entries than can be checked in one request. No reference protein was selected." };
        if (!unique.length) return { ...provenance, status: "not_found", summary: "No exact C. elegans protein–gene match was returned by UniProtKB." };
        const reviewed = unique.filter(r => r.entryType === "UniProtKB reviewed (Swiss-Prot)");
        const preferred = reviewed.length ? reviewed : unique;
        if (preferred.length !== 1) return { ...provenance, status: "ambiguous", links: sourceLinks,
          summary: "Multiple equally preferred protein records were returned. Specify the protein or isoform before assigning a functional annotation." };
        const record = preferred[0];
        const name = record.proteinDescription?.recommendedName?.fullName?.value || record.proteinDescription?.submissionNames?.[0]?.fullName?.value || "Protein name unavailable";
        const comments = Array.isArray(record.comments) ? record.comments : [];
        const functions = comments.filter(c => c.commentType === "FUNCTION").flatMap(c => c.texts || []);
        const locations = comments.filter(c => c.commentType === "SUBCELLULAR LOCATION").flatMap(c => c.subcellularLocations || []).map(l => l.location).filter(Boolean);
        const evidenceCodes = [...new Set([...functions, ...locations].flatMap(t => (t.evidences || []).map(e => e.evidenceCode)).filter(Boolean))];
        const summary = functions.filter(t => typeof t.value === "string").map(t => t.value).join(" ");
        return { ...provenance, status: "matched", id: record.primaryAccession, standardName: name,
          summary: `${name}. ${summary || "No functional description is supplied in this protein record."}`,
          proteinLength: record.sequence?.length || null,
          location: locations.map(l => `${l.value}${(l.evidences || []).some(e => e.evidenceCode === "ECO:0000250") ? " (by similarity)" : ""}`).join("; ") || null,
          evidence: `${record.entryType || "UniProtKB record"}; exact species and gene-name match${evidenceCodes.length ? `; evidence codes: ${evidenceCodes.join(", ")}` : ""}${response.release ? `; release ${response.release}` : ""}`,
          note: `${context} ${reviewed.length ? "A reviewed entry is shown as the reference protein." : "Only an unreviewed entry was available."} ${unique.length > 1 ? `${unique.length} matching protein entries exist. ` : ""}The construct does not specify an isoform or sequence. Length, function and localisation describe the database reference, not a verified fusion product.`,
          links: [{ label: `UniProtKB reference: ${record.primaryAccession}`, url: `https://www.uniprot.org/uniprotkb/${encodeURIComponent(record.primaryAccession)}/entry` },
            ...sourceLinks.filter(l => !l.url.includes(`/${record.primaryAccession}/`))] };
      } catch {
        return { ...base, status: "unavailable", summary: "The UniProtKB protein lookup is unavailable. Parse again to retry.", note: context };
      }
    }
    async function annotate(fragment) {
      if (["utr", "peptide"].includes(fragment.kind)) return { [fragment.kind]: constructs.annotate(fragment) };
      if (!kinds.has(fragment.kind)) return null;
      if (fragment.kind === "protein") return { protein: await resolveProtein(fragment) };
      if (fragment.kind === "fluorescent_protein") return { fluorescent: markers.fluorescent(fragment.text.trim()) };
      if (fragment.kind === "marker") return { marker: markers.marker(fragment) };
      if (["transgene", "strain"].includes(fragment.kind)) {
        try { return { [fragment.kind]: await resolveStock(fragment.kind, fragment.text.trim()) }; }
        catch { return { [fragment.kind]: { type: fragment.kind, query: fragment.text.trim(), status: "unavailable", summary: "The knowledge database is unavailable. Parse again to retry." } }; }
      }
      async function safe(type, query, geneId) {
        try { return await resolve(type, query, geneId); }
        catch { return { type, query, status: "unavailable", summary: "The knowledge database could not be reached or returned an unsupported response. Check your connection and parse again to retry." }; }
      }
      const [gene, protein] = await Promise.all([
        safe("gene", fragment.kind === "promoter" ? fragment.text.trim().slice(0, -1) : fragment.gene),
        fragment.proteinCandidate ? resolveProtein(fragment) : Promise.resolve(null),
      ]);
      if (fragment.kind === "promoter") {
        return { promoter: { ...gene, type: "promoter", functionAnnotation: null,
          summary: gene.status === "matched" ? `Reported expression of the corresponding gene: ${gene.expression || "Expression information is not available in the database summary."}` : gene.summary,
          evidence: gene.status === "matched" ? "Corresponding gene matched; expression from the automated gene description" : null,
          note: "Gene expression is a reference for this promoter; the expression pattern of the specific promoter fragment has not been verified." } };
      }
      const allele = fragment.kind === "gene_allele" ? await safe("allele", fragment.allele, gene.status === "matched" ? gene.id : null) : null;
      return { gene, protein, allele, marker: markers.marker(fragment) };
    }
    return { annotate };
  }
  const exported = { candidates, createClient };
  if (typeof module !== "undefined" && module.exports) module.exports = exported;
  else root.GenotypeKnowledge = exported;
})(globalThis);
