/* Content load order (paths relative to /content).
 *   base/      the core shop: routines, idle behaviour, phone, deliveries, customers, street, sound
 *   features/  everything added since; always on, whatever the date
 *   daily/     only for things tied to particular dates (special boards, holidays, one-off events),
 *              gated with `dates`, `from` / `until`
 *   changelog  the dated "What's new" notes
 * Later files can tweak earlier definitions by re-registering the same id. */
window.Bookshop.manifest = [
  'base/looks.js',
  'base/stations.js',
  'base/routines.js',
  'base/idle.js',
  'base/coffee-radio.js',
  'base/phone.js',
  'base/deliveries.js',
  'base/customers.js',
  'base/street.js',
  'base/chalk.js',
  'base/foley.js',

  // ---- features (always available) ----
  'features/regulars.js',
  'features/evenings.js',
  'features/cat.js',
  'features/doorbell.js',
  'features/litter.js',
  'features/pigeons.js',
  'features/alley.js',
  'features/weather.js',
  'features/offscreen-lights.js',
  'features/relight-v2.js',
  'features/sunlight.js',
  'features/opposite-street.js',
  'features/street-crew.js',
  'features/aircon.js',
  'features/shop-lamps.js',
  'features/lighting-direction.js',
  'features/mabel-dances.js',
  'features/delivery-robots.js',
  'features/thief.js',
  'features/time-visitors.js',
  'features/radio-tuner.js',
  'features/live-radio.js',
  'features/tv.js',

  // ---- programmes on Mabel's telly (see features/tv.js) ----
  'shows/tng.js',
  'shows/bladerunner.js',
  'shows/youtube.js',

  // ---- daily content (only on particular dates) ----
  'daily/2026-09-29.js',

  'changelog.js',
];
