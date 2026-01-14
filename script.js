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

    const res = await fetch(PDF_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`PDF fetch failed: HTTP ${res.status}`);

    const pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
    totalPages = pdfDoc.numPages;

    // Prepare empty page divs (so PageFlip can initialize fast)
    const pages = Array.from({ length: totalPages }, () => {
      const d = document.createElement("div");
      d.className = "page";
      return d;
    });

    if (!window.St || !St.PageFlip) throw new Error("PageFlip failed to load.");

    pageFlip = new St.PageFlip(bookEl, {
      width: 720,
      height: 960,
      size: "fixed",
      autoSize: true,
      maxShadowOpacity: 0.25,
      showCover: true,
      useMouseEvents: true,
      mobileScrollSupport: false,
      flippingTime: 700,
      swipeDistance: 20
    });

    pageFlip.loadFromHTML(pages);

    // Render function that fills a placeholder page div
    const renderInto = async (i) => {
      const pageNum = i + 1;
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { alpha: false });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Replace content
      pages[i].innerHTML = "";
      pages[i].appendChild(canvas);

      // Let PageFlip recalc sizes
      try { pageFlip.update(); } catch (_) {}
    };

    // Render just enough to display immediately (cover + first spread)
    await renderInto(0);
    if (totalPages > 1) await renderInto(1);
    if (totalPages > 2) await renderInto(2);

    // Now enable controls and show page count
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

    // Background render the rest (no UI spam)
    (async () => {
      for (let i = 3; i < totalPages; i++) {
        try {
          // Render progressively in idle time
          await renderInto(i);
        } catch (e) {
          console.warn("Render failed page", i + 1, e);
        }
      }
    })();

  } catch (err) {
    console.error(err);
    showError(String(err?.message || err));
  }
}
