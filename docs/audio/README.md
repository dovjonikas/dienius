# What the timer sounds like

Four files, one per profile, so the sound can be judged without starting the
app and without setting a timer to hear the end of it.

Every one of them is rendered by the app's own code - `scripts/chime-wavs.mjs`
drives a browser, imports `src/lib/chime.ts`, and swaps `AudioContext` for an
`OfflineAudioContext`. Nothing here is a second implementation of the
synthesis, so a file that disagrees with the app is not possible without one
of them being out of date. **Re-run the script after changing any number in
`PROFILES`.**

```
node scripts/chime-wavs.mjs
```

It needs the dev server up (`npm run dev -- --port 4176`), because that is
where the module is served from.

## What is in each file

All four are rendered at volume 0.5, the app's default, mono, 44.1 kHz,
16-bit. The slider multiplies these, so the same sound at 1.0 is twice the
amplitude and at 0.25 is half.

| File | Length | Peak | RMS | What it is |
|---|---|---|---|---|
| `off.wav` | 1s | 0 | 0 | Silence. Off opens no audio context at all; the file exists so nobody wonders whether the fourth one was forgotten |
| `soft.wav` | 2s | 0.089 | 0.0077 | The two-tone this app has always rung |
| `bell.wav` | 6s | 0.145 | 0.0173 | One low bell, dying away |
| `alarm.wav` | 8s | 0.389 | 0.0271 | Two of the twenty rounds it rings in the app, with the gap between them |

The peaks are what the profiles' gains are for: soft at full volume is quieter
than alarm at half, which is the whole reason there are four rather than one
sound and a slider.

The RMS figures are a poor comparison between the alarm and the other two and
are here anyway. The alarm is a short burst every three seconds, so most of
its eight seconds is silence and its average is dragged down by the gaps; what
carries into another room is the burst, not the average.

## The one thing these cannot answer

**Whether the alarm can be heard from another room.** Play `alarm.wav` at the
volume you would actually use, walk out, and shut the door. If it does not
reach, the lever is `PROFILES.alarm` in `src/lib/chime.ts` - and the way to
pull it is longer tones or a shorter gap, not a sharper timbre. A harsh sound
is measurably worse to be woken by (McFarlane and colleagues, PLOS ONE 2020),
and the whole design of these four is in that paper's direction.
