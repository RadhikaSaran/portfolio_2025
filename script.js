const PDF_URL = "./portfolio.pdf";
const RENDER_SCALE = 2.2;

const bookEl = document.getElementById("book");
const pageLabel = document.getElementById("pageLabel");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const errorBox = document.getElementById("errorBox");

let pageFlip = null;
let totalPages = 0;

function showError(msg) {
  errorBox.hidden = false;
  errorBox.textContent = msg;
  pageLabel.textContent = "Failed to load";
}

function updateUI(pageIndex0) {
  const human = pageIndex0 + 1;
  pageLabel.textContent = `Page ${human} / ${totalPages}`;
  prevBtn.disabled = human <= 1;
  nextBtn.disabled = human >= totalPages;
}

async function renderPage(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const pageDiv = document.createElement("div");
  pageDiv.className = "page";
  pageDiv.appendChild(canvas);
  return pageDiv;
}

async function init() {
  try {
    errorBox.hidden = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    pageLabel.textContent = "Loading…";

    // If PDF opens in browser, fetch should also be OK — but keep this anyway.
    const res = await fetch(PDF_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`PDF fetch failed: HTTP ${res.status}`);

    const pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
    totalPages = pdfDoc.numPages;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pageLabel.textContent = `Rendering ${i} / ${totalPages}…`;
      // eslint-disable-next-line no-await-in-loop
      pages.push(await renderPage(pdfDoc, i));
    }

    if (!window.St || !St.PageFlip) throw new Error("PageFlip failed to load.");

    pageFlip = new St.PageFlip(bookEl, {
      width: 600,
      height: 780,
      size: "stretch",
      minWidth: 320,
      maxWidth: 2400,
      minHeight: 420,
      maxHeight: 3000,
      showCover: true,
      maxShadowOpacity: 0.2,
      mobileScrollSupport: false,
      useMouseEvents: true,
    });

    pageFlip.loadFromHTML(pages);
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

  } catch (err) {
    console.error(err);
    showError(String(err?.message || err));
  }
}

init();
