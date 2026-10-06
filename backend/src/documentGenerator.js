import { 
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, 
    Header, Footer, PageNumber, ImageRun, HorizontalPositionRelativeFrom, 
    VerticalPositionRelativeFrom, BorderStyle, WidthType, Table, TableRow, TableCell, TextWrappingType
} from 'docx';
import PdfPrinter from 'pdfmake';
import { marked } from 'marked';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// UTILITIES & ASSET HANDLING
// ==========================================
const ptToTwip = (pt) => Math.round(pt * 20);
const inchToEmu = (inch) => Math.round(inch * 914400);
const ptToEmu = (pt) => Math.round(pt * 12700);

// Parse Base64 Data URL or raw base64 to Buffer safely
function bufferFromDataUrl(dataString) {
    if (!dataString || typeof dataString !== 'string') return null;
    try {
        const base64Index = dataString.indexOf(';base64,');
        if (base64Index !== -1) {
            return Buffer.from(dataString.substring(base64Index + 8), 'base64');
        }
        return Buffer.from(dataString, 'base64');
    } catch (e) {
        console.warn("[WARNING] Failed to parse image data buffer:", e);
        return null;
    }
}

// Validate PNG and JPEG image buffers to prevent corrupt/unsupported images from crashing PDFKit/Docx
function isValidPdfImageData(dataString) {
    if (!dataString || typeof dataString !== 'string') return false;
    try {
        const buf = bufferFromDataUrl(dataString);
        if (!buf || buf.length < 4) return false;
        // PNG signature: 89 50 4E 47
        const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
        // JPEG signature: FF D8 FF
        const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
        return isPng || isJpeg;
    } catch {
        return false;
    }
}

// Calculate standard page coordinates (612 x 792 pt Letter size for DOCX, 595.28 x 841.89 pt A4 for PDF)
export function calculateImageOffsets(img, widthPt, heightPt, cust, pageWidth = 612, pageHeight = 792) {
    const mTop = parseInt(cust?.marginTop, 10) || 72;
    const mBottom = parseInt(cust?.marginBottom, 10) || 72;
    const mLeft = parseInt(cust?.marginLeft, 10) || 72;
    const mRight = parseInt(cust?.marginRight, 10) || 72;

    const pos = (img?.position || 'top-left').toLowerCase();
    const xUser = parseInt(img?.xOffset, 10) || 0;
    const yUser = parseInt(img?.yOffset, 10) || 0;

    let x = mLeft;
    let y = mTop;

    switch (pos) {
        case 'top-left':
            x = mLeft + xUser;
            y = mTop + yUser;
            break;
        case 'top-center':
            x = Math.round((pageWidth - widthPt) / 2) + xUser;
            y = mTop + yUser;
            break;
        case 'top-right':
            x = pageWidth - mRight - widthPt + xUser;
            y = mTop + yUser;
            break;
        case 'center':
            x = Math.round((pageWidth - widthPt) / 2) + xUser;
            y = Math.round((pageHeight - heightPt) / 2) + yUser;
            break;
        case 'bottom-left':
            x = mLeft + xUser;
            y = pageHeight - mBottom - heightPt + yUser;
            break;
        case 'bottom-center':
            x = Math.round((pageWidth - widthPt) / 2) + xUser;
            y = pageHeight - mBottom - heightPt + yUser;
            break;
        case 'bottom-right':
            x = pageWidth - mRight - widthPt + xUser;
            y = pageHeight - mBottom - heightPt + yUser;
            break;
        case 'custom':
            x = (img?.xOffset !== undefined ? parseInt(img.xOffset, 10) || 0 : mLeft);
            y = (img?.yOffset !== undefined ? parseInt(img.yOffset, 10) || 0 : mTop);
            break;
        default:
            x = mLeft + xUser;
            y = mTop + yUser;
    }

    x = Math.max(0, Math.min(pageWidth - 20, x));
    y = Math.max(0, Math.min(pageHeight - 20, y));

    return {
        xPt: x,
        yPt: y,
        xOffsetEMU: ptToEmu(x),
        yOffsetEMU: ptToEmu(y)
    };
}

