# C. elegans Genotype Decoder

A dependency-free static webpage for exploring genotype and general expression structure, with a British English interface. It preserves unfamiliar text; it does not claim to understand the biology of every expression.

**Current version: C. elegans Genotype Decoder V1.0** (`1.0.0` in package metadata).

## Quick start for researchers

1. Open the published website in a current Chrome, Edge, Firefox or Safari browser, or run it locally using the instructions below. No account, installation or API key is required to use the website. A public URL has not yet been assigned to this project.
2. Paste a genotype, or select **Use example**, then **Parse genotype**.
3. Confirm or decline suggested spelling corrections. Read structural results separately from database annotations and check the cited sources before using them in research.
4. Use **Dark mode / Light mode** to switch themes. Initially the site follows the operating-system preference; an explicit choice is saved in browser storage when available.
5. Select **Cite this tool**, choose APA 7, MLA 9, Chicago or BibTeX, and copy the citation. On a public deployment the website URL is filled automatically; for local use, enter the published URL. Citation author: **Zihao Yao** (APA: **Yao, Z.**). Plain-text citations require title italics when formatting a manuscript. If automatic copying is unavailable, the text is selected for manual copying.

Structural parsing and the bundled marker/strain summaries work locally without an internet connection. Live Alliance and UniProt annotations require internet access and depend on those services' availability and coverage. The app does not infer biological validity from a successfully parsed structure.

## Publish on GitHub Pages

This is a static HTML/CSS/JavaScript website: GitHub Pages can host it without a backend, npm installation or build command. `package.json` is only needed for development tests; `private: true` prevents accidental npm publication and does not restrict GitHub Pages access.

1. Create a **public** GitHub repository, for example `celegans-genotype-decoder`. A public repository is the straightforward option for GitHub Free.
2. Upload the files from this directory into the repository root, preserving the `src/` and `tests/` folders. **Do not upload the enclosing project folder as an extra directory.** `index.html` must appear directly at the root.
3. Include `index.html`, `styles.css`, `app.js`, `site-ui.js`, `theme.js`, `logo.svg`, the complete `src/` folder, `README.md`, `package.json`, `tests/`, `CITATION.cff`, `.gitignore` and `.nojekyll`. The latter disables Jekyll processing. Do not upload `.codex/`, `.agents/`, credentials or local temporary files. Note that `.gitignore` does not filter files dragged into GitHub's browser upload form; exclude those folders manually.
4. Commit the upload to `main`. Open **Settings → Pages → Build and deployment**. Set **Source** to **Deploy from a branch**, choose **main** and **/(root)**, then **Save**.
5. Wait for the Pages deployment to finish (it can take several minutes). Its status is visible in **Actions** and the published link appears in **Settings → Pages**.
6. The project website will normally be `https://YOUR-USERNAME.github.io/celegans-genotype-decoder/`. This is an example, not an existing deployment. Users open that URL directly; they do not need GitHub accounts, Python or Node.js. The repository's `github.com` URL is the source-code page, not the running website.
7. Add the real website URL to the repository's **About → Website** field and this README, and add `url:` to `CITATION.cff`. Verify the live site before sharing it.

For browser upload, use **Add file → Upload files** (or the upload link on a new empty repository), then commit. For future updates, upload/commit changed files to `main`; Pages redeploys automatically. An optional GitHub Release tagged `v1.0.0` can record the first released source version; creating a Release alone does not enable Pages.

### Check the published website

- Open the exact Pages URL in a private/incognito window. Confirm the logo, favicon and styles load, and that the version footer says V1.0.
- Parse the built-in example and `N2; eGFP; pRF4` to check structural parsing and local summaries.
- Try `unc-30(e191); HSP-4::eGFP` to check live Alliance and UniProt annotations. Network errors should appear as unavailable annotations without preventing structural results.
- Switch themes and reload. Select each citation format, check the public URL, and test copying. Try a narrow/mobile window too.
- If the site returns 404, confirm `index.html` is at the selected publishing root and inspect the Pages deployment in Actions. For stale images, reload or reopen the browser tab.

GitHub provides a `github.io` address; purchasing a domain is optional. To use your own domain, configure **Settings → Pages → Custom domain**, then the domain's DNS records as described in GitHub's documentation, and enable **Enforce HTTPS** when available. DNS records depend on whether you use an apex domain or a subdomain.

