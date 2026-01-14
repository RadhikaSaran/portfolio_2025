// ====== CONFIG ======
const PDF_URL = "portfolio.pdf";

// Quality: higher = sharper, heavier.
// 2.0 is a good balance; try 2.5 if your PDF is light.
const RENDER_SCALE = 2.2;

// ====== DOM ======
const bookEl = document.getElementById("book");
const pageLabel = document.getElementById("pageLabel");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// ====== PDF.js setup ======
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.js";

let pageFlip = null;
let totalPages = 0;

// Helpful: show status + keep buttons sane
function updateUI(currentPageIndexZeroBased) {
  const humanPage = currentPageIndexZeroBased + 1;
  pageLabel.textContent = `Page ${humanPage} / ${totalPages}`;
  prevBtn.disabled = humanPage <= 1;
  nextBtn.disabled = humanPage >= totalPages;
}

function clearBook() {
  while (bookEl.firstChild) bookEl.removeChild(bookEl.firstChild);
}

// Render one PDF page into a canvas and return a page element
async function renderPdfPageToElement(pdfDoc, pageNumber) {
  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  // Use devicePixelRatio carefully: PDF.js already scales via viewport.
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise;

  const pageDiv = document.createElement("div");
  pageDiv.className = "page";
  pageDiv.appendChild(canvas);

  return pageDiv;
}

async function buildFlipbook() {
  pageLabel.textContent = "Loading PDF…";
  prevBtn.disabled = true;
  nextBtn.disabled = true;

  clearBook();

  const loadingTask = pdfjsLib.getDocument({
    url: PDF_URL,
    // You can add these if your PDF is large; leave default for now:
    // disableAutoFetch: false,
    // disableStream: false,
  });

  const pdfDoc = await loadingTask.promise;
  totalPages = pdfDoc.numPages;

  pageLabel.textContent = `Rendering ${totalPages} pages…`;

  // Render all pages up-front (simplest, most reliable)
  // If your PDF is huge (50+ pages), we can optimize later.
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pageLabel.textContent = `Rendering page ${i} / ${totalPages}…`;
    // eslint-disable-next-line no-await-in-loop
    pages.push(await renderPdfPageToElement(pdfDoc, i));
  }

  // Create PageFlip instance
  pageFlip = new St.PageFlip(bookEl, {
    width: 550,          // base size (will auto-scale)
    height: 700,
    size: "stretch",     // fit container
    minWidth: 320,
    maxWidth: 2000,
    minHeight: 420,
    maxHeight: 2600,
    maxShadowOpacity: 0.25,
    showCover: true,
    mobileScrollSupport: false,
    useMouseEvents: true,
  });

  pageFlip.loadFromHTML(pages);

  // Events
  pageFlip.on("flip", (e) => {
    updateUI(e.data); // e.data is zero-based page index
  });

  // Initial UI
  updateUI(0);

  // Buttons
  prevBtn.onclick = () => pageFlip.flipPrev();
  nextBtn.onclick = () => pageFlip.flipNext();

  // Keyboard navigation
  window.addEventListener("keydown", (ev) => {
    if (!pageFlip) return;
    if (ev.key === "ArrowLeft") pageFlip.flipPrev();
    if (ev.key === "ArrowRight") pageFlip.flipNext();
  });

  // Resize handling
  window.addEventListener("resize", () => {
    // PageFlip recalculates internally; "update" helps after container changes
    try { pageFlip.update(); } catch (_) {}
  });

  pageLabel.textContent = `Page 1 / ${totalPages}`;
}

buildFlipbook().catch((err) => {
  console.error(err);
  pageLabel.textContent =
    "Could not load the PDF. Check that portfolio.pdf is in the repo root and GitHub Pages is enabled.";
});