// Bulletproof Vercel Path Resolution (Case-Insensitive Scanner)
function getAssetPath(filename) {
    const directories = [
        path.join(__dirname, 'assets'),
        path.join(process.cwd(), 'src', 'assets'),
        path.join(process.cwd(), 'assets'),
        path.join('/var/task', 'src', 'assets') // Vercel Serverless hardcoded fallback
    ];

    const targetLower = filename.toLowerCase();

    for (let dir of directories) {
        try {
            if (fs.existsSync(dir)) {
                // Read the directory to allow case-insensitive matching (Crucial for Windows to Linux deployment)
                const files = fs.readdirSync(dir);
                const match = files.find(f => f.toLowerCase() === targetLower);
                if (match) {
                    return path.join(dir, match);
                }
            }
        } catch (e) {
            // Ignore read errors for inaccessible paths
        }
    }
    return null;
}

// Returns the file Buffer (required for DOCX images)
function getAssetBuffer(filename) {
    const assetPath = getAssetPath(filename);
    if (assetPath) {
        return fs.readFileSync(assetPath);
    }
    console.warn(`[WARNING] Missing asset on disk: ${filename}`);
    return null;
}

// Returns Base64 string (required for PDFMake images)
function getAssetBase64(filename) {
    const buffer = getAssetBuffer(filename);
    return buffer ? `data:image/png;base64,${buffer.toString('base64')}` : null;
}

function getPngDimensions(buffer) {
    if (buffer && buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    return null;
}

function hexStrip(hexStr) {
    return (hexStr || "000000").toString().replace('#', '');
}

// ==========================================
// AST PARSERS (MARKDOWN -> DOCX / PDF)
// ==========================================
function processInlineDocxTokens(tokens, baseFormat) {
    const runs = [];
    tokens.forEach(t => {
        const format = { font: baseFormat.font, size: baseFormat.size, color: baseFormat.color };
        if (t.type === 'strong') {
            runs.push(new TextRun({ text: t.text, bold: true, ...format }));
        } else if (t.type === 'em') {
            runs.push(new TextRun({ text: t.text, italics: true, ...format }));
        } else if (t.type === 'link') {
            runs.push(new TextRun({ text: t.text, color: "2563eb", ...format }));
        } else {
            runs.push(new TextRun({ text: t.raw || t.text, ...format }));
        }
    });
    return runs;
}

function parseMarkdownToDocx(markdownText, cust, baseFontSize) {
    const tokens = marked.lexer(markdownText);
    const paragraphs = [];
    const baseFormat = { font: cust.font || "Arial", size: baseFontSize * 2, color: hexStrip(cust.textColor) };

    tokens.forEach(token => {
        if (token.type === 'heading') {
            const hLevel = token.depth === 1 ? HeadingLevel.HEADING_1 : (token.depth === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3);
            const sizeMod = token.depth <= 2 ? 4 : 1;
            paragraphs.push(new Paragraph({
                children: [new TextRun({ text: token.text, bold: true, size: (baseFontSize + sizeMod) * 2, font: cust.font, color: baseFormat.color })],
                heading: hLevel,
                spacing: { before: ptToTwip(14), after: ptToTwip(4) }
            }));
        } 
        else if (token.type === 'paragraph') {
            const inlineTokens = marked.lexer(token.text)[0].tokens || [];
            paragraphs.push(new Paragraph({
                children: processInlineDocxTokens(inlineTokens, baseFormat),
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: ptToTwip(6) }
            }));
        }
        else if (token.type === 'list') {
            token.items.forEach(item => {
                const inlineTokens = marked.lexer(item.text)[0].tokens || [];
                paragraphs.push(new Paragraph({
                    children: processInlineDocxTokens(inlineTokens, baseFormat),
                    indent: { left: ptToTwip(28.8) }, // 0.4 inches
                    bullet: token.ordered ? undefined : { level: 0 },
                    numbering: token.ordered ? { reference: "numbered-list", level: 0 } : undefined,
                    spacing: { after: ptToTwip(4) }
                }));
            });
        }
        else if (token.type === 'table') {
            const rows = [];
            rows.push(new TableRow({
                children: token.header.map(cell => new TableCell({
                    children: [new Paragraph({ children: processInlineDocxTokens(cell.tokens, { ...baseFormat, bold: true }) })],
                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                }))
            }));
            token.rows.forEach(row => {
                rows.push(new TableRow({
                    children: row.map(cell => new TableCell({
                        children: [new Paragraph({ children: processInlineDocxTokens(cell.tokens, baseFormat) })],
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    }))
                }));
            });
            paragraphs.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: rows
            }));
            paragraphs.push(new Paragraph({ text: "" }));
        }
    });

    return paragraphs;
}

