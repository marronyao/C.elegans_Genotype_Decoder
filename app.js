"use strict";

const example = "dvIs100 [unc-54p::Aβ1-42::unc-54 3'UTR + mtl-2p::GFP]";
const form = document.querySelector("#genotype-form");
const input = document.querySelector("#genotype");
const results = document.querySelector("#results");
const status = document.querySelector("#status");
let reviewInput = null;
let acceptedCorrections = [];
let dismissedCorrections = [];
let annotationRun = 0;
const knowledge = GenotypeKnowledge.createClient();

function resetReview() {
  annotationRun += 1;
  reviewInput = null;
  acceptedCorrections = [];
  dismissedCorrections = [];
}

function addResult(title, text, parts = []) {
  const section = document.createElement("section");
  section.className = "result-item";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const value = document.createElement("code");
  // Never render user input as HTML.
  value.textContent = text;
  section.append(heading, value);
  if (parts.length) {
    const list = document.createElement("ol");
    for (const part of parts) {
      const item = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = part;
      item.append(code);
      list.append(item);
    }
    section.append(list);
  }
  results.append(section);
}

function setStatus(message, warning = false) {
  status.textContent = message;
  status.classList.toggle("warning", warning);
}

function describeFragment(element) {
  const text = element.text.trim() || "[Empty fragment]";
  if (element.kind === "fluorescent_protein") return `${text} — fluorescent protein; see annotation below`;
  if (element.kind === "marker") return `${text} — transformation marker; see annotation below`;
  if (element.kind === "protein" || element.proteinCandidate) return `${text} — protein/coding-sequence candidate: ${element.protein}; corresponding gene: ${element.gene}; see annotation below`;
  const chromosome = element.chromosome ? `; chromosome label: ${element.chromosome}` : "";
  if (element.kind === "gene") return `${text} — gene notation; see database lookup below`;
  if (element.kind === "transgene") return `${text} — transgene identifier; see database lookup below`;
  if (element.kind === "strain") return `${text} — possible strain name; see database lookup below`;
  if (element.kind === "gene_allele") return `${text} — gene: ${element.gene}; allele identifier: ${element.allele}${chromosome}; notation recognised; see database lookup below`;
  if (element.kind === "gene_reference") return `${text} — gene: ${element.gene}; '+' notation (not a mutant allele identifier)${chromosome}`;
  if (element.kind === "gene_annotation") return `${text} — gene: ${element.gene}; annotation: ${element.annotation || "[Empty]"}${chromosome}; allele identifier not recognised`;
  return `${text}${element.kind === "promoter" ? " — promoter notation" : ""}`;
}

document.querySelector("#example-button").addEventListener("click", () => {
  resetReview();
  input.value = example;
  results.replaceChildren();
  setStatus("Example added. Select ‘Parse genotype’ to explore its structure.");
  input.focus();
});

input.addEventListener("input", () => {
  resetReview();
  results.replaceChildren();
  setStatus("Select ‘Parse genotype’ to analyse your updated input.");
});

