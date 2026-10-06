/* 2026-09-30 (live radio update)
 * Real internet radio in the shop wireless. A station with a `stream` URL plays that live stream instead of generated
 * music, through the same tinny speaker and shop glass. The stream must be https and send CORS headers
 * (Access-Control-Allow-Origin), or the browser silences it. While tuning in, or if it goes off air, you hear static.
 * Find more at https://www.radio-browser.info (use a station's url_resolved). */
(function (B) {
  B.station({
    id: 'void', live: true, genre: 'Dub techno', name: 'The Void', stream: 'https://thevoidrad.io/stream320',
    homepage: 'https://thevoidrad.io/', likes: 0.35, color: '#7048e8',
    says: ['Deep, echoing dub techno drifts in from The Void.', 'A live transmission from The Void: all hiss, chords and space.'],
  });

  // Nightride FM (https://nightride.fm): listener-supported synthwave, 24/7. More channels at stream.nightride.fm/<name>.mp3:
  // datawave, spacesynth, horrorsynth, ebsm, rektory.
  B.station({
    id: 'nightride', live: true, genre: 'Synthwave', name: 'Nightride FM', stream: 'https://stream.nightride.fm/nightride.mp3',
    homepage: 'https://nightride.fm/', likes: 0.25, color: '#f06595',
    says: ['Nightride FM: neon synths and a drive through a city that never sleeps.', 'Retro synthwave, like a car chase in 1986.'],
  });

  B.station({
    id: 'chillsynth', live: true, genre: 'Chillsynth', name: 'Nightride Chillsynth', stream: 'https://stream.nightride.fm/chillsynth.mp3',
    homepage: 'https://nightride.fm/', likes: 0.5, color: '#66d9e8',
    says: ['Soft, glowing synths, like a sunset in a video game.', 'Chillsynth: she finds it surprisingly good for shelving.'],
  });

  B.station({
    id: 'darksynth', live: true, genre: 'Darksynth', name: 'Nightride Darksynth', stream: 'https://stream.nightride.fm/darksynth.mp3',
    homepage: 'https://nightride.fm/', likes: -0.15, color: '#c92a2a',
    says: ['Pounding, menacing synths from a rain-soaked megacity.', 'Darksynth. The cat leaves the room.'],
  });

  B.station({
    id: 'wwoz', live: true, genre: 'New Orleans jazz', name: 'WWOZ 90.7', stream: 'https://wwoz-sc.streamguys1.com/wwoz-hi.mp3',
    homepage: 'https://www.wwoz.org/', likes: 0.9, color: '#e8b923',
    says: ['WWOZ, live from New Orleans: brass bands, R&B and a DJ who clearly loves every record.', 'A second line parade of trumpets from New Orleans.'],
  });

  B.station({
    id: 'swissclassic', live: true, genre: 'Classical', name: 'Radio Swiss Classic', stream: 'https://stream.srg-ssr.ch/srgssr/rsc_de/aac/96',
    homepage: 'https://www.radioswissclassic.ch/', likes: 0.8, color: '#d6336c',
    says: ['Radio Swiss Classic: gentle strings and hardly any talking.', 'A piano concerto drifts in from somewhere in the Alps.'],
  });
})(window.Bookshop);
