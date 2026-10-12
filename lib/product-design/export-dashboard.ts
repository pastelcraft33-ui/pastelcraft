import { toJpeg } from "html-to-image";

export async function createDashboardJpeg(dashboard: HTMLElement): Promise<string> {
  await document.fonts.ready;
  const copy = dashboard.cloneNode(true) as HTMLElement;
  // 별도 사본을 넓게 배치하여 화면 크기와 가로 스크롤에 관계없이 내용을 저장합니다.
  Object.assign(copy.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: "1480px",
    maxWidth: "none",
    height: "auto",
    padding: "24px",
    margin: "0",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
    pointerEvents: "none",
  });
  copy.setAttribute("aria-hidden", "true");
  copy.querySelectorAll(".product-design-dashboard-interactive, .product-design-designer-heading a, .product-design-print-button").forEach((element) => element.remove());
  const heading = copy.querySelector<HTMLElement>(".product-design-print-heading");
  if (heading) {
    heading.classList.remove("hidden");
    Object.assign(heading.style, { display: "block", borderBottom: "2px solid #2f6b4a", paddingBottom: "16px" });
    const title = heading.querySelector<HTMLElement>("h1");
    if (title) Object.assign(title.style, { fontSize: "28px", fontWeight: "900", marginTop: "8px" });
  }
  copy.querySelectorAll<HTMLElement>(".product-design-designer-grid").forEach((grid) => {
    grid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  });
  const cards = copy.querySelector<HTMLElement>(".product-design-summary-cards > div");
  if (cards) {
    cards.style.gridTemplateColumns = `repeat(${cards.children.length}, minmax(0, 1fr))`;
    for (const card of cards.children) (card as HTMLElement).style.gridColumn = "auto";
  }
  copy.querySelectorAll<HTMLElement>("[class*='overflow-x-auto']").forEach((element) => {
    element.style.overflow = "visible";
  });

  document.body.appendChild(copy);
  try {
    await Promise.all([...copy.querySelectorAll("img")].map(async (img) => {
      img.loading = "eager";
      await img.decode();
    }));
    const width = copy.scrollWidth;
    const height = copy.scrollHeight;
    return await toJpeg(copy, {
      backgroundColor: "#ffffff",
      quality: 0.95,
      width,
      height,
      pixelRatio: Math.min(2, 16384 / Math.max(width, height)),
      preferredFontFormat: "woff2",
      // 복제할 때 화면 바깥 배치 좌표를 초기화해야 이미지가 비지 않습니다.
      style: { position: "static", left: "auto", top: "auto" },
    });
  } finally {
    copy.remove();
  }
}
