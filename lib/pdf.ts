import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import { ResearchResult } from './types';

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const BRAND = rgb(0.486, 0.227, 0.929); // #7c3aed
const DARK = rgb(0.12, 0.12, 0.16);
const GRAY = rgb(0.4, 0.4, 0.45);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generatePdfReport(result: ResearchResult): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawText = (
    text: string,
    size: number,
    options: { font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}
  ) => {
    const f = options.font || font;
    const color = options.color || DARK;
    const lines = wrapText(text, f, size, contentWidth);
    for (const line of lines) {
      ensureSpace(size + 6);
      page.drawText(line, { x: MARGIN, y, size, font: f, color });
      y -= size + 6;
    }
    y -= options.gap ?? 4;
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(30);
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: contentWidth,
      height: 20,
      color: rgb(0.965, 0.957, 1)
    });
    page.drawText(title, { x: MARGIN + 6, y: y, size: 12, font: bold, color: BRAND });
    y -= 30;
  };

  const drawBullets = (items: string[]) => {
    if (!items.length) {
      drawText('Not available.', 10, { color: GRAY });
      return;
    }
    for (const item of items) {
      const lines = wrapText(item, font, 10, contentWidth - 14);
      lines.forEach((line, i) => {
        ensureSpace(16);
        page.drawText(i === 0 ? `•  ${line}` : `   ${line}`, {
          x: MARGIN,
          y,
          size: 10,
          font,
          color: DARK
        });
        y -= 15;
      });
    }
    y -= 6;
  };

  // ---------- Header ----------
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 90, width: PAGE_WIDTH, height: 90, color: BRAND });
  page.drawText('Company Research Report', {
    x: MARGIN,
    y: PAGE_HEIGHT - 45,
    size: 22,
    font: bold,
    color: rgb(1, 1, 1)
  });
  page.drawText(result.companyInfo.companyName, {
    x: MARGIN,
    y: PAGE_HEIGHT - 68,
    size: 13,
    font,
    color: rgb(0.95, 0.93, 1)
  });
  y = PAGE_HEIGHT - 120;
  drawText(`Generated: ${new Date(result.generatedAt).toLocaleString()}  |  AI model: ${result.model}`, 9, {
    color: GRAY,
    gap: 14
  });

  // ---------- Company Information ----------
  drawSectionHeader('Company Information');
  drawText(`Website: ${result.companyInfo.website}`, 10.5, { font: bold, gap: 2 });
  drawText(`Phone: ${result.companyInfo.phone || 'Not available'}`, 10.5, { gap: 2 });
  drawText(`Address: ${result.companyInfo.address || 'Not available'}`, 10.5, { gap: 10 });
  drawText('Summary', 11, { font: bold, gap: 2 });
  drawText(result.companyInfo.summary, 10.5, { gap: 10 });

  // ---------- Products / Services ----------
  drawSectionHeader('Products / Services');
  drawBullets(result.companyInfo.productsServices);

  // ---------- Pain Points ----------
  drawSectionHeader('AI-Generated Pain Points');
  drawBullets(result.companyInfo.painPoints);

  // ---------- Competitors ----------
  drawSectionHeader('Competitor Analysis');
  if (!result.competitors.length) {
    drawText('No competitors identified.', 10, { color: GRAY });
  } else {
    for (const c of result.competitors) {
      ensureSpace(30);
      drawText(`${c.name}`, 10.5, { font: bold, gap: 1 });
      drawText(`${c.website}${c.reason ? '  —  ' + c.reason : ''}`, 9.5, { color: GRAY, gap: 8 });
    }
  }

  // ---------- Footer note ----------
  drawSectionHeader('Sources');
  drawText(
    `This report was compiled from ${result.crawledPageCount} crawled website page(s) and public search results via Serper.dev, analyzed with ${result.model} via OpenRouter.`,
    9,
    { color: GRAY }
  );

  return doc.save();
}
