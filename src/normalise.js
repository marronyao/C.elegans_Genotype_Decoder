(function (root) {
  "use strict";
  // Avoid broad Unicode normalisation, which can alter scientific text.
  function normaliseInput(original, { acceptedCorrections = [], dismissedCorrections = [] } = {}) {
    if (typeof original !== "string") throw new TypeError("Input must be a string.");
    const changes = [];
    let normalised = "";
    for (let index = 0; index < original.length; index += 1) {
      const before = original[index];
      const code = before.charCodeAt(0);
      const after = code >= 0xff01 && code <= 0xff5e
        ? String.fromCharCode(code - 0xfee0)
        : before === "\u3000" ? " " : before;
      normalised += after;
      if (before !== after) changes.push({ index, stage: "width", before, after, reason: "Converted a full-width character to its ASCII equivalent." });
    }
    // Undo only the Markdown escape for underscores; preserve all other escapes.
    for (const match of [...normalised.matchAll(/\\_/g)].reverse()) {
      changes.push({ index: match.index, stage: "escape", before: match[0], after: "_", reason: "Removed a Markdown escape before an underscore." });
      normalised = normalised.slice(0, match.index) + "_" + normalised.slice(match.index + 2);
    }
    // General expressions no longer require an enclosing array.
    function tokens(text, pattern) {
      return [...text.matchAll(pattern)].filter(match => {
        // Parenthesised text may be an allele identifier or an annotation,
        // e.g. abc123. It must not be treated as a misspelt gene name.
        let depth = 0;
        for (const character of text.slice(0, match.index)) {
          if (character === "(") depth += 1;
          if (character === ")") depth = Math.max(0, depth - 1);
        }
        return depth === 0 && !/^\s*\[/.test(text.slice(match.index + match[0].length));
      });
    }
    // Each stage is applied right to left; recorded offsets refer to that stage.
    const promoters = tokens(normalised, /(?<![\p{L}\p{N}_-])P([a-z]{3}-\d+)(?![\p{L}\p{N}_-])/gu);
    for (const match of promoters.reverse()) {
      const after = `${match[1]}p`;
      changes.push({ index: match.index, stage: "promoter", before: match[0], after, reason: "Standardised promoter notation to the gene-name-p form." });
      normalised = normalised.slice(0, match.index) + after + normalised.slice(match.index + match[0].length);
    }
    const suggestions = tokens(normalised, /(?<![\p{L}\p{N}_-])(P?)([a-z]{3})(\d+)(p?)(?![\p{L}\p{N}_-])/gu)
      .filter(match => !(match[1] && match[4]))
      .map(match => {
        const after = `${match[2]}-${match[3]}${match[1] || match[4] ? "p" : ""}`;
        const id = `${match.index}:${match[0]}:${after}`;
        return {
          id, index: match.index, before: match[0], after,
          status: acceptedCorrections.includes(id) ? "accepted" : dismissedCorrections.includes(id) ? "dismissed" : "pending",
          reason: "Could a hyphen be missing? This is a spelling suggestion, not a verified gene identity.",
        };
      });
    for (const suggestion of [...suggestions].reverse()) {
      if (suggestion.status !== "accepted") continue;
      changes.push({ index: suggestion.index, stage: "confirmed", before: suggestion.before, after: suggestion.after, reason: "Applied a missing-hyphen correction confirmed by the user." });
      normalised = normalised.slice(0, suggestion.index) + suggestion.after + normalised.slice(suggestion.index + suggestion.before.length);
    }
    return { original, normalised, changes, suggestions };
  }
  const api = { normaliseInput };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GenotypeNormaliser = api;
})(globalThis);
