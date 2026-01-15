const PDF_URL = "./portfolio.pdf";

/**
 * Speed vs sharpness.
 * If you want faster load, lower to 1.6–1.8.
 * If you want sharper (slower), raise to 2.0.
 */
const RENDER_SCALE = 1.8;

const bookEl = document.getElementById("book");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageLabel = document.getElementById("pageLabel");
const loadingEl = document.getElementById("loading");
const errorBox = document.getElementById("errorBox");

let pageFlip = null;
let totalPages = 0;

function showError(msg) {
  errorBox.hidden = false;
  errorBox.textContent = msg;
  loadingEl.style.display = "none";
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  pageLabel.textContent = "Failed to load";
}

function updateUI(pageIndex0) {
  const human = pageIndex0 + 1;
  pageLabel.textContent = `Page ${human} / ${totalPages}`;
  prevBtn.disabled = human <= 1;
  nextBtn.disabled = human >= totalPages;
}

async function renderPageToDiv(pdfDoc, pageNum, div) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  div.innerHTML = "";
  div.appendChild(canvas);
}

/**
 * We render all pages first (no countdown, just a loading overlay),
 * then initialize PageFlip with stable sizing.
 * This avoids the hover-corner “glitch” caused by mode switching/empty pages.
 */
async function init() {
  try {
    errorBox.hidden = true;
    loadingEl.style.display = "grid";
    pageLabel.textContent = "";
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    // Quick check: PDF must be reachable from GH Pages
    const res = await fetch(PDF_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        `Could not fetch ${PDF_URL} (HTTP ${res.status}).\n` +
        `Confirm this opens: your-site-url/portfolio.pdf\n` +
        `Check exact filename/case: portfolio.pdf`
      );
    }

    if (!window.pdfjsLib) throw new Error("PDF.js failed to load.");
    if (!window.St || !St.PageFlip) throw new Error("PageFlip failed to load.");

    const pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
    totalPages = pdfDoc.numPages;

    // Create page divs
    const pageDivs = Array.from({ length: totalPages }, () => {
      const d = document.createElement("div");
      d.className = "page";
      return d;
    });

    // Render all pages (quietly)
    for (let i = 0; i < totalPages; i++) {
      // no “Rendering 6/30” spam — just keep overlay
      // eslint-disable-next-line no-await-in-loop
      await renderPageToDiv(pdfDoc, i + 1, pageDivs[i]);
    }

    // Initialize flipbook
    pageFlip = new St.PageFlip(bookEl, {
      // These are SINGLE-PAGE dimensions; the spread is handled by the library.
      width: 1400,
      height: 990,

      size: "stretch",
      minWidth: 350,
      maxWidth: 2200,
      minHeight: 450,
      maxHeight: 3000,

      showCover: true,      // cover single page at start/end (closed book feel)
      usePortrait: false,   // IMPORTANT: never switch into single-page mode mid-book
      autoSize: true,

      maxShadowOpacity: 0.22,
      flippingTime: 650,
      mobileScrollSupport: false,
      useMouseEvents: true
    });

    pageFlip.loadFromHTML(pageDivs);

    // Events + controls
    pageFlip.on("flip", (e) => updateUI(e.data));
    updateUI(0);

    prevBtn.onclick = () => pageFlip.flipPrev();
    nextBtn.onclick = () => pageFlip.flipNext();

    window.addEventListener("keydown", (ev) => {
      if (!pageFlip) return;
      if (ev.key === "ArrowLeft") pageFlip.flipPrev();
      if (ev.key === "ArrowRight") pageFlip.flipNext();
    });

    window.addEventListener("resize", () => {
      try { pageFlip.update(); } catch (_) {}
    });

    // Done
    loadingEl.style.display = "none";

  } catch (err) {
    console.error(err);
    showError(String(err?.message || err));
  }
}

init();
