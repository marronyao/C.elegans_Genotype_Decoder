"use strict";
(() => {
  const toggle = document.querySelector("#theme-toggle");
  if (!toggle) return;
  const root = document.documentElement;
  const syncTheme = () => {
    const dark = root.dataset.theme === "dark";
    toggle.textContent = dark ? "Light mode" : "Dark mode";
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  };
  let explicitTheme = false;
  try { explicitTheme = ["light", "dark"].includes(localStorage.getItem("decoder-theme")); } catch (_) {}
  toggle.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    explicitTheme = true;
    try { localStorage.setItem("decoder-theme", root.dataset.theme); } catch (_) {}
    syncTheme();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => {
    if (!explicitTheme) { root.dataset.theme = event.matches ? "dark" : "light"; syncTheme(); }
  });
  syncTheme();

  const style = document.querySelector("#citation-style");
  const urlInput = document.querySelector("#citation-url");
  const output = document.querySelector("#citation-output");
  const status = document.querySelector("#citation-status");
  const copy = document.querySelector("#copy-citation");
  const location = window.location;
  if (/^https?:$/.test(location.protocol) && !/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
    urlInput.value = location.origin + location.pathname;
  }
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const mlaDate = now.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  function renderCitation() {
    let url;
    try {
      url = new URL(urlInput.value.trim());
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error();
    } catch (_) {
      output.value = "Enter the public website URL to generate a citation.";
      copy.disabled = true;
      status.textContent = "A valid public website URL is required.";
      return;
    }
    url.search = "";
    url.hash = "";
    const address = url.href;
    const title = "C. elegans Genotype Decoder";
    const bibUrl = address.replace(/[{}\\]/g, character => encodeURIComponent(character));
    const citations = {
      apa: `Yao, Z. (n.d.). ${title} [Web application]. Retrieved ${date}, from ${address}`,
      mla: `Yao, Zihao. ${title}. ${address}. Accessed ${mlaDate}.`,
      chicago: `Yao, Zihao. ${title}. Accessed ${date}. ${address}.`,
      bibtex: `@misc{yao_celegans_decoder,\n  author = {Yao, Zihao},\n  title = {{C. elegans Genotype Decoder}},\n  howpublished = {Web application},\n  url = {${bibUrl}},\n  note = {Accessed: ${isoDate}}\n}`
    };
    output.value = citations[style.value];
    copy.disabled = false;
    status.textContent = "Ready to copy. Plain-text formats; italicise the tool title in your manuscript.";
  }
  style.addEventListener("change", renderCitation);
  urlInput.addEventListener("input", renderCitation);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      status.textContent = "Citation copied.";
    } catch (_) {
      output.focus();
      output.select();
      status.textContent = "Automatic copying is unavailable. The citation is selected; press Ctrl+C (or ⌘C) to copy.";
    }
  });
  renderCitation();
})();
