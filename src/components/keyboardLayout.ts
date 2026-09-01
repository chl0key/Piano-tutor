import { isBlackKey } from '../music/theory'

export interface KeyRect {
  midi: number
  black: boolean
  /** x and width in "white key" units, so the whole keyboard scales cleanly. */
  x: number
  w: number
}

export const WHITE_H = 5.6
export const BLACK_H = 3.5
const BLACK_W = 0.62

/** Keyboards must start and end on a white key or the edges look broken. */
export function snapToWhite(midi: number, dir: -1 | 1): number {
  let m = midi
  while (isBlackKey(m)) m += dir
  return m
}

export function keyboardLayout(low: number, high: number): { keys: KeyRect[]; whites: number } {
  const keys: KeyRect[] = []
  let white = 0
  for (let midi = low; midi <= high; midi++) {
    if (isBlackKey(midi)) {
      keys.push({ midi, black: true, x: white - BLACK_W / 2, w: BLACK_W })
    } else {
      keys.push({ midi, black: false, x: white, w: 1 })
      white++
    }
  }
  // Draw white keys first so the black keys sit on top of them.
  keys.sort((a, b) => Number(a.black) - Number(b.black))
  return { keys, whites: white }
}

/** Number of white keys in a range — the unit the whole board is measured in. */
export function whiteCount(low: number, high: number): number {
  let n = 0
  for (let m = low; m <= high; m++) if (!isBlackKey(m)) n++
  return n
}

/** Index of a note's key among the white keys, used for auto-scrolling. */
export function whiteOffset(low: number, midi: number): number {
  let n = 0
  for (let m = low; m < midi; m++) if (!isBlackKey(m)) n++
  return n
}

/** Centre of a key, for lining the falling notes up with the keys below them. */
export function keyCenter(keys: KeyRect[], midi: number): number | null {
  const k = keys.find((k) => k.midi === midi)
  return k ? k.x + k.w / 2 : null
}

/** The smallest sensible keyboard that still contains every note in a piece. */
export function rangeFor(midis: number[], padWhites = 2): [number, number] {
  if (midis.length === 0) return [60, 72]
  const lo = snapToWhite(Math.min(...midis) - padWhites, -1)
  const hi = snapToWhite(Math.max(...midis) + padWhites, 1)
  return [Math.max(21, lo), Math.min(108, hi)]
}
