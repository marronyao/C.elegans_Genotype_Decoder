(function (root) {
  "use strict";
  const constructs = typeof module !== "undefined" && module.exports ? require("./construct-catalogue.js") : root.ConstructCatalogue;
  const markers = typeof module !== "undefined" && module.exports ? require("./marker-catalogue.js") : root.MarkerCatalogue;
  const { normaliseInput } = typeof module !== "undefined" && module.exports
    ? require("./normalise.js") : root.GenotypeNormaliser;
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const opening = new Set(["(", "[", "{"]);

  function split(text, separators, offset) {
    const pieces = [];
    const stack = [];
    let start = 0;
    let precedingSeparator = null;
    for (let i = 0; i < text.length; i += 1) {
      const character = text[i];
      if (opening.has(character)) stack.push(character);
      else if (Object.hasOwn(pairs, character)) {
        if (stack.at(-1) === pairs[character]) stack.pop();
        else stack.push("unresolved");
      } else if (!stack.length) {
        const separator = separators.find(value => text.startsWith(value, i));
        if (separator) {
          pieces.push({ text: text.slice(start, i), start: offset + start, end: offset + i, precedingSeparator });
          i += separator.length - 1;
          start = i + 1;
          precedingSeparator = separator;
        }
      }
    }
    pieces.push({ text: text.slice(start), start: offset + start, end: offset + text.length, precedingSeparator });
    return pieces;
  }

  function readIdentifier(label) {
    const match = /^([a-z]+)(Is|Ex)(\d+)$/.exec(label);
    return match ? { text: label, prefix: match[1], designation: match[2], number: match[3] } : null;
  }

  function classifyFragment(value) {
    const constructKind = constructs.classify(value);
    if (constructKind) return constructKind;
    const markerKind = markers.classify(value);
    if (markerKind) return { kind: markerKind, verified: false };
    if (readIdentifier(value) || /^(?:WB:)?WBTransgene\d{8}$/.test(value)) return { kind: "transgene", verified: false };
    if (/^(?:[A-Z]{1,8}\d+|(?:WB:)?WBStrain\d{8})$/.test(value)) return { kind: "strain", verified: false };
    if (/^[a-z]{3}-\d+p$/.test(value)) return { kind: "promoter" };
    if (/^[A-Za-z]{3}-\d+$/.test(value) && /[A-Z]/.test(value)) {
      return { kind: "protein", gene: value.toLowerCase(), protein: value.toUpperCase(), verified: false };
    }
    // Candidate names only: identity is resolved separately against C. elegans records.
    if (/^(?:[a-z]{3}-\d+|[A-Z][A-Za-z0-9]*\d\.\d+|(?:WB:)?WBGene\d{8})$/.test(value)) {
      return { kind: "gene", gene: value, verified: false };
    }
    // Recognise notation only; neither the gene nor allele is database-verified.
    const match = /^([a-z]{3}-\d+)\s*\(\s*([^()]*)\s*\)(?:\s+(I|II|III|IV|V|X))?$/.exec(value);
    if (!match) return { kind: "unknown" };
    const gene = match[1];
    const annotation = match[2].trim();
    const chromosome = match[3] || null;
    if (/^[a-z]+\d+$/.test(annotation)) {
      return { kind: "gene_allele", gene, allele: annotation, chromosome, verified: false };
    }
    if (annotation === "+") return { kind: "gene_reference", gene, annotation, chromosome, verified: false };
    return { kind: "gene_annotation", gene, annotation, chromosome, verified: false };
  }

  function parseGenotype(original, options) {
    const result = { ...normaliseInput(original, options), identifier: null, identifiers: [], expressions: [], constructs: [], fragments: [], unknownFragments: [], warnings: [], complete: false };
    const text = result.normalised;
    const warn = (code, message, index) => result.warnings.push({ code, message, index });
    const unknown = (fragment, reason) => {
      if (fragment.text.trim()) result.unknownFragments.push({ ...fragment, reason });
    };
    if (result.suggestions.some(s => s.status === "pending")) warn("PENDING_CORRECTIONS", "Review possible missing hyphens before continuing.", 0);
    if (!text.trim()) {
      warn("EMPTY_INPUT", "Enter a genotype or expression to begin.", 0);
      return result;
    }
    // Validate once across the whole input; never insert or replace brackets.
    const stack = [];
    for (let i = 0; i < text.length; i += 1) {
      if (opening.has(text[i])) stack.push({ character: text[i], index: i });
      else if (Object.hasOwn(pairs, text[i])) {
        if (stack.at(-1)?.character === pairs[text[i]]) stack.pop();
        else warn("MISMATCHED_BRACKET", `Unexpected '${text[i]}'. No repair has been made.`, i);
      }
    }
    for (const entry of stack) warn("UNCLOSED_BRACKET", `Unclosed '${entry.character}'. Results are provisional; no closing bracket has been inserted.`, entry.index);

    function addConstruct(component, expressionIndex, arrayIdentifier = null) {
      if (!component.text.trim()) {
        warn("EMPTY_CONSTRUCT", "An empty expression or construct was found beside a separator or inside brackets.", component.start);
        return;
      }
      const parts = split(component.text, ["::", "_"], component.start);
      // A gene_3'UTR suffix names one regulatory element, not a coding fusion.
      for (let i = 0; i < parts.length - 1; i++) {
        const next = parts[i + 1];
        const joined = component.text.slice(parts[i].start - component.start, next.end - component.start);
        if (next.precedingSeparator === "_" && constructs.classify(joined.trim())?.kind === "utr") {
          parts[i] = { ...parts[i], text: joined, end: next.end };
          parts.splice(i + 1, 1);
        }
      }
      const elements = parts.map(part => {
        const value = part.text.trim();
        const fragment = { ...part, ...classifyFragment(value) };
        if (!value) warn("EMPTY_ELEMENT", "An empty fragment was found beside '::' or '_'.", part.start);
        else if (fragment.kind === "unknown") unknown(fragment, "Unclassified fragment; its spelling and nested annotations are preserved.");
        else if (fragment.kind === "gene_annotation") unknown(fragment, "Gene notation recognised, but the bracketed text is not a recognised allele identifier. It is retained as an annotation.");
        result.fragments.push(fragment);
        return fragment;
      });
      // Only :: neighbours establish coding context. A promoter names a DNA
      // regulatory element, not its own protein product; underscores are textual.
      for (let i = 0; i < elements.length; i++) {
        const current = elements[i];
        if (!["gene", "protein"].includes(current.kind) || !/^[a-z]{3}-\d+$/.test(current.gene)) continue;
        const before = current.precedingSeparator === "::" ? elements[i - 1] : null;
        const after = elements[i + 1]?.precedingSeparator === "::" ? elements[i + 1] : null;
        if ([before, after].some(f => f && ["promoter", "gene", "protein", "fluorescent_protein"].includes(f.kind))) {
          current.proteinCandidate = true;
          current.protein = current.gene.toUpperCase();
          current.proteinContext = "Coding-sequence/protein candidate inferred from construct notation; expression and fusion are not experimentally verified.";
        }
      }
      result.constructs.push({ ...component, expressionIndex, arrayIdentifier, elements });
    }

    for (const expression of split(text, [";"], 0)) {
      const expressionIndex = result.expressions.length;
      result.expressions.push(expression);
      // Preserve a malformed array as one unit instead of treating its '+' as
      // a trustworthy boundary merely because the opening bracket is absent.
      if (/^\s*[a-z]+(?:Is|Ex)\d+\s+(?!\s*\[)\S/.test(expression.text)) {
        unknown(expression, "Possible array contents without an opening square bracket.");
        warn("MISSING_OPENING_BRACKET", "An array identifier is followed by text without '['. Array boundaries have not been guessed.", expression.start);
        continue;
      }
      for (const component of split(expression.text, ["+"], expression.start)) {
        // An array-like label must be a single token before the opening bracket.
        const array = /^\s*([^\s\[\](){}:+;]+)\s*\[/.exec(component.text);
        if (array) {
          const label = array[1];
          const identifier = readIdentifier(label);
          if (identifier) {
            identifier.start = component.start + component.text.indexOf(label);
            identifier.end = identifier.start + label.length;
            result.identifiers.push(identifier);
          }
          else {
            const start = component.start + component.text.indexOf(label);
            unknown({ text: label, start, end: start + label.length }, "Unrecognised label before square brackets.");
            warn("UNRECOGNISED_IDENTIFIER", "The label before square brackets is not a recognised Is/Ex identifier; it has been preserved.", start);
          }
          const open = array[0].length - 1;
          let depth = 1;
          let close = -1;
          for (let i = open + 1; i < component.text.length; i += 1) {
            if (component.text[i] === "[") depth += 1;
            if (component.text[i] === "]" && --depth === 0) { close = i; break; }
          }
          const end = close < 0 ? component.text.length : close;
          for (const construct of split(component.text.slice(open + 1, end), ["+", ";"], component.start + open + 1)) addConstruct(construct, expressionIndex, identifier);
          if (close >= 0 && component.text.slice(close + 1).trim()) {
            const trailing = { text: component.text.slice(close + 1), start: component.start + close + 1, end: component.end };
            unknown(trailing, "Text following an array has no explicit separator.");
            warn("TRAILING_TEXT", "Text following an array was preserved. Add a semicolon if it is a separate expression.", trailing.start);
          }
        } else if (/^\s*[a-z]+(?:Is|Ex)\d+\s+\S/.test(component.text)) {
          unknown(component, "Possible array contents without an opening square bracket.");
          warn("MISSING_OPENING_BRACKET", "An array identifier is followed by text without '['. Array boundaries have not been guessed.", component.start);
        } else {
          const identifier = readIdentifier(component.text.trim());
          if (identifier) result.identifiers.push(identifier);
          addConstruct(component, expressionIndex);
        }
      }
    }
    result.identifier = result.identifiers.length === 1 ? result.identifiers[0] : null;
    result.complete = result.warnings.length === 0;
    return result;
  }
  const api = { parseGenotype };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GenotypeParser = api;
})(globalThis);
