# Piano tutor

A piano app built around one idea: **you already read falling notes, so use that to teach you
sheet music, then take it away.**

Every piece shows two things at once — a falling-note lane over the keyboard, and real notation
on paper above it — lit up in sync. As a piece gets solid, the app removes the help one layer at
a time until the staff is all that is left.

## The five levels

Each piece is played through five times, with less scaffolding each time. Two clean run-throughs
(90% or better) at a level and the app offers to take the next scaffold away.

| Level | | What you see |
|---|---|---|
| 1 | **Watch** | Falling notes lead. Every white key is labelled. Fingering shown. |
| 2 | **Connect** | The staff lights up with the falling notes. Only the target key is labelled. |
| 3 | **Fade** | Falling notes drop to ghosts. The staff is what you follow. |
| 4 | **Read** | Staff only. A key lights up *after* a wrong note, never before. |
| 5 | **Perform** | Staff only, no help, up to tempo. |

You can jump to any level by hand from the row at the bottom of the player — the ladder is a
suggestion, not a gate.

## Running it

```bash
npm install
npm run dev          # then open the printed http://localhost:5173
```

`npm run dev` also prints a second address on your local network (for example
`http://192.168.1.42:5173`). Your phone can open that while your laptop is running the server.

**One catch on the phone:** browsers only allow microphone access over `https` or on `localhost`,
so a plain `http://192.168…` address can play and display everything but will not be able to
listen. To get the microphone working on your phone, deploy it (below) and open the `https` URL.

### Putting it on the web

The repo includes a GitHub Actions workflow that builds and publishes to GitHub Pages. Turn it on
once, under **Settings → Pages → Build and deployment → Source: GitHub Actions**, then push. The
site is fully static and works offline once loaded.

```bash
npm run build        # if you would rather host dist/ somewhere else
```

## How it hears you

Three input options, switched under **Listening** on the home screen:

- **Microphone** — play your keyboard out loud and let the phone or laptop listen. Nothing to
  plug in, works on a phone, and it is the option to use with an unconnected instrument. It hears
  one note at a time, so it is right for melodies and reading drills but cannot separate a chord.
- **MIDI cable** — most exact, and the only one that gets timing and chords perfectly right.
  Connect the keyboard by USB and pick this. Safari on iPhone and iPad has no Web MIDI at all;
  use Chrome on a laptop, or the microphone.
- **On screen** — tap the keys, or use the computer keyboard (`A`–`L` is C to D, black keys on the
  row above).

## What is in it

- **Pieces** — six, ordered so each one introduces exactly one new reading problem: a fixed hand
  position, then both hands, then dotted rhythms, then a key signature, then a pickup bar, then
  sixteenths and accidentals.
- **Sight-reading drills** — one note at a time, timed. The generator is biased towards the notes
  you are slowest and least accurate on, so practice time goes where reading is actually breaking
  down rather than where it already works.
- **Technique** — scales in five keys plus a hand-independence exercise, generated with standard
  fingerings and played through the same lesson engine as the pieces.
- **Wait mode / keep time** — *Wait for me* holds the music until you play the right note, so a
  piece can be learned without a metronome bearing down on you. *Keep time* runs at tempo and
  scores what you miss.

Progress, scaffold levels and per-note reading stats are kept in the browser's local storage on
that device. There is no account and nothing leaves the machine.

## Adding a piece

Songs live in `src/songs/index.ts`. Beats are quarter notes and `line()` lays a hand out
note by note, so a rhythm can be edited in one place without renumbering everything after it:

```ts
const myPiece: Song = {
  id: 'my-piece',
  title: 'My piece',
  composer: 'Traditional',
  key: KEYS.G,                 // sets the key signature and how notes are spelled
  timeSig: [3, 4],
  bpm: 80,
  level: 7,                    // where it sits in the running order
  why: 'One line on why this piece is next.',
  teaches: ['What it introduces'],
  source: 'Traditional, public domain',
  sections: [{ name: 'Verse', start: 0, end: 12 }],   // loop targets
  notes: assemble(
    //     start beat, hand, then [midi, duration, finger]
    line(0, 'R', [[G4, Q, 1], [A4, Q, 2], [B4, H, 3]]),
    line(0, 'L', [[G3, DH, 5]]),
  ),
}
```

Add it to the `SONGS` array at the bottom of the file. In development the app checks every song on
load and warns in the console about overlapping notes, durations with no notehead, notes off the
end of the keyboard and sections that fall outside the piece — the mistakes that would otherwise
quietly teach you the wrong music.

Everything shipped here is public domain: two Beethoven themes, two traditional tunes, the Hill
sisters' *Happy Birthday* melody (public domain in the US since 2016), and two short études
written for this app.

## How it is put together

No framework beyond React, and no runtime dependencies past it — notation, audio and pitch
detection are all in the repo.

| | |
|---|---|
| `src/music/theory.ts` | MIDI numbers to spelled notes, key signatures, staff-position maths |
| `src/music/notation.ts` | Staff geometry, accidental rules, clefs drawn as line art |
| `src/music/song.ts` | The song model and the `line()` sequence builder |
| `src/music/exercises.ts` | Scales and technique, generated as ordinary songs |
| `src/music/validate.ts` | The song checks described above |
| `src/audio/synth.ts` | A small additive piano voice, so the app has no sample assets |
| `src/audio/pitch.ts` | Autocorrelation pitch tracking for the microphone |
| `src/input/input.ts` | One place that answers "what note is being played", whatever the source |
| `src/state/useLesson.ts` | The transport, wait-mode gating and scoring |
| `src/components/Staff.tsx` | The notation renderer |

Horizontal position on the staff is *time*, not engraver's spacing, so a note on the page sits
directly above the falling block and the key it belongs to. That alignment is the whole point of
the thing — it is what turns the view you can already read into the one you want to.
