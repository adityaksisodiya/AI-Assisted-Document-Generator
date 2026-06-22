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

// Returns the actual file path string (required for PDFMake Fonts)
function getAssetPath(filename) {
    const paths = [
        path.join(__dirname, 'assets', filename),
        path.join(process.cwd(), 'src', 'assets', filename),
        path.join(process.cwd(), 'backend', 'src', 'assets', filename),
        path.join(process.cwd(), 'assets', filename)
    ];
    for (let p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

// Returns the file Buffer (required for DOCX images)
function getAssetBuffer(filename) {
    const assetPath = getAssetPath(filename);
    if (assetPath) {
        return fs.readFileSync(assetPath);
    }
    console.warn(`[WARNING] Missing asset: ${filename}`);
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
export async function generateDocx(title, sections, cust) {
    const docChildren = [];
    const font = cust.font || "Arial";
    const baseFontSize = parseInt(cust.size, 10) || 12;
    const textColor = hexStrip(cust.textColor);

    // --- FULL BLEED TOP BANNER ---
    const topImageBuffer = getAssetBuffer('top.png');
    let imgHeightPt = 0;
    if (topImageBuffer) {
        const dims = getPngDimensions(topImageBuffer);
        const aspect = dims ? dims.height / dims.width : 0.15;
        const imgHeightIn = 8.5 * aspect;
        imgHeightPt = imgHeightIn * 72;
        
        docChildren.push(new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
                new ImageRun({
                    data: topImageBuffer,
                    type: 'png',
                    transformation: { width: Math.round(8.5 * 96), height: Math.round(imgHeightIn * 96) },
                    floating: {
                        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
                        wrap: { type: TextWrappingType.NONE },
                        behindDocument: true
                    }
                })
            ]
        }));
    }

    // --- ADDRESS BLOCK & DIVIDER ---
    const topMarginPt = parseInt(cust.marginTop, 10) || 72;
    const addressSpace = Math.max(0, imgHeightPt - topMarginPt + 4);

    docChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: ptToTwip(addressSpace), after: ptToTwip(4) },
        children: [
            new TextRun({ text: "OFFICE NO. 12, 2ND FLOOR, NO.40 DLF INDUSTRIAL AREA, KIRTI NAGAR, DELHI 110015.", bold: true, size: 9 * 2, font: font, color: textColor }),
            new TextRun({ text: "Contact No. : ", bold: true, size: 9 * 2, font: font, color: textColor, break: 1 }), // Force Line Break
            new TextRun({ text: "+91 99871 59986", bold: true, size: 9 * 2, font: font, color: "2563eb" }),
            new TextRun({ text: " | Email : ", bold: true, size: 9 * 2, font: font, color: textColor }),
            new TextRun({ text: "info@sgwebapp.com", bold: true, size: 9 * 2, font: font, color: "2563eb" }),
            new TextRun({ text: " | Website : ", bold: true, size: 9 * 2, font: font, color: textColor }),
            new TextRun({ text: "www.sgwebapp.com", bold: true, size: 9 * 2, font: font, color: "2563eb" })
        ]
    }));

    // Full Bleed Divider
    docChildren.push(new Paragraph({
        indent: { left: -ptToTwip(cust.marginLeft || 72), right: -ptToTwip(cust.marginRight || 72) },
        spacing: { before: ptToTwip(4), after: ptToTwip(4) },
        border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 16 } }
    }));

    // --- TITLE ---
    docChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: ptToTwip(12), after: ptToTwip(24) },
        children: [new TextRun({ text: title.toUpperCase(), bold: true, size: (baseFontSize + 4) * 2, font: font, color: textColor })]
    }));

    // --- SECTIONS ---
    sections.forEach((sec, idx) => {
        docChildren.push(new Paragraph({
            spacing: { before: idx > 0 ? ptToTwip(18) : ptToTwip(4), after: ptToTwip(6) },
            children: [new TextRun({ text: `${idx + 1}. ${sec.heading}`, bold: true, size: (baseFontSize + 2) * 2, font: font, color: textColor })]
        }));
        if (sec.content) {
            docChildren.push(...parseMarkdownToDocx(sec.content, cust, baseFontSize));
        }
    });

    // --- STAMP IMAGE ---
    const stampBuffer = getAssetBuffer('stamp.png');
    if (stampBuffer) {
        const sDims = getPngDimensions(stampBuffer);
        const sAspect = sDims ? sDims.height / sDims.width : 1;
        const stampW = Math.round(1.8 * 96);

        docChildren.push(new Paragraph({
            spacing: { before: ptToTwip(4), after: ptToTwip(4) },
            border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 4 } }
        }));
        docChildren.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
                new ImageRun({ 
                    data: stampBuffer, 
                    type: 'png',
                    transformation: { width: stampW, height: Math.round(stampW * sAspect) }
                })
            ]
        }));
    }

    // --- HEADER / WATERMARK ---
    const headerChildren = [];
    if (cust.header) {
        headerChildren.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: cust.header, color: "646464", font: font, size: (baseFontSize - 2 > 0 ? baseFontSize - 2 : 10) * 2 })]
        }));
    }

    const watermarkBuffer = getAssetBuffer('watermark.png');
    if (watermarkBuffer) {
        headerChildren.push(new Paragraph({
            children: [
                new ImageRun({
                    data: watermarkBuffer,
                    type: 'png',
                    transformation: { width: 6 * 96, height: 6 * 96 },
                    floating: {
                        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: inchToEmu(1.25) },
                        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: inchToEmu(3.5) },
                        wrap: { type: TextWrappingType.NONE },
                        behindDocument: true
                    }
                })
            ]
        }));
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
export async function generatePdf(title, sections, cust) {
    return new Promise((resolve, reject) => {
        const content = [];
        const baseFontSize = parseInt(cust.size, 10) || 12;
        const footerFontSize = (baseFontSize - 2 > 0) ? baseFontSize - 2 : 10;
        
        let imgHeightPt = 0;
        const topBannerBase64 = getAssetBase64('top.png');
        if (topBannerBase64) {
            const buffer = getAssetBuffer('top.png');
            const dims = getPngDimensions(buffer);
            const aspect = dims ? dims.height / dims.width : 0.15;
            imgHeightPt = 8.5 * aspect * 72;
        }

        const topMargin = parseInt(cust.marginTop, 10) || 72;
        const addressSpace = Math.max(0, imgHeightPt - topMargin + 4);

        content.push({
            text: "OFFICE NO. 12, 2ND FLOOR, NO.40 DLF INDUSTRIAL AREA, KIRTI NAGAR, DELHI 110015.\nContact No. : +91 99871 59986 | Email : info@sgwebapp.com | Website : www.sgwebapp.com",
            alignment: 'center', fontSize: 9, bold: true, margin: [0, addressSpace, 0, 4]
        });

        content.push({
            canvas: [{ type: 'line', x1: -(cust.marginLeft || 72), y1: 0, x2: 595.28 - (cust.marginLeft || 72), y2: 0, lineWidth: 1.5 }],
            margin: [0, 4, 0, 4]
        });
        
        content.push({ text: title.toUpperCase(), alignment: 'center', fontSize: baseFontSize + 4, bold: true, margin: [0, 12, 0, 24] });

        sections.forEach((sec, idx) => {
            content.push({ text: `${idx + 1}. ${sec.heading}`, fontSize: baseFontSize + 2, bold: true, margin: [0, idx > 0 ? 18 : 4, 0, 6] });
            if (sec.content) {
                content.push(...parseMarkdownToPdf(sec.content, cust, baseFontSize));
            }
        });

        const stampBase64 = getAssetBase64('stamp.png');
        if (stampBase64) {
            content.push({
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 595.28 - ((cust.marginLeft || 72) + (cust.marginRight || 72)), y2: 0, lineWidth: 0.5 }],
                margin: [0, 4, 0, 4]
            });
            content.push({ image: stampBase64, width: 1.8 * 72, alignment: 'right', margin: [0, 4, 0, 0] });
        }

        const watermarkBase64 = getAssetBase64('watermark.png');

        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [cust.marginLeft || 72, cust.marginTop || 72, cust.marginRight || 72, cust.marginBottom || 72],
            background: function(currentPage) {
                const bg = [];
                if (cust.bgColor && cust.bgColor.toLowerCase() !== '#ffffff') {
                    bg.push({
                        canvas: [{
                            type: 'rect',
                            x: 0, y: 0, w: 595.28, h: 841.89,
                            color: cust.bgColor
                        }]
                    });
                }
                if (topBannerBase64 && currentPage === 1) {
                    bg.push({ image: topBannerBase64, width: 595.28, absolutePosition: { x: 0, y: 0 } });
                }
                if (watermarkBase64) {
                    bg.push({ image: watermarkBase64, width: 6 * 72, absolutePosition: { x: 1.25 * 72, y: 3.5 * 72 }, opacity: 0.15 });
                }
                return bg;
            },
            header: cust.header ? { text: cust.header, alignment: 'right', margin: [20, 20], color: '#888888', fontSize: footerFontSize } : undefined,
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
export async function generateMd(title, sections, cust) {
    let md = `<style>\nbody {\n  font-family: '${cust.font || 'Arial'}', sans-serif;\n  background-color: ${cust.bgColor || '#ffffff'};\n  color: ${cust.textColor || '#000000'};\n}\n</style>\n\n`;
    
    if (cust.header) md += `<div align='right'><b>${cust.header}</b></div>\n`;
    md += `<div align='center'>\n<b>OFFICE NO. 12, 2ND FLOOR, NO.40 DLF INDUSTRIAL AREA, KIRTI NAGAR, DELHI 110015.</b><br>\n`;
    md += `<b>Contact No. : +91 99871 59986 | Email : info@sgwebapp.com | Website : www.sgwebapp.com</b>\n</div>\n<hr>\n\n`;
    
    md += `<h1 align='center'>${title.toUpperCase()}</h1>\n\n`;
    sections.forEach((sec, i) => {
        md += `## ${i+1}. ${sec.heading}\n\n${sec.content || ''}\n\n`;
    });
    
    if (cust.footer) md += `<hr>\n<div align='center'><i>${cust.footer.replace('[PAGE]', '1')}</i></div>\n`;
    
    return Buffer.from(md, 'utf-8');
}