function analyse() {
  annotationRun += 1;
  if (reviewInput !== input.value) {
    resetReview();
    reviewInput = input.value;
  }
  results.replaceChildren();
  const parsed = GenotypeParser.parseGenotype(reviewInput, { acceptedCorrections, dismissedCorrections });
  addResult("Original input", parsed.original);
  addResult("Normalised input", parsed.normalised);
  addResult("Normalisation record", parsed.changes.length ? `${parsed.changes.length} changes:` : "No changes made.",
    parsed.changes.map(change => `${change.stage} stage, position ${change.index + 1}: '${change.before}' → '${change.after}'. ${change.reason}`));
  const pending = parsed.suggestions.filter(suggestion => suggestion.status === "pending");
  if (pending.length) {
    addResult("Possible missing hyphen", "Review each suggestion to continue. You can apply the correction or keep your spelling.");
    const snapshot = reviewInput;
    for (const suggestion of pending) {
      const row = document.createElement("div");
      row.className = "result-item";
      const description = document.createElement("p");
      description.textContent = `Position ${suggestion.index + 1}: '${suggestion.before}' → '${suggestion.after}'. ${suggestion.reason}`;
      row.append(description);
      const actions = document.createElement("div");
      actions.className = "actions";
      for (const [label, accepted] of [[`Use ${suggestion.after}`, true], [`Keep ${suggestion.before}`, false]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = accepted ? "primary" : "secondary";
        button.textContent = label;
        button.addEventListener("click", () => {
          if (input.value !== snapshot || reviewInput !== snapshot) return;
          (accepted ? acceptedCorrections : dismissedCorrections).push(suggestion.id);
          analyse();
        });
        actions.append(button);
      }
      row.append(actions);
      results.append(row);
    }
    setStatus("Confirmation needed. Review the spelling suggestions to continue analysing.", true);
    return;
  }
  const kept = parsed.suggestions.filter(suggestion => suggestion.status === "dismissed");
  if (kept.length) addResult("Spellings kept by you", "These suggestions were not applied.", kept.map(s => s.before));
  if (parsed.warnings.length) {
    addResult("Needs your attention", "Only confirmed spelling suggestions have been applied. Bracket structure has not been repaired.",
      parsed.warnings.map(warning => `Position ${warning.index + 1}: ${warning.message}`));
  }
  if (parsed.identifiers.length) addResult("Array identifiers", parsed.identifiers.map(id => `${id.text} — designation: ${id.designation}`).join("\n"));
  parsed.constructs.forEach((construct, index) => {
    addResult(`Expression ${construct.expressionIndex + 1} · Construct ${index + 1}`, construct.text, construct.elements.map(describeFragment));
  });
  if (parsed.unknownFragments.length) {
    addResult("Unknown or unclassified fragments", "These fragments or annotations are not fully classified. Recognising notation does not verify gene identity or biological function.",
      parsed.unknownFragments.map(fragment => `${fragment.text} — ${fragment.reason}`));
  }
  setStatus(parsed.complete
    ? `Structure parsed: ${parsed.constructs.length} construct(s), ${parsed.fragments.length} fragment(s). Database lookup results are shown separately below.`
    : "Partial result. Review the messages below before using this breakdown.", !parsed.complete);
  if (!input.value.trim()) input.focus();
  showGeneAnnotations(parsed, annotationRun);
}

function showGeneAnnotations(parsed, run) {
  const fragments = GenotypeKnowledge.candidates(parsed);
  if (!fragments.length) return;
  const section = document.createElement("section");
  section.className = "result-item";
  const heading = document.createElement("h3");
  heading.textContent = "Knowledge annotations";
  section.append(heading);
  const boxes = fragments.map(fragment => {
    const box = document.createElement("div");
    box.className = "gene-annotation";
    const title = document.createElement("h4");
    title.textContent = `${fragment.text.trim()} · position ${fragment.start + 1}`;
    const body = document.createElement("div");
    body.textContent = "Loading knowledge annotations…";
    box.append(title, body);
    section.append(box);
    return { fragment, body };
  });
  results.append(section);
  // Limit requests across a large input; the client deduplicates repeated names.
  let next = 0;
  async function worker() {
    while (next < boxes.length && run === annotationRun) {
      const { fragment, body } = boxes[next++];
      const annotation = await knowledge.annotate(fragment);
      if (run !== annotationRun) return;
      body.textContent = "";
      for (const record of [annotation.protein, annotation.fluorescent, annotation.marker, annotation.gene, annotation.allele, annotation.promoter, annotation.transgene, annotation.strain].filter(Boolean)) {
        const text = document.createElement("p");
        const label = { promoter: "Corresponding gene", protein: "Reference protein", gene: "Gene", allele: "Allele", transgene: "Transgene", strain: "Strain", fluorescent_protein: "Fluorescent protein", marker: "Marker" }[record.type];
        text.textContent = `${label}: ${record.symbol || record.query} — ${record.status}${record.id ? ` (${record.id})` : ""}. ${record.summary}`;
        body.append(text);
        if (record.type === "protein" && record.status === "matched") {
          const details = document.createElement("p");
          details.textContent = `Corresponding gene: ${record.query}. Reference length: ${record.proteinLength ? `${record.proteinLength} amino acids` : "not supplied"}. Subcellular location: ${record.location || "not supplied"}.`;
          body.append(details);
        }
        if (record.type === "fluorescent_protein") {
          const spectrum = document.createElement("p");
          spectrum.textContent = `Colour: ${record.colour}. ${record.spectralLabel}: excitation ${record.excitationNm} nm; emission ${record.emissionNm} nm.`;
          body.append(spectrum);
          if (record.sensor) {
            const sensor = document.createElement("p");
            sensor.textContent = `Sensor properties: ${record.sensor}`;
            body.append(sensor);
          }
        }
        if (record.note) {
          const note = document.createElement("p");
          note.className = "hint";
          note.textContent = record.note;
          body.append(note);
        }
        if (record.functionAnnotation) {
          const functional = document.createElement("p");
          functional.textContent = `Automated functional annotation: ${record.functionAnnotation}`;
          body.append(functional);
        }
        if (record.evidence) {
          const evidence = document.createElement("p");
          evidence.className = "hint";
          const date = record.reviewedAt ? `Reviewed ${record.reviewedAt}` : `Retrieved ${record.retrievedAt.slice(0, 10)}`;
          evidence.textContent = `${record.evidence}. Source: ${record.source || "Alliance / WormBase"}. ${date}.`;
          body.append(evidence);
        }
        for (const source of record.links || []) {
          const link = document.createElement("a");
          link.textContent = `${source.label} ↗ `;
          link.href = source.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          body.append(link);
        }
      }
      if (fragment.kind === "gene_annotation") {
        const note = document.createElement("p");
        note.textContent = "Only the gene is annotated; the parenthesised annotation remains uninterpreted.";
        body.append(note);
      }
    }
  }
  for (let index = 0; index < Math.min(3, boxes.length); index++) void worker();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyse();
});

