import { KEYS } from '../music/theory'
import { assemble, line, type Song } from '../music/song'
import { reportSongProblems } from '../music/validate'

// Pitch shorthand. Middle C = C4 = 60.
const E2 = 40, A2 = 45
const C3 = 48, E3 = 52, F3 = 53, G3 = 55, Gs3 = 56, A3 = 57, B3 = 59
const C4 = 60, D4 = 62, E4 = 64, F4 = 65, Fs4 = 66, G4 = 67, A4 = 69, B4 = 71
const C5 = 72, D5 = 74, Ds5 = 75, E5 = 76

const Q = 1, H = 2, W = 4, E = 0.5, S = 0.25, DH = 3, DQ = 1.5

/* ------------------------------------------------------------------ *
 * 1. Five-Finger Sunrise — original étude, right hand only.
 *    Every note sits in one hand position so the only new skill is
 *    reading, not moving.
 * ------------------------------------------------------------------ */
const sunrise: Song = {
  id: 'sunrise',
  title: 'Five-Finger Sunrise',
  composer: 'written for this app',
  key: KEYS.C,
  timeSig: [4, 4],
  bpm: 72,
  level: 1,
  why: 'Your hand never moves. The only thing changing is the notes on the page.',
  teaches: ['Treble staff, C4–G4', 'Quarter and half notes', 'Fingering 1–5'],
  source: 'Original, public domain',
  sections: [
    { name: 'Phrase 1', start: 0, end: 16 },
    { name: 'Phrase 2', start: 16, end: 32 },
  ],
  notes: assemble(
    line(0, 'R', [
      [C4, Q, 1], [D4, Q, 2], [E4, Q, 3], [D4, Q, 2],
      [C4, H, 1], [E4, H, 3],
      [G4, Q, 5], [F4, Q, 4], [E4, Q, 3], [D4, Q, 2],
      [C4, W, 1],
    ]),
    line(16, 'R', [
      [E4, Q, 3], [F4, Q, 4], [G4, Q, 5], [F4, Q, 4],
      [E4, H, 3], [C4, H, 1],
      [D4, Q, 2], [E4, Q, 3], [F4, Q, 4], [D4, Q, 2],
      [C4, W, 1],
    ]),
  ),
}

/* ------------------------------------------------------------------ *
 * 2. Twinkle, Twinkle, Little Star — traditional.
 * ------------------------------------------------------------------ */
const twinkle: Song = {
  id: 'twinkle',
  title: 'Twinkle, Twinkle, Little Star',
  composer: 'Traditional',
  key: KEYS.C,
  timeSig: [4, 4],
  bpm: 84,
  level: 2,
  why: 'A tune you already know by ear — so when the page and the sound disagree, you will hear it.',
  teaches: ['Both hands together', 'Bass staff whole notes', 'Reading a repeat'],
  source: 'Traditional melody, public domain',
  sections: [
    { name: 'A section', start: 0, end: 16 },
    { name: 'B section', start: 16, end: 32 },
    { name: 'A section again', start: 32, end: 48 },
  ],
  notes: assemble(
    line(0, 'R', [
      [C4, Q, 1], [C4, Q, 1], [G4, Q, 5], [G4, Q, 5],
      [A4, Q, 5], [A4, Q, 5], [G4, H, 5],
      [F4, Q, 4], [F4, Q, 4], [E4, Q, 3], [E4, Q, 3],
      [D4, Q, 2], [D4, Q, 2], [C4, H, 1],
    ]),
    line(16, 'R', [
      [G4, Q, 5], [G4, Q, 5], [F4, Q, 4], [F4, Q, 4],
      [E4, Q, 3], [E4, Q, 3], [D4, H, 2],
      [G4, Q, 5], [G4, Q, 5], [F4, Q, 4], [F4, Q, 4],
      [E4, Q, 3], [E4, Q, 3], [D4, H, 2],
    ]),
    line(32, 'R', [
      [C4, Q, 1], [C4, Q, 1], [G4, Q, 5], [G4, Q, 5],
      [A4, Q, 5], [A4, Q, 5], [G4, H, 5],
      [F4, Q, 4], [F4, Q, 4], [E4, Q, 3], [E4, Q, 3],
      [D4, Q, 2], [D4, Q, 2], [C4, H, 1],
    ]),
    // Left hand: one chord root per bar, so it never competes for attention.
    line(0, 'L', [
      [C3, W, 5], [C3, W, 5], [F3, W, 2], [G3, H, 1], [C3, H, 5],
      [C3, W, 5], [G3, W, 1], [C3, W, 5], [G3, W, 1],
      [C3, W, 5], [C3, W, 5], [F3, W, 2], [G3, H, 1], [C3, H, 5],
    ]),
  ),
}

