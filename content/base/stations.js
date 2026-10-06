/* Radio stations. Music is generated from these parameters, so a new station is just data.
 * likes: how the owner feels about it (-1..1) — liked stations slowly lift her mood,
 * disliked ones make her retune. music:false = a talk station (murmuring voice).
 * style picks the rhythm section (see RADIO_STYLES in js/audio.js); genre is the label in the tuner. */
(function (B) {
  const S = B.scales;

  B.station({
    id: 'classics', genre: 'Classical', name: 'Wireless Classics', style: 'waltz', meter: 3, tempo: 92, root: 60,
    scale: S.major, prog: [0, 3, 4, 0], lead: 'triangle', density: 0.55, likes: 0.6, color: '#6a4c93',
    says: ['A waltz drifts out of the wireless.', 'Something by a composer she can never quite name.'],
  });

  B.station({
    id: 'jazz', genre: 'Jazz', name: 'Late Jazz Lounge', style: 'jazz', tempo: 112, root: 55, swing: 0.33,
    scale: S.dorian, prog: [1, 4, 0, 0], lead: 'sine', bass: 'sine', density: 0.5, likes: 0.85, color: '#2f4f8c',
    says: ['Brushed drums and a lazy saxophone.', 'Her favourite jazz programme.'],
  });

  B.station({
    id: 'pop', genre: 'Pop', name: 'Pop 104', style: 'pop', tempo: 124, root: 62,
    scale: S.major, prog: [0, 4, 5, 3], lead: 'square', density: 0.65, likes: 0.05, color: '#d6336c',
    says: ['A chirpy pop song she half-recognises.', 'The pop station. She winces slightly.'],
  });

  B.station({
    id: 'folk', genre: 'Folk', name: 'Folk & Fiddle', style: 'folk', tempo: 104, root: 62,
    scale: S.mixolydian, prog: [0, 6, 3, 0], lead: 'sawtooth', density: 0.7, likes: 0.5, color: '#3c6e47',
    says: ['A jig on the fiddle.', 'Somebody singing about a ship that never came home.'],
  });

  B.station({
    id: 'gardeners', genre: 'Talk', name: "Gardeners' Question Hour", music: false, voice: 160, likes: 0.3, color: '#5a6a4a',
    says: ['A caller asks what to do about slugs.', 'Much debate about compost.'],
  });

  B.station({
    id: 'forecast', genre: 'Talk', name: 'The Shipping Forecast', music: false, voice: 118, likes: 0.7, color: '#3b6ea5',
    says: ['Dogger, Fisher, German Bight... moderate, occasionally poor.', 'The Shipping Forecast. Oddly soothing.'],
  });
  B.station({
    id: 'neon', genre: 'Cyberpunk', name: 'NEON GRID FM', style: 'synth', tempo: 118, root: 57,
    scale: S.minor, prog: [0, 5, 2, 6], lead: 'sawtooth', leadLp: 1800, leadVol: 0.022, pad: 'sawtooth', padVol: 0.01,
    density: 0.35, leadDurs: [1.8, 3.6], likes: 0.1, color: '#ff2bd6',
    says: ['Pulsing synths and a drum machine from some rain-slicked future.', 'NEON GRID FM: transmitting from 2087. She squints at the dial.', 'An arpeggio races up and down like traffic on a flyover.'],
  });

  B.station({
    id: 'rock', genre: 'Rock', name: 'Riff Radio', style: 'rock', tempo: 132, root: 52,
    scale: S.minor, prog: [0, 5, 6, 0], lead: 'square', leadLp: 2200, density: 0.45, likes: -0.1, color: '#c92a2a',
    says: ['Crunching guitars rattle the teacups.', 'Somebody is doing something very loud to a guitar.'],
  });

  B.station({
    id: 'reggae', genre: 'Reggae', name: 'Sunsplash Sounds', style: 'reggae', tempo: 150, root: 57,
    scale: S.major, prog: [0, 3, 4, 3], lead: 'triangle', density: 0.35, likes: 0.55, color: '#2b8a3e',
    says: ['A lazy offbeat bubbles out of the wireless.', 'Reggae. Her shoulders start to sway despite herself.'],
  });

  B.station({
    id: 'blues', genre: 'Blues', name: 'Delta Blues Hour', style: 'blues', tempo: 96, root: 55, swing: 0.33,
    scale: S.mixolydian, prog: [0, 0, 3, 0, 4, 3, 0, 4], lead: 'sawtooth', leadLp: 1600, bend: 0.3, density: 0.5, likes: 0.7, color: '#1c5d99',
    says: ['A slide guitar moans about a train.', 'Twelve bars of trouble, sung beautifully.'],
  });

  B.station({
    id: 'lofi', genre: 'Lo-fi', name: 'Rainy Day Beats', style: 'lofi', tempo: 76, root: 58, swing: 0.2,
    scale: S.dorian, prog: [0, 3, 1, 4], sevenths: true, pad: 'triangle', padVol: 0.016, lead: 'sine', density: 0.3, likes: 0.45, color: '#8e7cc3',
    says: ['Crackly beats to shelve books to.', 'A dusty little loop, crackling like an old record.'],
  });

  B.station({
    id: 'baroque', genre: 'Baroque', name: 'Harpsichord Hour', style: 'baroque', tempo: 100, root: 62,
    scale: S.major, prog: [0, 4, 5, 3, 0, 3, 4, 0], lead: 'sawtooth', leadLp: 2400, leadVol: 0.02, leadDurs: [0.8], pad: false,
    density: 0.95, likes: 0.75, color: '#a07c2c',
    says: ['Tinkling harpsichord, all ruffs and candlelight.', 'A fugue chases its own tail round and round.'],
  });

  B.station({
    id: 'bossa', genre: 'Bossa nova', name: 'Rio Nights', style: 'bossa', tempo: 128, root: 57,
    scale: S.dorian, prog: [0, 3, 1, 4], sevenths: true, pad: false, lead: 'sine', density: 0.4, likes: 0.8, color: '#e8590c',
    says: ['A gentle bossa nova, all nylon strings and sunshine.', 'The girl from somewhere goes walking again.'],
  });

  B.station({
    id: 'ambient', genre: 'Ambient', name: 'Deep Drift', style: 'ambient', tempo: 60, root: 60,
    scale: S.pentatonic, prog: [0, 3, 1, 4], pad: 'sine', padVol: 0.03, padA: 1.5, lead: 'sine', leadDurs: [3.6, 5.4], density: 0.15, likes: 0.4, color: '#4dabf7',
    says: ['Long, slow chords like fog on a lake.', 'Music for staring out of the window.'],
  });
})(window.Bookshop);
