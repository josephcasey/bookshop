/* Daily content: things that only happen on particular dates. Gate everything here with
 * `dates`, `from` / `until`. Features that should always be available go in content/features/. */
(function (B) {
  // Opening week: a special chalkboard for the shop's first week.
  B.chalk({ id: 'grand-opening', from: '2026-09-29', until: '2026-10-05', lines: ['GRAND', 'OPENING', 'WEEK!'] });
})(window.Bookshop);