/* ------------------------------------------------------------------ *
 * 3. Ode to Joy — Beethoven, Symphony No. 9.
 * ------------------------------------------------------------------ */
const odeToJoy: Song = {
  id: 'ode-to-joy',
  title: 'Ode to Joy',
  composer: 'L. v. Beethoven',
  key: KEYS.C,
  timeSig: [4, 4],
  bpm: 92,
  level: 3,
  why: 'Stepwise motion almost all the way through — the page looks exactly like the tune sounds.',
  teaches: ['Dotted quarter + eighth', 'A leap down to G3', 'Four-bar phrasing'],
  source: 'Beethoven (1824), public domain',
  sections: [
    { name: 'A', start: 0, end: 16 },
    { name: 'A′', start: 16, end: 32 },
    { name: 'B (the tricky one)', start: 32, end: 48 },
    { name: 'A′ again', start: 48, end: 64 },
  ],
  notes: assemble(
    line(0, 'R', [
      [E4, Q, 3], [E4, Q, 3], [F4, Q, 4], [G4, Q, 5],
      [G4, Q, 5], [F4, Q, 4], [E4, Q, 3], [D4, Q, 2],
      [C4, Q, 1], [C4, Q, 1], [D4, Q, 2], [E4, Q, 3],
      [E4, DQ, 3], [D4, E, 2], [D4, H, 2],
    ]),
    line(16, 'R', [
      [E4, Q, 3], [E4, Q, 3], [F4, Q, 4], [G4, Q, 5],
      [G4, Q, 5], [F4, Q, 4], [E4, Q, 3], [D4, Q, 2],
      [C4, Q, 1], [C4, Q, 1], [D4, Q, 2], [E4, Q, 3],
      [D4, DQ, 2], [C4, E, 1], [C4, H, 1],
    ]),
    line(32, 'R', [
      [D4, Q, 2], [D4, Q, 2], [E4, Q, 3], [C4, Q, 1],
      [D4, Q, 2], [E4, E, 3], [F4, E, 4], [E4, Q, 3], [C4, Q, 1],
      [D4, Q, 2], [E4, E, 3], [F4, E, 4], [E4, Q, 3], [D4, Q, 2],
      [C4, Q, 1], [D4, Q, 2], [G3, H, 5],
    ]),
    line(48, 'R', [
      [E4, Q, 3], [E4, Q, 3], [F4, Q, 4], [G4, Q, 5],
      [G4, Q, 5], [F4, Q, 4], [E4, Q, 3], [D4, Q, 2],
      [C4, Q, 1], [C4, Q, 1], [D4, Q, 2], [E4, Q, 3],
      [D4, DQ, 2], [C4, E, 1], [C4, H, 1],
    ]),
    line(0, 'L', [
      [C3, W, 5], [C3, W, 5], [C3, W, 5], [G3, W, 1],
      [C3, W, 5], [C3, W, 5], [C3, W, 5], [C3, W, 5],
      [G3, W, 1], [C3, W, 5], [G3, W, 1], [C3, W, 5],
      [C3, W, 5], [C3, W, 5], [C3, W, 5], [C3, W, 5],
    ]),
  ),
}

/* ------------------------------------------------------------------ *
 * 4. Meet F sharp — original étude introducing a key signature.
 * ------------------------------------------------------------------ */
const meetFSharp: Song = {
  id: 'meet-f-sharp',
  title: 'Meet F♯',
  composer: 'written for this app',
  key: KEYS.G,
  timeSig: [3, 4],
  bpm: 80,
  level: 4,
  why: 'One sharp at the front of the line changes every F on the page. This piece makes you feel it.',
  teaches: ['Key signature of G major', 'Reading in 3/4', 'F♯ under finger 4'],
  source: 'Original, public domain',
  sections: [
    { name: 'Phrase 1', start: 0, end: 12 },
    { name: 'Phrase 2', start: 12, end: 24 },
  ],
  notes: assemble(
    line(0, 'R', [
      [G4, Q, 1], [A4, Q, 2], [B4, Q, 3],
      [A4, Q, 2], [G4, H, 1],
      [Fs4, Q, 4], [G4, Q, 5], [A4, Q, 5],
      [G4, DH, 1],
    ]),
    line(12, 'R', [
      [B4, Q, 3], [A4, Q, 2], [G4, Q, 1],
      [Fs4, Q, 4], [G4, H, 5],
      [A4, Q, 2], [Fs4, Q, 1], [D4, Q, 1],
      [G4, DH, 1],
    ]),
    line(0, 'L', [
      [G3, DH, 5], [D4, DH, 1], [C4, DH, 2], [G3, DH, 5],
      [G3, DH, 5], [D4, DH, 1], [D4, DH, 1], [G3, DH, 5],
    ]),
  ),
}

