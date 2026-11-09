// The text fonts. "css" is what you see on screen, "pdf" is what gets written into the saved PDF
// in this order: regular, bold, italic, bold italic. To add a font, add a line here and an <option> in index.html.
App.fonts = {
  sans:  { css: 'Helvetica,Arial,sans-serif',          pdf: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'] },
  serif: { css: '"Times New Roman",Times,serif',       pdf: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'] },
  mono:  { css: '"Courier New",Courier,monospace',     pdf: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'] }
};
