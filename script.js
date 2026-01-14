const PDF_URL = "./portfolio.pdf";

// Quality vs speed.
// If it feels slow, set 1.8–2.0. If you want sharper, 2.2–2.4.
const RENDER_SCALE = 2.0;

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
  prevBtn.disabled = true;
  nextBtn.disabled = true;
}

function updateUI(pageIndex0) {
  const human = pageIndex0 + 1;
  pageLabel.textContent = `Page ${human} / ${totalPages}`;
  prevBtn.disabled = human <= 1;
  nextBtn.disabled = human >= totalPages;
}

async function renderInto(pdfDoc, containerDiv, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  containerDiv.innerHTML = "";
  containerDiv.appendChild(canvas);
}

async function init() {
  try {
    errorBox.hidden = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    pageLabel.textContent = "Loading…";

    // Sanity check (fast fail if path/case wrong)
    const res = await fetch(PDF_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        `Could not fetch ${PDF_URL} (HTTP ${res.status}).\n` +
        `Confirm this opens: your-site-url/portfolio.pdf\n` +
        `Check filename/case exactly: portfolio.pdf`
      );
    }

    if (!window.pdfjsLib) throw new Error("PDF.js failed to load.");
    if (!window.St || !St.PageFlip) throw new Error("PageFlip failed to load.");

    const pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
    totalPages = pdfDoc.numPages;

    // Create placeholder page divs so PageFlip can initialize immediately
    const pageDivs = Array.from({ length: totalPages }, () => {
      const d = document.createElement("div");
      d.className = "page";
      return d;
    });

    // Init flipbook fast
    pageFlip = new St.PageFlip(bookEl, {
      width: 720,
      height: 960,
      size: "fixed",     // avoids weird stretch
      autoSize: true,    // fits inside container
      showCover: true,   // closed-book feel at first/last
      maxShadowOpacity: 0.25,
      flippingTime: 700,
      swipeDistance: 20,
      mobileScrollSupport: false,
      useMouseEvents: true
    });

    pageFlip.loadFromHTML(pageDivs);

    // Render just enough pages for immediate use (cover + first spread)
    await renderInto(pdfDoc, pageDivs[0], 1);
    if (totalPages >= 2) await renderInto(pdfDoc, pageDivs[1], 2);
    if (totalPages >= 3) await renderInto(pdfDoc, pageDivs[2], 3);

    // Now enable UI
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

    // Background render remaining pages quietly
    (async () => {
      for (let i = 3; i < totalPages; i++) {
        try {
          await renderInto(pdfDoc, pageDivs[i], i + 1);
          // Update layout after each render (safe)
          try { pageFlip.update(); } catch (_) {}
        } catch (e) {
          console.warn("Render failed for page", i + 1, e);
        }
      }
    })();

  } catch (err) {
    console.error(err);
    showError(String(err?.message || err));
  }
}

init();
