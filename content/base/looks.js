/* Named appearances. Fields: skin, hair, hairStyle (short|long|bob|curly|bald|spiky|bun|ponytail),
 * top, top2 (shirt under a cardigan), sleeve, bottom, dress, tights, shoes, glasses, beard,
 * hat + hatStyle (cap|beanie|flat|bowler), scarf, apron, mug, bagC, h (height tweak -1..2). */
(function (B) {
  B.look('default', { skin: '#e0ac85', hair: '#4a3021', hairStyle: 'short', top: '#3b5b8c', bottom: '#2c3440' });

  B.look('owner', {
    skin: '#f0c8a8',
    hair: '#cfc9be',
    hairStyle: 'bun',
    glasses: 'half', // half-moon reading glasses
    glassesC: '#a8843a',
    top: '#c99a3a', // mustard cardigan
    buttons: '#6b4a1e',
    top2: '#f4efe2', // cream blouse
    bottom: '#6b3f2a',
    dress: true,
    tights: '#4a3a3a',
    shoes: '#3a2418',
    mug: '#e8d9b0',
  });

  B.look('courier', {
    skin: '#c68a62',
    hair: '#2b1d14',
    hairStyle: 'short',
    top: '#7a5230',
    bottom: '#4a3322',
    hat: '#7a5230',
    hatStyle: 'cap',
    h: 1,
  });
})(window.Bookshop);
