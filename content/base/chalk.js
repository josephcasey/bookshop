/* Chalkboard messages (up to 3 lines of 7 characters). One is chosen per real-world day;
 * boards with `dates` (or `from` == today) take priority over the general pool. */
(function (B) {
  B.chalk({ id: 'books-bought', lines: ['BOOKS', 'BOUGHT', '& SOLD'] });
  B.chalk({ id: 'read-more', lines: ['READ', 'MORE', 'BOOKS'] });
  B.chalk({ id: 'come-in', lines: ['COME IN', "WE'RE", 'OPEN!'] });
  B.chalk({ id: 'poetry', lines: ['POETRY', 'HALF', 'PRICE'] });
  B.chalk({ id: 'kettle', lines: ['KETTLE', 'ALWAYS', 'ON'] });
})(window.Bookshop);