Official guidance: [configure the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [create a Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), and [configure a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## Data, attribution and release status

- Developer: Marron Z. Yao. Department: Erasmus MC, Rotterdam, The Netherlands. Contact: marronzyao@gmail.com. For academic citations use **Zihao Yao**. `CITATION.cff` provides citation metadata for GitHub.
- Parsing happens in the browser. Individual lookup identifiers are sent to Alliance and UniProt as described below; there is no application backend or analytics code in this project. Theme preference is stored locally. GitHub and the external data providers handle requests under their own policies.
- The logo and favicon use the same supplied `logo.svg`. Source-backed local catalogue entries retain their source links; academic users should consult and cite original data sources when relevant.
- No project licence has been selected. Publishing the repository and deploying the website do not by themselves grant a general open-source reuse licence. Choose and add a `LICENSE` before describing this project as open-source; account for any third-party material separately.
- Release checks on 2026-09-23: automated tests pass; local asset references resolve; sample Alliance and UniProt requests return HTTP 200 with CORS headers allowing a GitHub Pages origin. These are pre-deployment checks, not a guarantee of future third-party uptime or a substitute for checking the actual published URL.

## Run locally

Open `index.html` directly in a modern browser. No installation or API key is needed. Alternatively, with Python installed, run `python -m http.server 8000 --bind 127.0.0.1` in this directory and visit http://localhost:8000. Stop the server with Ctrl+C.

## Parsing rules

- Top-level `;` separates expressions.
- Top-level `+` separates constructs, including constructs within an array.
- `::` and `_` separate textual fragments outside nested brackets. An underscore is a notation separator, not evidence of a biological fusion.
- Parentheses, square brackets and braces protect their nested content from splitting. `rol-6(+)`, `ser-2P3(1.6k)` and `C34B2.10(rER)` remain intact.
- Case-sensitive Is/Ex identifiers are recognised when present. They are no longer required. Semicolon-separated arrays and mixtures of arrays and ordinary expressions are supported.
- Unrecognised fragments remain visible. Dots, hyphens, spaces and slashes are not automatically treated as separators. Simple gene–allele notation and an explicitly supplied chromosome label can be extracted; no mutation effect, promoter variant or protein function is inferred.
- Missing or mismatched brackets, empty fragments and unseparated text after an array produce diagnostics. Missing array brackets are not invented.

For example:

```text
ser-2P3(1.6k)_GFP::C34B2.10(rER); POLO36; ord-1::GFP
```

produces three expressions with these fragments:

1. `ser-2P3(1.6k)`, `GFP`, `C34B2.10(rER)`
2. `POLO36`
3. `ord-1`, `GFP`

Existing array inputs such as `dvIs100 [unc-54p::Aβ1-42::unc-54 3'UTR + mtl-2p::GFP]` still work. Examples are illustrative and have not been checked against strain records.

## Gene and allele notation

`unc-30(e191)` is recognised as gene `unc-30` with allele identifier `e191`. Optional spaces, full-width parentheses and an explicit chromosome label are supported, for example `unc-30 (e191) IV`. This recognises a writing pattern only; the identifier and its association with the gene have not been checked against a database.

The current rule accepts three lowercase letters, a hyphen and digits for the gene, and lowercase letters followed by digits for the allele. It does not infer deletion, loss of function, phenotype or zygosity. More complex allele notation remains unclassified.

`unc-30(变异编号)` extracts the gene and retains the placeholder as an annotation, rather than claiming it is an allele identifier. `rol-6(+)` is recognised as gene-plus notation and is not classified as a mutant allele. General annotations such as `C34B2.10(rER)` and `ser-2P3(1.6k)` remain intact. Slash-separated or space-separated compound genotypes are not yet decomposed into their individual alleles.

Fragments can have kind `gene_allele` (with `gene`, `allele`, optional `chromosome` and `verified: false`), `gene_reference` or `gene_annotation` (with `gene`, `annotation` and optional `chromosome`). Unknown bracketed annotations remain in `unknownFragments`.

## Normalisation and review

Full-width ASCII characters and spaces are normalised with a change record. A pasted Markdown escape before an underscore (`\_`) is changed to `_` and recorded. Whole promoter tokens such as `Pmtl-2` become `mtl-2p`; the supported gene-name pattern is three lowercase letters, a hyphen and digits. More complex notation such as `ser-2P3(1.6k)` is retained without guessing its meaning.

`mtl2`, `mtl2p` and `Pmtl2` produce optional missing-hyphen suggestions in general expressions as well as arrays. Select **Use …** to accept or **Keep …** to decline. The page waits until all suggestions are reviewed before showing the breakdown. Suggestions are spelling heuristics, not verified gene identities. Editing the input resets review decisions. Original input always remains intact.

Parenthesised content is excluded from gene spelling and promoter normalisation, so an allele identifier such as `abc123` is not changed to `abc-123`. The gene in `unc30(abc123)` can still be corrected after confirmation.

## Files

- `index.html`: accessible input, controls and results region.
- `styles.css`: responsive layout and visual styling.
- `app.js`: review workflow and safe text rendering.
- `theme.js`: initial theme selection before styles load.
- `site-ui.js`: theme controls and citation formatting/copying.
- `logo.svg`: supplied vector logo, also used as the favicon.
- `src/normalise.js`: normalisation, change records and spelling suggestions.
- `src/parser.js`: expression, construct and fragment parsing with diagnostics.
- `src/knowledge.js`: live Alliance and UniProt annotation requests and matching.
- `src/marker-catalogue.js`, `src/strain-catalogue.js`: local source-backed summaries.
- `tests/`: parser, normalisation and page wiring tests; DOM-stub checks are not visual browser tests.
- `package.json`: test command; no dependencies to install.
- `CITATION.cff`: machine-readable citation author and version for GitHub.
- `.nojekyll`: serve the static website without Jekyll processing.
- `.gitignore`: exclude local tools, secrets and generated files from Git commits.

## Tests

With Node.js 22 or later, run `npm test`.

## Module API

Both modules work as ordered browser scripts and CommonJS modules:

```js
const { parseGenotype } = require('./src/parser.js');
const result = parseGenotype('Pmtl-2::GFP; POLO36');
```

Results include `original`, `normalised`, `changes`, `suggestions`, `identifiers`, `expressions`, `constructs`, `fragments`, `unknownFragments`, `warnings` and `complete`. The compatibility field `identifier` is populated when exactly one array identifier is present. Constructs have `expressionIndex`, `arrayIdentifier` and `elements`; `fragments` is the flattened list of elements. `precedingSeparator` records the textual separator at each level. Unknown names are retained, and recognised simple promoter notation has kind `promoter`.

`complete` means structural parsing finished without diagnostics or pending spelling review, not that biological meaning has been verified. To review a suggestion, call `parseGenotype(original, { acceptedCorrections: [suggestion.id], dismissedCorrections: [] })` using the same original string. Unrecognised IDs have no effect.

Changes are recorded in execution order across width, escape, promoter and confirmed stages. Each change index refers to the string immediately before that edit; replay records in order. Suggestion indices refer to the string before confirmed corrections. Fragment `start` and exclusive `end` offsets refer to the final normalised string. All offsets are zero-based UTF-16 positions; the interface displays positions starting at one.

Structural parsing is local to the browser. After spelling review, gene-family fragments are looked up in Alliance of Genome Resources; simple promoters are annotated through their corresponding genes. Transgene identifiers and candidate strain names are also resolved. Known fluorescent proteins and selected transformation markers use source-backed local annotations; UTRs, non-fluorescent tags and unsupported fragments remain unannotated. There are no tissue predictions or Methods generation.

## Gene and allele knowledge annotations

Try `unc-30(e191); unc-30; B0564.10; rol-6(+)`. Plain gene symbols (`unc-30`), sequence names (`B0564.10`) and stable identifiers (`WBGene00006766`, optionally prefixed with `WB:`) are recognised as candidate `gene` fragments. This does not set the parser's `verified` flag to true. Existing gene–allele, gene-plus and gene-annotation fragments are also eligible; for unrecognised parenthesised annotations only the gene is annotated. Standalone allele names and compound genotypes are not resolved in this version.

`src/knowledge.js` queries the official [Alliance search API](https://www.alliancegenome.org/swagger-ui/) using `gene_search_result` and `allele_search_result` categories. Only exact names, systematic names, stable IDs or returned gene synonyms from *C. elegans* are accepted. Canonical matches take priority over synonyms. Searches inspect up to 100 results; a missing match means no exact match was found in those results, not that the entity does not exist. Multiple distinct exact matches are reported as ambiguous.

Allele names are looked up separately and their `geneCrossReferences` must contain the resolved gene's stable ID. The page displays database-provided English gene descriptions, separately labelled automated functional annotations, and available allele variant types and molecular consequences. It does not infer loss/gain of function or phenotype from an allele name or consequence. Each matched entity has Alliance and WormBase links and a retrieval date. API response fields and live `unc-30` / `e191` records were checked on 2026-09-23; external services and coverage can change.

The browser sends individual gene, allele, transgene and candidate strain identifiers to Alliance, not the complete input. An internet connection is required for annotations. Requests time out after 15 seconds, duplicate lookups share a session cache, and at most three fragment lookups run concurrently per analysis. Failed requests can be retried by parsing again. Editing or reparsing invalidates older UI updates. Parsing remains usable when the database is unavailable; structural completion and knowledge matching are separate states.

The public API is `GenotypeKnowledge.createClient().annotate(fragment)` (asynchronous), returning separate `gene` and optional `allele` records, or a `promoter` record with `matched`, `not_found`, `ambiguous`, `unverified` or `unavailable` status. `GenotypeKnowledge.candidates(parsed)` selects eligible fragments. The client also accepts an injected fetch function for deterministic tests. The page loads this module after the parser and before `app.js`.


Simple promoters such as `unc-30p` (including normalised `Punc-30`) resolve the corresponding gene with the same exact-match rules and shared request cache. Promoter cards show the gene name, stable ID, source links and only the expression sentence from the database automated gene description. They do not display the full gene function annotation or rank tissues as primary when the source does not provide that ranking. Missing expression is explicit. Gene expression is a reference, not verification of the specific promoter fragment. Complex promoter variants such as `ser-2P3(1.6k)` remain unannotated.


## Transgene and strain annotations

Try `CL2006; dvIs2; dvIs2 [unc-30p::GFP]`. Is/Ex labels, including labels outside array brackets, and `WBTransgene` IDs are transgene candidates. Uppercase prefixes followed by digits (including `N2`, `CL2006` and `POLO36`) and `WBStrain` IDs are strain candidates, not confirmed identities. Array labels carry start/end offsets and receive their own annotation cards. The fragment count still counts only construct elements.

Transgenes use Alliance's `allele_search_result` category, restricted to exact C. elegans `WBTransgene` records. The checked `/api/allele/{id}` detail supplies content and construction notes. Input bracket contents are preserved and are not claimed to match the registered construct. Search matches survive detail failures with an explicit unavailable-detail message.

Strains use the `model_search_result` category, restricted to exact C. elegans `WBStrain` records; composite `WBGenotype` disease models are excluded. Cards show database-listed disease-model associations and provide Alliance search JSON, WormBase and CGC catalogue links. CGC pages are external links, not scraped or verified by the application. Alliance model coverage is not a full strain catalogue: entries absent from both the local supplement and returned Alliance records remain not_found, not non-existent. This version does not retrieve complete strain genotypes, maintenance conditions or phenotypes. Stable IDs accept an optional `WB:` prefix. Live records for CL2006 and dvIs2 were inspected on 2026-09-23.


### Common-strain supplement

`src/strain-catalogue.js` provides exact-name, source-backed English summaries for N2, CB4856, CB1370 and CF1038, reviewed on 2026-09-23. These records are used before Alliance lookup and work offline. N2 is described as the Bristol wild-type reference strain; CB4856 is a genetically distinct Hawaiian isolate, not an N2 alias. WT and N2 sub-strains are not silently equated with N2. Each entry includes source links and a review date; the UI distinguishes these curated sources from live Alliance retrieval dates. No WormBase IDs are invented. Unlisted strains still use Alliance. Extend this catalogue only after checking identity and claims against the cited primary source or official catalogue.


## Fluorescent proteins and transformation markers

`src/marker-catalogue.js` is a reviewed local snapshot, not a live FPbase search. Load it before the parser and knowledge module. Exact names and explicit aliases classify fragments as `fluorescent_protein` or (for standalone marker constructs) `marker`. Gene-related markers retain their existing gene/allele kind and receive a separate marker-context record in addition to Alliance annotations. Local marker context remains available when Alliance fails. The parser does not assert that the submitted construct or biological sample has been experimentally verified.

Supported protein names: GFP, EGFP/eGFP, YFP, EYFP/eYFP, CFP, ECFP/eCFP, mCherry, tdTomato, sfGFP, mNeonGreen and pHTomato. The catalogue lists the additional accepted aliases. Unknown variants are not guessed from substrings. Cards show the standard English name, colour and excitation/emission maxima in nm, with source links and review dates. Generic GFP/YFP/CFP retain variant uncertainty; displayed values are explicitly representative EGFP/EYFP/ECFP values, not exact identification. Spectral peaks do not specify microscope laser lines or filter/detector bandwidths.

FPbase supplies the ordinary protein spectral references. pHTomato uses the Li and Tsien original study (https://pmc.ncbi.nlm.nih.gov/articles/PMC3959862/): 550/580 nm excitation/emission peaks and apparent pKa about 7.8. Its intensity increases with pH; quantitative pH requires calibration and controls, rather than interpreting intensity directly as pH. The snapshot preserves the original paper's measurement context; other studies may report different measured peaks.

Marker context uses WormBook's transformation marker table (https://www.ncbi.nlm.nih.gov/books/NBK19648/table/A10923/). Supported contexts include rol-6(su1006), bare rol-6 (conditional explanation), rol-6(+) (not the Roller allele), pRF4, pPD10.46, unc-22 antisense, unc-119(+) and pha-1(+). Rescue markers require the relevant mutant host; other alleles do not inherit these annotations. UTRs and non-fluorescent tags such as FLAG, HA and NLS remain unannotated. This does not prevent fluorescence annotation when a recognised FP is used as a fusion tag.

Try `eGFP; GFP; YFP; mCherry; pHTomato; rol-6(su1006); rol-6(+); unc-119(+); pRF4; unc-54 3'UTR; FLAG`.

## Reference protein annotations

Examples: `hsp-4p::hsp-4::eGFP`, `hsp-4p::HSP-4::EGFP`, `HSP-4::eGFP`. Uppercase/mixed-case simple protein names (`HSP-4`, `Hsp-4`) are recognised as `protein` candidates and map to lowercase `hsp-4` for lookup without rewriting the input. Lowercase simple gene fragments gain `proteinCandidate`, `protein` and `proteinContext` fields when joined by `::` to a promoter, gene/protein or fluorescent-protein neighbour; they retain their gene classification and annotation. Fluorescent-protein aliases are handled separately. This is a notation-based coding-context inference, not proof of expression, translational fusion, reading frame or protein activity.

`hsp-4p::GFP` is a promoter reporter and does not trigger an HSP-4 protein annotation. Underscores, plus signs and semicolons do not imply protein coding/fusion context. Allele notation and gene-plus notation are not converted into protein candidates. Sequence-name and isoform-specific protein resolution is not implemented in this version.

The browser queries `https://rest.uniprot.org/uniprotkb/search` with `gene_exact:<gene>` and `organism_id:6239`. Responses are checked for exact gene names/synonyms and C. elegans taxon ID. One reviewed Swiss-Prot entry is preferred as a reference; multiple equally preferred records remain ambiguous. A unique unreviewed record is labelled as such. Searches with more than 100 results remain ambiguous rather than silently selecting an incomplete result set. An inferred reference protein is not asserted to be the exact isoform encoded by the user's construct.

Cards show the reference name, functional description with source qualifiers, amino-acid length, subcellular location, evidence codes, UniProt release (when exposed), retrieval date and entry links. Alternative matching entries are linked. Native protein properties are not claimed for the fusion. HSP-4 live results checked on 2026-09-23 included reviewed P20163 (657 aa) and unreviewed V6CL98; the reviewed entry is the reference. Queries share the existing request cache and 15-second timeout, with failed responses retryable. Protein annotation is independent of Alliance gene lookup availability.