function parseMarkdownToPdf(markdownText, cust, baseFontSize) {
    const tokens = marked.lexer(markdownText);
    const content = [];

    tokens.forEach(token => {
        if (token.type === 'heading') {
            const sizeMod = token.depth <= 2 ? 4 : 1;
            content.push({ text: token.text, fontSize: baseFontSize + sizeMod, bold: true, margin: [0, 14, 0, 4] });
        } 
        else if (token.type === 'paragraph') {
            const cleanText = token.text.replace(/[*_~`#]/g, '');
            content.push({ text: cleanText, fontSize: baseFontSize, alignment: 'justify', margin: [0, 0, 0, 6] });
        }
        else if (token.type === 'list') {
            const listItems = token.items.map(item => item.text.replace(/[*_~`]/g, ''));
            if (token.ordered) {
                content.push({ ol: listItems, fontSize: baseFontSize, margin: [15, 0, 0, 6] });
            } else {
                content.push({ ul: listItems, fontSize: baseFontSize, margin: [15, 0, 0, 6] });
            }
        }
        else if (token.type === 'table') {
            const body = [];
            body.push(token.header.map(h => ({ text: h.text.replace(/[*_~`]/g, ''), bold: true })));
            token.rows.forEach(row => {
                body.push(row.map(cell => cell.text.replace(/[*_~`]/g, '')));
            });
            content.push({
                table: { headerRows: 1, widths: Array(token.header.length).fill('*'), body: body },
                margin: [0, 5, 0, 15]
            });
        }
    });
    return content;
}