/* ------------------------------------------------------------------ *
 * 5. Happy Birthday — melody by Patty & Mildred Hill (1893).
 *    Held to be public domain in the US since 2016.
 * ------------------------------------------------------------------ */
const happyBirthday: Song = {
  id: 'happy-birthday',
  title: 'Happy Birthday',
  composer: 'P. & M. Hill',
  key: KEYS.C,
  timeSig: [3, 4],
  bpm: 96,
  level: 5,
  why: 'The most useful eight bars you will ever be able to play from memory.',
  teaches: ['Pickup beats', 'Eighth-note pairs', 'An octave leap up to G4'],
  source: 'Hill sisters (1893); public domain in the US since 2016',
  sections: [
    { name: 'Verses 1–2', start: -1, end: 12 },
    { name: 'Verses 3–4', start: 12, end: 24 },
  ],
  notes: assemble(
    line(-1, 'R', [
      [G3, E, 1], [G3, E, 1],
      [A3, Q, 2], [G3, Q, 1], [C4, Q, 4],
      [B3, H, 3], [G3, E, 1], [G3, E, 1],
      [A3, Q, 2], [G3, Q, 1], [D4, Q, 5],
      [C4, H, 4], [G3, E, 1], [G3, E, 1],
    ]),
    line(12, 'R', [
      [G4, Q, 5], [E4, Q, 3], [C4, Q, 1],
      [B3, Q, 3], [A3, Q, 2], [F4, E, 4], [F4, E, 4],
      [E4, Q, 3], [C4, Q, 1], [D4, Q, 2],
      [C4, DH, 1],
    ]),
    line(0, 'L', [
      [C3, DH, 5], [G3, DH, 1], [C3, DH, 5], [C3, DH, 5],
      [C3, DH, 5], [G3, DH, 1], [G3, DH, 1], [C3, DH, 5],
    ]),
  ),
}

/* ------------------------------------------------------------------ *
 * 6. Für Elise — simplified opening.
 * ------------------------------------------------------------------ */
const furElise: Song = {
  id: 'fur-elise',
  title: 'Für Elise',
  composer: 'Beethoven · simplified opening',
  key: KEYS.Am,
  timeSig: [3, 8],
  bpm: 66,
  level: 6,
  why: 'The piece everyone wants. By now the falling notes can be switched off and you can read it.',
  teaches: ['Sixteenth notes', 'The accidental D♯', 'A broken-chord left hand'],
  source: 'Beethoven, WoO 59 (c. 1810), public domain — simplified arrangement',
  sections: [
    { name: 'The famous bit', start: -0.5, end: 6 },
    { name: 'Answering phrase', start: 6, end: 10.5 },
    { name: 'Ending', start: 10.5, end: 13.5 },
  ],
  notes: assemble(
    // Bars 1-4. The left hand stays out of the way until the run has landed.
    line(-0.5, 'R', [
      [E5, S, 5], [Ds5, S, 4],
      [E5, S, 5], [Ds5, S, 4], [E5, S, 5], [B4, S, 3], [D5, S, 4], [C5, S, 2],
      [A4, DQ, 1],
      [B4, DQ, 2],
      [C5, E, 3], [null, E], [E4, E, 1],
    ]),
    // Bars 5-7, the phrase said again.
    line(6, 'R', [
      [E5, S, 5], [Ds5, S, 4], [E5, S, 5], [B4, S, 3], [D5, S, 4], [C5, S, 2],
      [A4, DQ, 1],
      [B4, E, 2], [null, E], [E4, E, 1],
    ]),
    // Bars 8-9, the cadence down to A.
    line(10.5, 'R', [
      [C5, E, 3], [B4, E, 2], [A4, E, 1],
      [A4, DQ, 1],
    ]),
    line(1.5, 'L', [
      [A2, E, 5], [E3, E, 2], [A3, E, 1],
      [E2, E, 5], [E3, E, 2], [Gs3, E, 1],
      [A2, E, 5], [E3, E, 2], [A3, E, 1],
    ]),
    line(7.5, 'L', [
      [A2, E, 5], [E3, E, 2], [A3, E, 1],
      [E2, E, 5], [E3, E, 2], [Gs3, E, 1],
      [A2, E, 5], [E3, E, 2], [A3, E, 1],
      [A2, DQ, 5],
    ]),
  ),
}

export const SONGS: Song[] = [sunrise, twinkle, odeToJoy, meetFSharp, happyBirthday, furElise]

export function getSong(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id)
}

// Song data is hand-written, and a mistyped duration silently teaches the wrong
// music. Shout about it in development rather than letting it reach a lesson.
if (import.meta.env.DEV) reportSongProblems(SONGS)
