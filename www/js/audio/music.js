// Tiny chiptune sequencer + original 16-bit style compositions.
// Track notation: one token per 16th note. 'C5' = note, '-' = hold, '.' = rest.
// Drums: k = kick, s = snare, h = closed hat, o = open hat.

const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function noteFreq(tok) {
  const m = /^([A-G][#b]?)(\d)$/.exec(tok);
  if (!m) return 0;
  const n = SEMI[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
}

function parseMelodic(str) {
  const toks = str.trim().split(/\s+/);
  const ev = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '-' || t === '.') continue;
    let len = 1;
    while (toks[i + len] === '-') len++;
    ev.push({ step: i, freq: noteFreq(t), len });
  }
  return { ev, steps: toks.length };
}

function parseDrums(str) {
  const toks = str.trim().split(/\s+/);
  const ev = [];
  toks.forEach((t, i) => { if (t !== '.') for (const ch of t) ev.push({ step: i, drum: ch }); });
  return { ev, steps: toks.length };
}

// ------------------------------------------------------------------ songs

const B = {
  // menu (C major)
  mC: 'C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 .',
  mAm: 'A2 . E3 . A2 . E3 . A2 . E3 . A2 . E3 .',
  mF: 'F2 . C3 . F2 . C3 . F2 . C3 . F2 . C3 .',
  mG: 'G2 . D3 . G2 . D3 . G2 . G2 . B2 . D3 .',
  mAmF: 'A2 . E3 . A3 . E3 . F2 . C3 . F3 . C3 .',
  mGC: 'G2 . D3 . G3 . B2 . C3 . G2 . C3 . . .',
  aC: 'C4 E4 G4 C5 G4 E4 C4 E4 G4 C5 G4 E4 C4 E4 G4 E4',
  aAm: 'A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 A3 C4 E4 C4',
  aF: 'F3 A3 C4 F4 C4 A3 F3 A3 C4 F4 C4 A3 F3 A3 C4 A3',
  aG: 'G3 B3 D4 G4 D4 B3 G3 B3 D4 G4 D4 B3 G3 B3 D4 B3',
  aAmF: 'A3 C4 E4 A4 E4 C4 A3 C4 F3 A3 C4 F4 C4 A3 F3 A3',
  aGC: 'G3 B3 D4 G4 D4 B3 G3 B3 C4 E4 G4 C5 G4 E4 C4 E4',
  // battle (A minor)
  bAm: 'A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .',
  bCG: 'C3 . C4 . C3 . C4 . G2 . G3 . G2 . G3 .',
  bF: 'F2 . F3 . F2 . F3 . F2 . F3 . F2 . F3 .',
  bAmE: 'A2 . A3 . A2 . A3 . E2 . E3 . E2 . E3 .',
  bFC: 'F2 . F3 . F2 . F3 . C3 . C4 . C3 . C4 .',
  bDG: 'D3 . D4 . D3 . D4 . G2 . G3 . G2 . G3 .',
  bE: 'E2 . E3 . E2 . E3 . E2 . E3 . E2 . E3 .',
  bDm: 'D3 . D4 . D3 . D4 . D3 . D4 . D3 . D4 .',
  xAm: 'A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 A3 C4 E4 C4',
  xCG: 'C4 E4 G4 C5 G4 E4 C4 E4 G3 B3 D4 G4 D4 B3 G3 B3',
  xF: 'F3 A3 C4 F4 C4 A3 F3 A3 C4 F4 C4 A3 F3 A3 C4 A3',
  xAmE: 'A3 C4 E4 A4 E4 C4 A3 C4 E3 G#3 B3 E4 B3 G#3 E3 G#3',
  xFC: 'F3 A3 C4 F4 C4 A3 F3 A3 C4 E4 G4 C5 G4 E4 C4 E4',
  xDG: 'D4 F4 A4 D5 A4 F4 D4 F4 G3 B3 D4 G4 D4 B3 G3 B3',
  xE: 'E3 G#3 B3 E4 B3 G#3 E3 G#3 E3 G#3 B3 E4 B3 G#3 E3 G#3',
  xDm: 'D4 F4 A4 D5 A4 F4 D4 F4 D4 F4 A4 D5 A4 F4 D4 F4',
  d1: 'k . h . s . h . k . h k s . h h',
  dFill: 'k . h . s . h . k k s . s s s s',
  d2: 'k . h k s . h . k k h . s . h h',
  d2Fill: 's . s . s s s . k . s s s s s s',
};

const SONGS = {
  menu: {
    bpm: 116,
    order: ['A', 'B'],
    sections: {
      A: {
        lead: [
          'E5 - G5 - C6 - B5 - G5 - - - E5 - D5 -',
          'C5 - D5 - E5 - G5 - A5 - - - G5 - - -',
          'F5 - A5 - C6 - A5 - G5 - E5 - C5 - D5 -',
          'E5 - - - D5 - - - C5 - - - . . . .',
        ],
        bass: [B.mC, B.mAm, B.mF, B.mG],
        arp: [B.aC, B.aAm, B.aF, B.aG],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
      B: {
        lead: [
          'A5 - G5 - E5 - G5 - A5 - C6 - D6 - C6 -',
          'B5 - G5 - - - D5 - G5 - B5 - - - A5 -',
          'G5 - F5 - E5 - F5 - G5 - A5 - G5 - F5 -',
          'E5 - - - G5 - - - C6 - - - - - . .',
        ],
        bass: [B.mF, B.mG, B.mAmF, B.mGC],
        arp: [B.aF, B.aG, B.aAmF, B.aGC],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
    },
  },
  battle: {
    bpm: 150,
    order: ['A', 'B', 'A', 'C'],
    sections: {
      A: {
        lead: [
          'A4 - C5 - E5 - A5 - G5 - E5 - D5 - E5 -',
          'C5 - - - D5 - E5 - - - G5 - E5 - - -',
          'F5 - E5 - D5 - C5 - D5 - - - B4 - G4 -',
          'A4 - - - - - E5 - A5 - G5 - E5 - D5 -',
        ],
        bass: [B.bAm, B.bCG, B.bF, B.bAmE],
        arp: [B.xAm, B.xCG, B.xF, B.xAmE],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
      B: {
        lead: [
          'A4 - C5 - E5 - A5 - B5 - A5 - G5 - E5 -',
          'F5 - - - E5 - D5 - E5 - - - C5 - - -',
          'D5 - E5 - F5 - G5 - A5 - G5 - F5 - E5 -',
          'E5 - - - - - - - G#5 - - - B5 - - -',
        ],
        bass: [B.bAm, B.bFC, B.bDG, B.bE],
        arp: [B.xAm, B.xFC, B.xDG, B.xE],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
      C: {
        lead: [
          'A5 . A5 . G5 . A5 . C6 . A5 . G5 . E5 .',
          'F5 . F5 . E5 . F5 . A5 . F5 . E5 . C5 .',
          'D5 . D5 . C5 . D5 . F5 . E5 . D5 . B4 .',
          'E5 - - - G#5 - - - B5 - - - E6 - - -',
        ],
        bass: [B.bAm, B.bF, B.bDm, B.bE],
        arp: [B.xAm, B.xF, B.xDm, B.xE],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
    },
  },
  battle2: {
    bpm: 160,
    order: ['A', 'B', 'A', 'B'],
    sections: {
      A: {
        lead: [
          'E5 . E5 . G5 - E5 - B5 - - - A5 - G5 -',
          'E5 - - - C5 - E5 - G5 - - - E5 - C5 -',
          'D5 - F#5 - A5 - F#5 - D5 - A5 - F#5 - D5 -',
          'B4 - - - D#5 - - - F#5 - - - B5 - - -',
        ],
        bass: [
          'E2 . E3 . E2 . E3 . E2 . E3 . E2 . E3 .',
          'C3 . C4 . C3 . C4 . C3 . C4 . C3 . C4 .',
          'D3 . D4 . D3 . D4 . D3 . D4 . D3 . D4 .',
          'B2 . B3 . B2 . B3 . B2 . B3 . B2 . B3 .',
        ],
        arp: [
          'E4 G4 B4 E5 B4 G4 E4 G4 B4 E5 B4 G4 E4 G4 B4 G4',
          B.aC,
          'D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 F#4',
          'B3 D#4 F#4 B4 F#4 D#4 B3 D#4 F#4 B4 F#4 D#4 B3 D#4 F#4 D#4',
        ],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
      B: {
        lead: [
          'G5 - F#5 - E5 - B4 - E5 - G5 - B5 - G5 -',
          'A5 - G5 - E5 - C5 - E5 - A5 - C6 - A5 -',
          'G5 - E5 - C5 - E5 - G5 - - - C6 - - -',
          'B5 - A5 - G5 - F#5 - D#5 - - - B4 - - -',
        ],
        bass: [
          'E2 . E3 . E2 . E3 . E2 . E3 . E2 . E3 .',
          B.bAm,
          'C3 . C4 . C3 . C4 . C3 . C4 . C3 . C4 .',
          'B2 . B3 . B2 . B3 . B2 . B3 . B2 . B3 .',
        ],
        arp: [
          'E4 G4 B4 E5 B4 G4 E4 G4 B4 E5 B4 G4 E4 G4 B4 G4',
          B.xAm,
          B.aC,
          'B3 D#4 F#4 B4 F#4 D#4 B3 D#4 F#4 B4 F#4 D#4 B3 D#4 F#4 D#4',
        ],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
    },
  },
  adventure: {
    bpm: 132,
    order: ['A', 'B'],
    sections: {
      A: {
        lead: [
          'F5 - A5 - C6 - A5 - G5 - F5 - G5 - A5 -',
          'F5 - - - D5 - F5 - A5 - - - G5 - - -',
          'Bb5 - A5 - G5 - F5 - D5 - F5 - G5 - A5 -',
          'G5 - - - E5 - - - C5 - D5 - E5 - G5 -',
        ],
        bass: [
          'F2 . C3 . F2 . C3 . F2 . C3 . F2 . C3 .',
          'D3 . A3 . D3 . A3 . D3 . A3 . D3 . A3 .',
          'Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . Bb2 . F3 .',
          'C3 . G3 . C3 . G3 . C3 . G3 . C3 . E3 .',
        ],
        arp: [
          'F4 A4 C5 F5 C5 A4 F4 A4 C5 F5 C5 A4 F4 A4 C5 A4',
          'D4 F4 A4 D5 A4 F4 D4 F4 A4 D5 A4 F4 D4 F4 A4 F4',
          'Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 D4',
          B.aC,
        ],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
      B: {
        lead: [
          'A5 . A5 . C6 - A5 - F5 - A5 - C6 - D6 -',
          'D6 - C6 - A5 - F5 - D5 - - - F5 - - -',
          'D5 - F5 - Bb5 - D6 - C6 - Bb5 - A5 - G5 -',
          'G5 - - - - - - - E5 - - - C5 - - -',
        ],
        bass: [
          'F2 . C3 . F2 . C3 . F2 . C3 . F2 . C3 .',
          'D3 . A3 . D3 . A3 . D3 . A3 . D3 . A3 .',
          'Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . Bb2 . F3 .',
          'C3 . G3 . C3 . G3 . C3 . G3 . C3 . E3 .',
        ],
        arp: [
          'F4 A4 C5 F5 C5 A4 F4 A4 C5 F5 C5 A4 F4 A4 C5 A4',
          'D4 F4 A4 D5 A4 F4 D4 F4 A4 D5 A4 F4 D4 F4 A4 F4',
          'Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 D4',
          B.aC,
        ],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
    },
  },
  // boss fight (D minor, driving)
  boss: {
    bpm: 168,
    order: ['A', 'A', 'B', 'C'],
    sections: {
      A: {
        lead: [
          'D5 . D5 . F5 . D5 . A5 - G5 - F5 - E5 -',
          'D5 . D5 . F5 . D5 . C6 - A5 - F5 - A5 -',
          'Bb5 - A5 - G5 - F5 - G5 - F5 - E5 - D5 -',
          'C#5 - - - E5 - - - A5 - - - C#6 - - -',
        ],
        bass: [B.bDm, B.bDm, 'Bb2 . Bb3 . Bb2 . Bb3 . G2 . G3 . G2 . G3 .', 'A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .'],
        arp: [
          B.xDm, B.xDm,
          'Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 G3 Bb3 D4 G4 D4 Bb3 G3 Bb3',
          'A3 C#4 E4 A4 E4 C#4 A3 C#4 A3 C#4 E4 A4 E4 C#4 A3 C#4',
        ],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
      B: {
        lead: [
          'F5 - - - E5 - - - D5 - - - C5 - - -',
          'Bb4 - - - C5 - - - D5 - F5 - A5 - - -',
          'G5 - - - F5 - - - E5 - - - D5 - - -',
          'E5 - - - - - - - A5 - - - - - - -',
        ],
        bass: [B.bDm, 'Bb2 . Bb3 . Bb2 . Bb3 . Bb2 . Bb3 . Bb2 . Bb3 .', 'C3 . C4 . C3 . C4 . C3 . C4 . C3 . C4 .', 'A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .'],
        arp: [
          B.xDm,
          'Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 D4',
          'C4 E4 G4 C5 G4 E4 C4 E4 G4 C5 G4 E4 C4 E4 G4 E4',
          'A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 C#4',
        ],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
      C: {
        lead: [
          'A5 . A5 . A5 . G5 . F5 . F5 . F5 . E5 .',
          'D5 . D5 . D5 . E5 . F5 . G5 . A5 . C6 .',
          'Bb5 . Bb5 . A5 . A5 . G5 . G5 . F5 . E5 .',
          'D5 - - - A4 - - - D5 - - - - - . .',
        ],
        bass: [B.bDm, 'C3 . C4 . C3 . C4 . C3 . C4 . C3 . C4 .', 'Bb2 . Bb3 . Bb2 . Bb3 . A2 . A3 . A2 . A3 .', B.bDm],
        arp: [
          B.xDm,
          'C4 E4 G4 C5 G4 E4 C4 E4 G4 C5 G4 E4 C4 E4 G4 E4',
          'Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 A3 C#4 E4 A4 E4 C#4 A3 C#4',
          B.xDm,
        ],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
    },
  },

  // ---------------------------------------------------------------- classical
  // Chiptune arrangements of public-domain classics (optional in settings).

  // W.A. Mozart - Rondo alla Turca (A minor / A major)
  c_turkish: {
    bpm: 128,
    order: ['A', 'A', 'B', 'A'],
    sections: {
      A: {
        lead: [
          'B4 A4 G#4 A4 C5 - . . D5 C5 B4 C5 E5 - . .',
          'F5 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6 - - -',
          'A5 - C6 - B5 - A5 - G5 - A5 - B5 - A5 -',
          'G5 - A5 - B5 - A5 - G5 - F#5 - E5 - - -',
        ],
        bass: [B.bAm, B.bAmE, 'C3 . C4 . C3 . C4 . G2 . G3 . G2 . G3 .', B.bE],
        arp: [B.xAm, B.xAmE, B.xCG, B.xE],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
      B: {
        lead: [
          'C#5 - D5 - E5 - E5 - F#5 E5 D5 C#5 B4 - - -',
          'A4 - B4 - C#5 - C#5 - D5 C#5 B4 A4 G#4 - - -',
          'C#5 - D5 - E5 - E5 - F#5 E5 D5 C#5 B4 - - -',
          'A4 - B4 - C#5 - B4 - A4 - G#4 - A4 - - -',
        ],
        bass: [
          'A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .', B.bE,
          'A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .', 'E2 . E3 . E2 . E3 . A2 . A3 . A2 . A3 .',
        ],
        arp: [
          'A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 C#4', B.xE,
          'A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 C#4', B.xE,
        ],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
    },
  },

  // A. Vivaldi - The Four Seasons, Spring (E major)
  c_spring: {
    bpm: 120,
    order: ['A', 'B', 'A', 'B'],
    sections: {
      A: {
        lead: [
          'G#5 - G#5 - G#5 - F#5 E5 B5 - - - - - B5 A5',
          'G#5 - G#5 - G#5 - F#5 E5 B5 - - - - - B5 A5',
          'G#5 - A5 - B5 - A5 - G#5 - F#5 - D#5 - B4 -',
          'E5 - - - B4 - - - E5 - - - . . E5 -',
        ],
        bass: [
          'E2 . E3 . E2 . E3 . E2 . E3 . E2 . E3 .', 'E2 . E3 . E2 . E3 . E2 . E3 . E2 . E3 .',
          'E2 . E3 . E2 . E3 . B2 . B3 . B2 . B3 .', 'E2 . E3 . B2 . B3 . E2 . E3 . E2 . E3 .',
        ],
        arp: [
          'E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 G#4', 'E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 G#4',
          'E4 G#4 B4 E5 B4 G#4 E4 G#4 B3 D#4 F#4 B4 F#4 D#4 B3 D#4', 'E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 G#4',
        ],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
      B: {
        lead: [
          'B5 A5 G#5 A5 B5 - E5 - C#6 B5 A5 B5 C#6 - E5 -',
          'G#5 F#5 E5 F#5 G#5 - B4 - A5 G#5 F#5 G#5 A5 - B4 -',
          'G#5 - A5 - B5 - C#6 - B5 - A5 - G#5 - F#5 -',
          'E5 - - - B4 - - - E5 - - - . . E5 -',
        ],
        bass: [
          'E2 . E3 . E2 . E3 . A2 . A3 . A2 . A3 .', 'E2 . E3 . E2 . E3 . B2 . B3 . B2 . B3 .',
          'A2 . A3 . A2 . A3 . B2 . B3 . B2 . B3 .', 'E2 . E3 . B2 . B3 . E2 . E3 . E2 . E3 .',
        ],
        arp: [
          'E4 G#4 B4 E5 B4 G#4 E4 G#4 A3 C#4 E4 A4 E4 C#4 A3 C#4', 'E4 G#4 B4 E5 B4 G#4 E4 G#4 B3 D#4 F#4 B4 F#4 D#4 B3 D#4',
          'A3 C#4 E4 A4 E4 C#4 A3 C#4 B3 D#4 F#4 B4 F#4 D#4 B3 D#4', 'E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 G#4',
        ],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
    },
  },

  // J.S. Bach - Orchestral Suite No. 2, Badinerie (B minor)
  c_badinerie: {
    bpm: 140,
    order: ['A', 'A', 'B', 'A'],
    sections: {
      A: {
        lead: [
          'B5 - D6 B5 F#5 - B5 F#5 D5 - F#5 D5 B4 - - -',
          'F#4 B4 D5 B4 C#5 B4 C#5 B4 A#4 C#5 E5 C#5 D5 - B4 -',
          'B5 - D6 B5 F#5 - B5 F#5 D5 - F#5 D5 B4 - - -',
          'D5 F#5 E5 D5 C#5 E5 D5 C#5 B4 D5 C#5 B4 A#4 - F#4 -',
        ],
        bass: [
          'B2 . B3 . B2 . B3 . B2 . B3 . B2 . B3 .', 'B2 . B3 . F#2 . F#3 . F#2 . F#3 . B2 . B3 .',
          'B2 . B3 . B2 . B3 . B2 . B3 . B2 . B3 .', 'B2 . B3 . F#2 . F#3 . F#2 . F#3 . F#2 . F#3 .',
        ],
        arp: [
          'B3 D4 F#4 B4 F#4 D4 B3 D4 F#4 B4 F#4 D4 B3 D4 F#4 D4', 'B3 D4 F#4 B4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 B3 D4 F#4 D4',
          'B3 D4 F#4 B4 F#4 D4 B3 D4 F#4 B4 F#4 D4 B3 D4 F#4 D4', 'B3 D4 F#4 B4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 F#4 F#3 A#3 C#4 A#3',
        ],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
      B: {
        lead: [
          'F#5 - A5 F#5 C#5 - F#5 C#5 A4 - C#5 A4 F#4 - - -',
          'C#5 E5 D5 C#5 B4 D5 C#5 B4 A#4 C#5 B4 A#4 B4 - F#4 -',
          'G5 - B5 G5 E5 - G5 E5 C#5 - E5 C#5 A#4 - - -',
          'B4 D5 C#5 B4 A#4 C#5 B4 A#4 B4 - - - B4 - . .',
        ],
        bass: [
          'F#2 . F#3 . F#2 . F#3 . F#2 . F#3 . F#2 . F#3 .', 'F#2 . F#3 . F#2 . F#3 . B2 . B3 . B2 . B3 .',
          'E2 . E3 . E2 . E3 . F#2 . F#3 . F#2 . F#3 .', 'B2 . B3 . F#2 . F#3 . B2 . B3 . B2 . B3 .',
        ],
        arp: [
          'F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 C#4 A#3', 'F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 B3 D4 F#4 B4 F#4 D4 B3 D4',
          'E3 G3 B3 E4 B3 G3 E3 G3 F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3', 'B3 D4 F#4 B4 F#3 A#3 C#4 F#4 B3 D4 F#4 B4 F#4 D4 B3 D4',
        ],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
    },
  },

  // L. van Beethoven - Symphony No. 9, Ode to Joy (C major)
  c_ode: {
    bpm: 128,
    order: ['A', 'B', 'A', 'B'],
    sections: {
      A: {
        lead: [
          'E5 - E5 - F5 - G5 - G5 - F5 - E5 - D5 -',
          'C5 - C5 - D5 - E5 - E5 - - D5 D5 - - -',
          'E5 - E5 - F5 - G5 - G5 - F5 - E5 - D5 -',
          'C5 - C5 - D5 - E5 - D5 - - C5 C5 - - -',
        ],
        bass: [B.mC, 'C3 . G3 . C3 . G3 . G2 . D3 . G2 . D3 .', B.mC, 'G2 . D3 . G2 . D3 . C3 . G3 . C3 . . .'],
        arp: [B.aC, 'C4 E4 G4 C5 G4 E4 C4 E4 G3 B3 D4 G4 D4 B3 G3 B3', B.aC, 'G3 B3 D4 G4 D4 B3 G3 B3 C4 E4 G4 C5 G4 E4 C4 E4'],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
      B: {
        lead: [
          'D5 - D5 - E5 - C5 - D5 - E5 F5 E5 - C5 -',
          'D5 - E5 F5 E5 - D5 - C5 - D5 - G4 - - -',
          'E5 - E5 - F5 - G5 - G5 - F5 - E5 - D5 -',
          'C5 - C5 - D5 - E5 - D5 - - C5 C5 - - -',
        ],
        bass: [B.mG, 'G2 . D3 . G2 . D3 . G2 . G2 . B2 . D3 .', B.mC, 'G2 . D3 . G2 . D3 . C3 . G3 . C3 . . .'],
        arp: [B.aG, B.aG, B.aC, 'G3 B3 D4 G4 D4 B3 G3 B3 C4 E4 G4 C5 G4 E4 C4 E4'],
        drums: [B.d1, B.d1, B.d1, B.dFill],
      },
    },
  },

  // E. Grieg - Peer Gynt, In the Hall of the Mountain King (B minor)
  c_mountain: {
    bpm: 150,
    order: ['A', 'A', 'B', 'A'],
    sections: {
      A: {
        lead: [
          'B4 - C#5 - D5 - E5 - F#5 - D5 - F#5 - - -',
          'F5 - C#5 - F5 - - - E5 - C5 - E5 - - -',
          'B4 - C#5 - D5 - E5 - F#5 - D5 - F#5 - B5 -',
          'A5 - F#5 - D5 - F#5 - A5 - - - - - . .',
        ],
        bass: [
          'B2 . F#3 . B2 . F#3 . B2 . F#3 . B2 . F#3 .', 'C#3 . G#3 . C#3 . G#3 . C3 . G3 . C3 . G3 .',
          'B2 . F#3 . B2 . F#3 . B2 . F#3 . B2 . F#3 .', 'F#2 . C#3 . F#2 . C#3 . F#2 . C#3 . F#2 . . .',
        ],
        arp: [
          'B3 D4 F#4 B4 F#4 D4 B3 D4 F#4 B4 F#4 D4 B3 D4 F#4 D4', 'C#4 F4 G#4 C#5 G#4 F4 C#4 F4 C4 E4 G4 C5 G4 E4 C4 E4',
          'B3 D4 F#4 B4 F#4 D4 B3 D4 F#4 B4 F#4 D4 B3 D4 F#4 D4', 'F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 C#4 A#3',
        ],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
      B: {
        lead: [
          'F#5 - G#5 - A#5 - B5 - C#6 - A#5 - C#6 - - -',
          'D6 - A#5 - D6 - - - C#6 - A#5 - C#6 - - -',
          'F#5 - G#5 - A#5 - B5 - C#6 - A#5 - C#6 - - -',
          'D6 - A#5 - D6 - - - C#6 - - - - - . .',
        ],
        bass: [
          'F#2 . C#3 . F#2 . C#3 . F#2 . C#3 . F#2 . C#3 .', 'G2 . D3 . G2 . D3 . F#2 . C#3 . F#2 . C#3 .',
          'F#2 . C#3 . F#2 . C#3 . F#2 . C#3 . F#2 . C#3 .', 'G2 . D3 . G2 . D3 . F#2 . C#3 . F#2 . . .',
        ],
        arp: [
          'F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 C#4 A#3', 'G3 Bb3 D4 G4 D4 Bb3 G3 Bb3 F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3',
          'F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3 C#4 A#3', 'G3 Bb3 D4 G4 D4 Bb3 G3 Bb3 F#3 A#3 C#4 F#4 C#4 A#3 F#3 A#3',
        ],
        drums: [B.d2, B.d2, B.d2, B.d2Fill],
      },
    },
  },

  // F. Chopin - Piano Sonata No. 2, Funeral March (B-flat minor), a heavy boss version
  c_funeral: {
    bpm: 104,
    order: ['A', 'B', 'A', 'B'],
    sections: {
      A: {
        lead: [
          'Bb4 - - - Bb4 - - Bb4 Bb4 - - - - - - -',
          'Bb4 - - - Db5 - - C5 C5 - - Bb4 Bb4 - - A4',
          'Bb4 - - - - - - - Bb4 - - - Bb4 - - Bb4',
          'Bb4 - - - Db5 - - C5 C5 - - Bb4 Bb4 - - A4',
        ],
        bass: [
          'Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . Bb2 . F3 .', 'Gb2 . Db3 . Gb2 . Db3 . F2 . C3 . F2 . C3 .',
          'Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . Bb2 . F3 .', 'Gb2 . Db3 . Gb2 . Db3 . F2 . C3 . F2 . C3 .',
        ],
        arp: [
          'Bb3 Db4 F4 Bb4 F4 Db4 Bb3 Db4 F4 Bb4 F4 Db4 Bb3 Db4 F4 Db4', 'Gb3 Bb3 Db4 Gb4 Db4 Bb3 Gb3 Bb3 F3 A3 C4 F4 C4 A3 F3 A3',
          'Bb3 Db4 F4 Bb4 F4 Db4 Bb3 Db4 F4 Bb4 F4 Db4 Bb3 Db4 F4 Db4', 'Gb3 Bb3 Db4 Gb4 Db4 Bb3 Gb3 Bb3 F3 A3 C4 F4 C4 A3 F3 A3',
        ],
        drums: ['k . h . s . h . k . h . s . h h', 'k . h . s . h . k . h . s . h h', 'k . h . s . h . k . h . s . h h', 'k . s . k . s . k k s . s s s s'],
      },
      B: {
        lead: [
          'Bb4 - - A4 Bb4 - - - - - - - . . . .',
          'F5 - - - Eb5 - - Db5 Db5 - - C5 C5 - - Bb4',
          'Db5 - - - - - - - C5 - - - - - - -',
          'Bb4 - - A4 Bb4 - - - - - - - . . . .',
        ],
        bass: [
          'Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . Bb2 . F3 .', 'Db3 . Ab3 . Db3 . Ab3 . Gb2 . Db3 . Gb2 . Db3 .',
          'Gb2 . Db3 . Gb2 . Db3 . F2 . C3 . F2 . C3 .', 'Bb2 . F3 . Bb2 . F3 . Bb2 . F3 . Bb2 . . .',
        ],
        arp: [
          'Bb3 Db4 F4 Bb4 F4 Db4 Bb3 Db4 F4 Bb4 F4 Db4 Bb3 Db4 F4 Db4', 'Db4 F4 Ab4 Db5 Ab4 F4 Db4 F4 Gb3 Bb3 Db4 Gb4 Db4 Bb3 Gb3 Bb3',
          'Gb3 Bb3 Db4 Gb4 Db4 Bb3 Gb3 Bb3 F3 A3 C4 F4 C4 A3 F3 A3', 'Bb3 Db4 F4 Bb4 F4 Db4 Bb3 Db4 F4 Bb4 F4 Db4 Bb3 Db4 F4 Db4',
        ],
        drums: ['k . h . s . h . k . h . s . h h', 'k . h . s . h . k . h . s . h h', 'k . h . s . h . k . h . s . h h', 'k . s . k . s . k k s . s s s s'],
      },
    },
  },
};

// Titles shown when a classical piece starts.
export const SONG_TITLES = {
  c_turkish: 'W.A. MOZART — MARSZ TURECKI',
  c_spring: 'A. VIVALDI — WIOSNA',
  c_badinerie: 'J.S. BACH — BADINERIE',
  c_ode: 'L. VAN BEETHOVEN — ODA DO RADOŚCI',
  c_mountain: 'E. GRIEG — W GROTACH KRÓLA GÓR',
  c_funeral: 'F. CHOPIN — MARSZ ŻAŁOBNY',
};

// In-game music by situation and the "music style" setting.
const POOLS = {
  original: { battle: ['battle', 'battle2'], adventure: ['adventure'], boss: ['boss'] },
  classical: {
    battle: ['c_turkish', 'c_spring', 'c_badinerie'],
    adventure: ['c_spring', 'c_ode', 'c_turkish', 'c_badinerie'],
    boss: ['c_mountain', 'c_funeral'],
  },
};

export function pickSong(kind, style = 'original') {
  const pool = style === 'mixed'
    ? POOLS.original[kind].concat(POOLS.classical[kind])
    : (POOLS[style] || POOLS.original)[kind];
  return pool[Math.floor(Math.random() * pool.length)];
}

function compile(song) {
  const ch = { lead: [], bass: [], arp: [], drums: [] };
  for (const name of song.order) {
    const s = song.sections[name];
    for (const k of Object.keys(ch)) ch[k].push(...s[k]);
  }
  const tracks = {
    lead: parseMelodic(ch.lead.join(' ')),
    bass: parseMelodic(ch.bass.join(' ')),
    arp: parseMelodic(ch.arp.join(' ')),
    drums: parseDrums(ch.drums.join(' ')),
  };
  const steps = tracks.lead.steps;
  const byStep = Array.from({ length: steps }, () => []);
  for (const [k, tr] of Object.entries(tracks)) for (const e of tr.ev) byStep[e.step].push({ ch: k, ...e });
  return { bpm: song.bpm, steps, byStep };
}

function pulseWave(ctx, duty) {
  const n = 32;
  const real = new Float32Array(n), imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

export class MusicPlayer {
  constructor(ctx, dest, noise) {
    this.ctx = ctx;
    this.dest = dest;
    this.noise = noise;
    this.current = null;
    this.timer = null;
    this.tempoBoost = 1;
    this.pulse25 = pulseWave(ctx, 0.25);
    this.pulse12 = pulseWave(ctx, 0.125);
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.19;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.echo.connect(fb);
    fb.connect(this.echo);
    this.echo.connect(wet);
    wet.connect(dest);
  }

  play(name) {
    if (this.current === name) return;
    this.stop();
    const song = SONGS[name];
    if (!song) return;
    this.current = name;
    this.song = compile(song);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.current = null;
  }

  schedule() {
    const s = this.song;
    const spb = 60 / (s.bpm * this.tempoBoost) / 4;
    if (this.nextTime < this.ctx.currentTime - 0.3) this.nextTime = this.ctx.currentTime + 0.02;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      for (const e of s.byStep[this.step]) this.voice(e, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % s.steps;
    }
  }

  voice(e, t, spb) {
    const c = this.ctx;
    if (e.ch === 'drums') return this.drum(e.drum, t);
    const dur = e.len * spb;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = e.freq;
    let vol;
    if (e.ch === 'lead') { o.setPeriodicWave(this.pulse25); vol = 0.12; }
    else if (e.ch === 'arp') { o.setPeriodicWave(this.pulse12); vol = 0.035; }
    else { o.type = 'triangle'; vol = 0.34; }
    const rel = e.ch === 'arp' ? dur * 0.8 : dur * 0.95;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol * 0.75, t + Math.min(0.05, rel * 0.5));
    g.gain.linearRampToValueAtTime(0.0001, t + rel);
    if (e.ch === 'lead' && e.len >= 4) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = e.freq * 0.012;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t + 0.12);
      lfo.stop(t + rel);
    }
    o.connect(g);
    g.connect(this.dest);
    if (e.ch === 'lead') g.connect(this.echo);
    o.start(t);
    o.stop(t + rel + 0.02);
  }

  drum(kind, t) {
    const c = this.ctx;
    if (kind === 'k') {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(this.dest);
      o.start(t); o.stop(t + 0.15);
      return;
    }
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    const g = c.createGain();
    let dur = 0.03, vol = 0.07;
    if (kind === 's') { f.type = 'bandpass'; f.frequency.value = 1800; dur = 0.13; vol = 0.32; }
    else if (kind === 'o') { f.type = 'highpass'; f.frequency.value = 6000; dur = 0.12; vol = 0.08; }
    else { f.type = 'highpass'; f.frequency.value = 7000; }
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.01);
  }
}