// ==========================================
// 1. DOCX GENERATOR (Pure Node.js)
// ==========================================
export async function generateDocx(title, sections, cust = {}) {
    const docChildren = [];
    const font = cust.font || "Arial";
    const baseFontSize = parseInt(cust.size, 10) || 12;
    const textColor = hexStrip(cust.textColor);

    // --- TITLE ---
    docChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: ptToTwip(12), after: ptToTwip(24) },
        children: [new TextRun({ text: (title || "DOCUMENT").toUpperCase(), bold: true, size: (baseFontSize + 4) * 2, font: font, color: textColor })]
    }));

    // --- SPECIFIC-PAGE USER IMAGES (Anchored to body paragraphs) ---
    const userImages = Array.isArray(cust.images) ? cust.images : [];
    const specificPageImages = userImages.filter(img => img && img.data && img.pageScope === 'specific');

    // Page 1 specific images anchored to the top of body
    const page1Images = specificPageImages.filter(img => {
        const pages = Array.isArray(img.selectedPages) ? img.selectedPages : [1];
        return pages.includes(1) || pages.includes('1');
    });

    const page1ImageRuns = [];
    for (const img of page1Images) {
        const imgBuffer = bufferFromDataUrl(img.data);
        if (imgBuffer && isValidPdfImageData(img.data)) {
            const width = parseInt(img.width, 10) || 120;
            const height = parseInt(img.height, 10) || 60;
            const coords = calculateImageOffsets(img, width, height, cust);

            page1ImageRuns.push(new ImageRun({
                data: imgBuffer,
                transformation: {
                    width: Math.round(width * (96 / 72)),
                    height: Math.round(height * (96 / 72))
                },
                floating: {
                    horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: coords.xOffsetEMU },
                    verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: coords.yOffsetEMU },
                    wrap: { type: TextWrappingType.NONE },
                    behindDocument: false
                }
            }));
        }
    }

    if (page1ImageRuns.length > 0) {
        docChildren.unshift(new Paragraph({
            spacing: { before: 0, after: 0 },
            children: page1ImageRuns
        }));
    }

    // --- TITLE ---
    docChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: ptToTwip(12), after: ptToTwip(24) },
        children: [new TextRun({ text: title.toUpperCase(), bold: true, size: (baseFontSize + 4) * 2, font: font, color: textColor })]
    }));

    // --- SECTIONS ---
    sections.forEach((sec, idx) => {
        const secChildren = [new TextRun({ text: `${idx + 1}. ${sec.heading}`, bold: true, size: (baseFontSize + 2) * 2, font: font, color: textColor })];

        // Specific-page images targeting section (1-based index)
        const targetPage = idx + 1;
        if (targetPage > 1) {
            const pageImages = specificPageImages.filter(img => {
                const pages = Array.isArray(img.selectedPages) ? img.selectedPages : [];
                return pages.includes(targetPage) || pages.includes(String(targetPage));
            });
            for (const img of pageImages) {
                const imgBuffer = bufferFromDataUrl(img.data);
                if (imgBuffer && isValidPdfImageData(img.data)) {
                    const width = parseInt(img.width, 10) || 120;
                    const height = parseInt(img.height, 10) || 60;
                    const coords = calculateImageOffsets(img, width, height, cust);
                    secChildren.push(new ImageRun({
                        data: imgBuffer,
                        transformation: {
                            width: Math.round(width * (96 / 72)),
                            height: Math.round(height * (96 / 72))
                        },
                        floating: {
                            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: coords.xOffsetEMU },
                            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: coords.yOffsetEMU },
                            wrap: { type: TextWrappingType.NONE },
                            behindDocument: false
                        }
                    }));
                }
            }
        }

        docChildren.push(new Paragraph({
            spacing: { before: idx > 0 ? ptToTwip(18) : ptToTwip(4), after: ptToTwip(6) },
            children: secChildren
        }));
        if (sec.content) {
            docChildren.push(...parseMarkdownToDocx(sec.content, cust, baseFontSize));
        }
    });

    // --- HEADER: WATERMARK & ALL-PAGES IMAGES ---
    const headerChildren = [];
    if (cust.header) {
        headerChildren.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: cust.header, color: "646464", font: font, size: (baseFontSize - 2 > 0 ? baseFontSize - 2 : 10) * 2 })]
        }));
    }

    // 1. Separate Watermark: Behind all document content
    if (cust.watermark && cust.watermark.enabled && cust.watermark.data && isValidPdfImageData(cust.watermark.data)) {
        const watermarkBuffer = bufferFromDataUrl(cust.watermark.data);
        if (watermarkBuffer) {
            const wmWidth = parseInt(cust.watermark.width, 10) || 350;
            const wmHeight = parseInt(cust.watermark.height, 10) || 350;
            const wmCoords = calculateImageOffsets(cust.watermark, wmWidth, wmHeight, cust);

            headerChildren.push(new Paragraph({
                children: [
                    new ImageRun({
                        data: watermarkBuffer,
                        transformation: {
                            width: Math.round(wmWidth * (96 / 72)),
                            height: Math.round(wmHeight * (96 / 72))
                        },
                        floating: {
                            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: wmCoords.xOffsetEMU },
                            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: wmCoords.yOffsetEMU },
                            wrap: { type: TextWrappingType.NONE },
                            behindDocument: true
                        }
                    })
                ]
            }));
        }
    }

    // 2. Normal User Images (All Pages Scope: placed in header, behindDocument: false)
    const allPagesImages = userImages.filter(img => img && img.data && (!img.pageScope || img.pageScope === 'all'));
    for (const img of allPagesImages) {
        const imgBuffer = bufferFromDataUrl(img.data);
        if (imgBuffer && isValidPdfImageData(img.data)) {
            const width = parseInt(img.width, 10) || 120;
            const height = parseInt(img.height, 10) || 60;
            const coords = calculateImageOffsets(img, width, height, cust);

            headerChildren.push(new Paragraph({
                children: [
                    new ImageRun({
                        data: imgBuffer,
                        transformation: {
                            width: Math.round(width * (96 / 72)),
                            height: Math.round(height * (96 / 72))
                        },
                        floating: {
                            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: coords.xOffsetEMU },
                            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: coords.yOffsetEMU },
                            wrap: { type: TextWrappingType.NONE },
                            behindDocument: false
                        }
                    })
                ]
            }));
        }
    }

    // --- FOOTER ---
    const footerParagraphs = [];
    const footerFontSize = (baseFontSize - 2 > 0 ? baseFontSize - 2 : 10) * 2;
    
    if (cust.footer) {
        const children = [];
        const tokens = cust.footer.split(/(?=\[PAGE\]|\[TOTAL\])|(?<=\[PAGE\]|\[TOTAL\])/g);
        
        tokens.forEach(token => {
            if (token === '[PAGE]') {
                children.push(new TextRun({ children: [PageNumber.CURRENT], font: font, size: footerFontSize, color: "888888" }));
            } else if (token === '[TOTAL]') {
                children.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], font: font, size: footerFontSize, color: "888888" }));
            } else if (token.length > 0) {
                children.push(new TextRun({ text: token, font: font, size: footerFontSize, color: "888888" }));
            }
        });

        footerParagraphs.push(new Paragraph({ alignment: AlignmentType.CENTER, children }));
    } else {
        footerParagraphs.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "PAGE ", font: font, size: 20, color: "888888" }),
                new TextRun({ children: [PageNumber.CURRENT], font: font, size: 20, color: "888888" })
            ]
        }));
    }

    // --- COMPILE DOCUMENT ---
    const doc = new Document({
        background: cust.bgColor && cust.bgColor.toLowerCase() !== '#ffffff' ? { color: hexStrip(cust.bgColor) } : undefined,
        numbering: {
            config: [{
                reference: "numbered-list",
                levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }]
            }]
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: ptToTwip(cust.marginTop || 72),
                        bottom: ptToTwip(cust.marginBottom || 72),
                        left: ptToTwip(cust.marginLeft || 72),
                        right: ptToTwip(cust.marginRight || 72),
                    },
                },
            },
            headers: { default: new Header({ children: headerChildren.length > 0 ? headerChildren : [new Paragraph("")] }) },
            footers: { default: new Footer({ children: footerParagraphs }) },
            children: docChildren
        }]
    });

    return await Packer.toBuffer(doc);
}

