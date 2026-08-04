(function () {
  "use strict";
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!finePointer.matches) return;
  const script = document.currentScript;
  const normalSrc = new URL("assets/images/cursor-brush.png", script.src).href;
  const pressedSrc = new URL("assets/images/cursor-brush-click.png", script.src).href;
  const cursor = document.createElement("img");
  cursor.className = "paint-cursor";
  cursor.src = normalSrc;
  cursor.alt = "";
  cursor.setAttribute("aria-hidden", "true");
  document.documentElement.classList.add("paint-cursor-ready");
  const mount = () => document.body.appendChild(cursor);
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount, { once: true });
  window.addEventListener("pointermove", (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add("is-visible");
  }, { passive: true });
  window.addEventListener("pointerdown", () => {
    cursor.src = pressedSrc;
    cursor.classList.add("is-pressed");
  }, { passive: true });
  const release = () => {
    cursor.src = normalSrc;
    cursor.classList.remove("is-pressed");
  };
  window.addEventListener("pointerup", release, { passive: true });
  window.addEventListener("pointercancel", release, { passive: true });
  document.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));
})();
