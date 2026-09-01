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

## Any song you like

Add a song and it becomes sheet music at three levels. The levels are about how much
of the song you play; the five scaffold levels above are about how much help you get while
playing it. They are independent — you can read the Basic chords off a bare stave, or watch
falling notes through the Advanced arrangement.

| Level | What you play |
|---|---|
| **Basic** | Every chord of the song in order, one block per bar, in root position. Get through it and you have played the song. |
| **Intermediate** | The same chords leaning on each other — inversions so the hand barely moves — over a walking bass, with sevenths back in. |
| **Advanced** | From a MIDI: the song note for note, as actually played. From chords: broken left-hand octaves under a running right-hand arpeggio with the colour notes the chords imply. |

The chords appear as symbols above the stave and as a strip along the top that lights up as you
go, so at the Basic level you can see the whole progression and where you are in it.

### Where the notes come from

**Spotify finds the song.** Connect it and you can search, browse your playlists and liked songs,
or grab whatever is playing right now, and it fills in the title and artist.

Spotify cannot supply the *music*, and no app can make it. Spotify
[withdrew the audio-features and audio-analysis endpoints](https://community.spotify.com/t5/Spotify-for-Developers/403-Forbidden-on-v1-audio-features-using-both-user-and-client/td-p/7200198)
from new applications in November 2024, so even a song's key and tempo are no longer available,
and playback audio is encrypted — nothing can listen to a Spotify stream and transcribe it. So
Spotify's job here is picking the song, and the notes come from one of these:

- **Tap the chords in.** Pick the key and the app offers only the chords that belong to it, named
  by letter and by degree. One tap on a common progression — the four-chord loop, doo-wop, twelve-bar
  blues — writes a whole verse. This is the quickest way in on a phone.
- **Paste a chord sheet.** Works for anything. Bracketed section names become loop points, bars can
  be split with `|`, and any line that is not chords — lyrics, tab, capo notes — is ignored, so a
  chord sheet copied off the web can go in whole. All three levels are generated from the harmony.
- **Import a MIDI file.** Free MIDIs exist for most popular songs. This carries the real notes and
  the real timing, so Advanced becomes the actual arrangement rather than an approximation of it,
  while Basic and Intermediate are rebuilt from the chords read back out of the file. A band MIDI
  has a track per instrument — pick the ones to learn and mark which hand each belongs to.

Whichever route, the last step shows the arrangement as real notation and plays it, so a wrong
chord can be heard before the song is saved rather than discovered halfway through learning it.

Key and tempo are guessed from a pasted chart or an imported MIDI, and set by hand when tapping
chords in — which is what lets the palette offer the right chords. Guessed harmony is a
starting point, not gospel: if a chord sounds wrong, it probably is, and editing the chart is
quicker than arguing with the detector.

Added songs live in your browser's local storage on that device, alongside your progress.

### Sideways on a phone

Turn the phone to landscape and the layout rebuilds around the keyboard: the stave shrinks, the
scaffold ladder folds into the level chip in the header (tap it to change level), the falling-note
lane collapses at the reading levels, and the keys shrink just enough that a song's whole range
fits on screen without scrolling.

## Away from the piano

Reading music is mostly a decoding skill, and decoding trains without an instrument. This is the
part you can do on a train, in a queue, three minutes at a time.

Eight drills, mixed together rather than practised in blocks:

| Drill | What it is for |
|---|---|
| **Landmarks** | Six anchor notes, cold. Fluent readers do not count lines; they know a handful of notes on sight and measure everything else from them. |
| **Note values** | How long a note or rest is held. Half of reading is rhythm, and it is the half needing no piano at all. |
| **Treble staff** | Every note on the top staff, to the point of not thinking about it. |
| **Steps and skips** | How far apart two notes are. This is the one that turns note-by-note decoding into reading. |
| **Bass staff** | The staff most self-taught players never learn, which is why the left hand stays guesswork. |
| **Key signatures** | Which key a signature means, on sight. |
| **Rhythm tapping** | Tap each notehead as it arrives, held for its own length. |
| **Find the key** | Notation to key under the finger, without needing the piano in front of you. |

Skills unlock as earlier ones are learned, so the first session is six items rather than eighty.

### Why these drills, and why in this shape

Some deliberate choices, each with a reason behind it:

- **No mnemonics.** "Every Good Boy Deserves Fudge" works, but it puts a recited alphabet between
  seeing a note and knowing it, and that step never fully goes away. Guidance aimed at adult
  learners consistently favours [landmarks and intervals instead](https://www.musicandtheory.com/how-to-read-music-using-intervals-and-landmark-notes-vs-mnemonics/),
  which is what this trains.
- **Intervals and key signatures get their own drills.** Eye-tracking studies of sight-reading find
  amateurs move through a score note by note, while experts group notes into chunks and fixate on
  the key signature deliberately ([Perra et al., 2024](https://lead.ube.fr/wp-content/uploads/2024/07/Perra_et_al._2024.pdf)).
  Those are learnable skills, so they are drilled rather than left to emerge.
- **Speed is scored, not just accuracy.** Answer inside about a second and a half and the item is
  treated as known; take four seconds and it comes back sooner, because working a note out is not
  the same as reading it.
- **Questions are interleaved, never blocked.** Consecutive questions come from different drills.
  Having to work out *which kind* of question this is turns out to be part of the skill.
- **Spacing does the teaching.** Each item is scheduled for the moment you are about to forget it —
  see below.
- **Rhythm is tapped on the noteheads.** Tapping *on* each note for its own length ties the symbol
  to the duration in a way that [clapping alongside does not](https://www.teachpianotoday.com/2016/04/18/after-watching-this-video-you-may-never-ask-your-piano-students-to-clap-rhythm-again/).

### The scheduler

Every item — each landmark, each interval, each key signature — carries its own memory model,
shaped after [FSRS](https://faqs.ankiweb.net/what-spaced-repetition-algorithm) rather than the older
SM-2: a **difficulty** and a **stability** instead of one "ease" number, with reviews scheduled for
the point recall is predicted to fall to 90%.

The property worth having is the one that makes spacing work: an item recalled when it had nearly
been forgotten gains far more stability than the same item drilled while still fresh. Answering the
same note ten times in a row teaches almost nothing, and the maths says so. Get something wrong and
it returns before the round is over, then again in a day.

The published FSRS fits twenty-one parameters to hundreds of millions of reviews. This is the same
three-component shape with hand-set constants, which is the honest thing to do without that data.

### About the points

XP, levels, streaks and a daily ring are in here, and they are doing a narrower job than they look
like they are doing. A 2025 study of gamified retrieval practice found points and progress feedback
improved competence, enjoyment and task-value but had
[no effect on what people actually recalled](https://www.sciencedirect.com/science/article/pii/S0747563225003097)
a few days later. Broader meta-analyses find gamification helps on average but
[unevenly](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10591086/), and that short interventions beat
long ones.

So the game is there to get you to open the app, and the spacing, interleaving and retrieval are
what teach you. Sessions are twelve questions and about three minutes for the same reason.

## Running it

```bash
npm install
npm run dev          # then open the printed http://localhost:5173
```

`npm run dev` also prints a second address on your local network (for example
`http://192.168.1.42:5173`). Your phone can open that while your laptop is running the server.

**Two catches locally.** Browsers only allow microphone access over `https` or on `localhost`, so a
plain `http://192.168…` address can play and display everything but cannot listen. And Spotify only
accepts `http://127.0.0.1:5173/` as a redirect, never `localhost`. Both go away once it is
deployed, which is the next section.

### Putting it on your phone

The app is a PWA: installed to a home screen it opens full screen with no browser bar, keeps your
songs and progress, and works with no signal. It needs to be on HTTPS first — which the microphone
requires on a phone anyway.

**1. Deploy it to Vercel.**

The repo already carries `vercel.json`, so there is nothing to configure.

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New → Project**, and import `chl0key/Piano-tutor`. Grant access to the repo if asked.
3. Leave every setting alone — Vite, `npm run build`, `dist` are already set — and press **Deploy**.
4. About a minute later you get a URL like `https://piano-tutor-abc123.vercel.app`.
5. Optional: **Settings → Domains** to rename it to something you will remember.

Vercel deploys your *production branch*, which is `main` by default. This work is on
`claude/piano-tutorial-app-rjr02x`, so either merge that branch into `main` first, or point Vercel
at it: **Settings → Git → Production Branch**. Every push to that branch redeploys automatically.

**2. Install it.**

- **iPhone or iPad:** open the URL **in Safari** — Chrome on iOS cannot install apps. Tap
  **Share**, then **Add to Home Screen**. The app itself will remind you.
- **Android:** Chrome offers an **Install** button, and so does the app.

Then open it from the home screen icon rather than the browser, and turn the phone sideways for the
full keyboard.

**3. Connect Spotify (optional).**

Spotify demands an exact match on the address it sends you back to, so this has to be the deployed
URL, not a preview one.

1. Open [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an
   app. Tick **Web API**.
2. Under **Redirect URIs**, add your Vercel address with a trailing slash:
   `https://your-app.vercel.app/`
3. To also use Spotify while developing, add `http://127.0.0.1:5173/` as a second URI.
   [Spotify no longer accepts `localhost`](https://community.spotify.com/t5/Spotify-for-Developers/Increasing-security-requirements-for-integration-with-Spotify/td-p/6709091)
   — it must be the loopback IP — and every other address must be HTTPS.
4. Save, then copy the app's **Client ID**.
5. In the piano app: **Add a song → Pick from Spotify**, paste the Client ID, press **Connect**.

Vercel gives each branch and pull request its own preview URL. Those are not registered with
Spotify, so use the production address when you want the Spotify picker to work.

```bash
npm run build        # if you would rather host dist/ somewhere else entirely
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

## Adding a piece to the built-in course

The six taught pieces are separate from songs you add yourself, and live in
`src/songs/index.ts`. Beats are quarter notes and `line()` lays a hand out
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
| `src/music/chords.ts` | Chord symbols, voicings, voice leading, key detection |
| `src/music/chart.ts` | Chord-sheet parsing, and reading harmony back out of played notes |
| `src/music/arrange.ts` | The three arrangement levels |
| `src/music/midiFile.ts` | Standard MIDI file reading, quantising and hand splitting |
| `src/spotify/spotify.ts` | Spotify PKCE sign-in and the endpoints that still work |
| `src/train/srs.ts` | The FSRS-shaped scheduler |
| `src/train/skills.ts` | The eight drills, their item pools and question generation |
| `src/state/training.ts` | XP, levels, unlocks and interleaved session building |
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