// ==========================================
// 2. PDF GENERATOR (Node.js fallback for Vercel)
// ==========================================
export async function generatePdf(title, sections, cust = {}) {
    return new Promise((resolve, reject) => {
        const content = [];
        const baseFontSize = parseInt(cust.size, 10) || 12;
        const footerFontSize = (baseFontSize - 2 > 0) ? baseFontSize - 2 : 10;

        content.push({ text: (title || "DOCUMENT").toUpperCase(), alignment: 'center', fontSize: baseFontSize + 4, bold: true, margin: [0, 12, 0, 24] });

        sections.forEach((sec, idx) => {
            content.push({ text: `${idx + 1}. ${sec.heading}`, fontSize: baseFontSize + 2, bold: true, margin: [0, idx > 0 ? 18 : 4, 0, 6] });
            if (sec.content) {
                content.push(...parseMarkdownToPdf(sec.content, cust, baseFontSize));
            }
        });

        // A4 page dimensions in points (595.28 x 841.89)
        const pdfPageWidth = 595.28;
        const pdfPageHeight = 841.89;
        const userImages = Array.isArray(cust?.images) ? cust.images : [];

        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [cust.marginLeft || 72, cust.marginTop || 72, cust.marginRight || 72, cust.marginBottom || 72],
            background: function(currentPage) {
                const bg = [];
                if (cust.bgColor && cust.bgColor.toLowerCase() !== '#ffffff') {
                    bg.push({
                        canvas: [{
                            type: 'rect',
                            x: 0, y: 0, w: pdfPageWidth, h: pdfPageHeight,
                            color: cust.bgColor
                        }]
                    });
                }

                // User watermark in PDF (Layer 0: background layer strictly behind all document content, text, and normal images)
                if (cust.watermark && cust.watermark.enabled && cust.watermark.data && isValidPdfImageData(cust.watermark.data)) {
                    const wmWidth = parseInt(cust.watermark.width, 10) || 350;
                    const wmHeight = parseInt(cust.watermark.height, 10) || 350;
                    const wmX = Math.round((pdfPageWidth - wmWidth) / 2) + (parseInt(cust.watermark.xOffset, 10) || 0);
                    const wmY = Math.round((pdfPageHeight - wmHeight) / 2) + (parseInt(cust.watermark.yOffset, 10) || 0);
                    const wmSrc = cust.watermark.data.startsWith('data:') ? cust.watermark.data : bufferFromDataUrl(cust.watermark.data);
                    bg.push({
                        image: wmSrc,
                        width: wmWidth,
                        height: wmHeight,
                        absolutePosition: { x: wmX, y: wmY },
                        opacity: cust.watermark.opacity !== undefined ? parseFloat(cust.watermark.opacity) : 0.15
                    });
                }

                return bg;
            },
            header: function(currentPage, pageCount) {
                const headerElements = [];
                if (cust.header) {
                    headerElements.push({
                        text: cust.header,
                        alignment: 'right',
                        margin: [20, 20],
                        color: '#888888',
                        fontSize: footerFontSize
                    });
                }

                // Render normal user-added images on applicable pages
                // In PDFMake, elements in header are drawn on layer 2 (above watermark layer 0 and content layer 1)
                for (const img of userImages) {
                    if (!img || !img.data || !isValidPdfImageData(img.data)) continue;

                    const applies = (!img.pageScope || img.pageScope === 'all') ||
                        (Array.isArray(img.selectedPages) && (img.selectedPages.includes(currentPage) || img.selectedPages.includes(String(currentPage))));

                    if (applies) {
                        const imgWidth = parseInt(img.width, 10) || 120;
                        const imgHeight = parseInt(img.height, 10) || 60;
                        const coords = calculateImageOffsets(img, imgWidth, imgHeight, cust, pdfPageWidth, pdfPageHeight);
                        const imgSrc = img.data.startsWith('data:') ? img.data : bufferFromDataUrl(img.data);

                        headerElements.push({
                            image: imgSrc,
                            width: imgWidth,
                            height: imgHeight,
                            absolutePosition: { x: coords.xPt, y: coords.yPt }
                        });
                    }
                }

                return headerElements;
            },
            footer: function(currentPage, pageCount) {
                const fText = cust.footer ? cust.footer.replace('[PAGE]', currentPage).replace('[TOTAL]', pageCount) : `PAGE ${currentPage}`;
                return { text: fText, alignment: 'center', margin: [0, 20], color: '#888888', fontSize: footerFontSize };
            }
        };

        try {
            const userFont = cust.font || 'Arial';
            const fontKey = userFont.replace(/\s+/g, ''); 
            let activeFont = 'Helvetica';

            const fonts = {
                Helvetica: {
                    normal: 'Helvetica',
                    bold: 'Helvetica-Bold',
                    italics: 'Helvetica-Oblique',
                    bolditalics: 'Helvetica-BoldOblique'
                }
            };

            const normalPath = getAssetPath(`${fontKey}-Regular.ttf`);
            const boldPath = getAssetPath(`${fontKey}-Bold.ttf`);
            const italicsPath = getAssetPath(`${fontKey}-Italic.ttf`);
            const boldItalicsPath = getAssetPath(`${fontKey}-BoldItalic.ttf`);

            if (normalPath && boldPath && italicsPath && boldItalicsPath) {
                fonts[fontKey] = {
                    normal: normalPath,
                    bold: boldPath,
                    italics: italicsPath,
                    bolditalics: boldItalicsPath
                };
                activeFont = fontKey;
            } else if (userFont === 'Times New Roman') {
                fonts['TimesNewRoman'] = {
                    normal: 'Times-Roman',
                    bold: 'Times-Bold',
                    italics: 'Times-Italic',
                    bolditalics: 'Times-BoldItalic'
                };
                activeFont = 'TimesNewRoman';
            } else {
                console.warn(`[WARNING] Missing TTF fonts for ${userFont}. Using Standard PDF Fallback.`);
            }

            docDefinition.defaultStyle = { 
                font: activeFont, 
                fontSize: baseFontSize, 
                color: cust.textColor || '#000000' 
            };

            docDefinition.content = content;

            const printer = new PdfPrinter(fonts);
            const pdfDoc = printer.createPdfKitDocument(docDefinition);
            const chunks = [];
            pdfDoc.on('data', chunk => chunks.push(chunk));
            pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
            pdfDoc.on('error', reject);
            pdfDoc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// ==========================================
// 3. MARKDOWN GENERATOR
// ==========================================
export async function generateMd(title, sections, cust = {}) {
    let md = `<style>\nbody {\n  font-family: '${cust.font || 'Arial'}', sans-serif;\n  background-color: ${cust.bgColor || '#ffffff'};\n  color: ${cust.textColor || '#000000'};\n}\n</style>\n\n`;
    
    if (cust.header) md += `<div align='right'><b>${cust.header}</b></div>\n`;
    md += `<h1 align='center'>${(title || "DOCUMENT").toUpperCase()}</h1>\n\n`;
    sections.forEach((sec, i) => {
        md += `## ${i+1}. ${sec.heading}\n\n${sec.content || ''}\n\n`;
    });
    
    if (cust.footer) md += `<hr>\n<div align='center'><i>${cust.footer.replace('[PAGE]', '1')}</i></div>\n`;
    
    return Buffer.from(md, 'utf-8');
}