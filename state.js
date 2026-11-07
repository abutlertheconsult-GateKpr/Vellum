// Shared app data. Every other file reads/writes this one object.
// Positions are saved as fractions of the page (0 to 1) so zooming never breaks them.
window.App = {
  tool: 'select',
  color: '#d92d20',
  scale: 1.2,
  pdf: null,
  bytes: null,
  name: 'document.pdf',
  annots: {},      // { pageNumber: [ {id,type,x,y,w,h,x2,y2,text,fs,color} ] }
  selected: null   // { n, id }
};

// Short helper used by every file: $('id') finds an element.
const $ = id => document.getElementById(id);
