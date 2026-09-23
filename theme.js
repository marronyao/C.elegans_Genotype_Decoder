"use strict";
(() => {
  let saved;
  try { saved = localStorage.getItem("decoder-theme"); } catch (_) { /* Storage may be disabled. */ }
  const dark = saved === "dark" || (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
