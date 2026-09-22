# Sync audit: every way an older copy could be written over a newer one

2026-09-22. The owner's report: the phone sometimes writes its old copy over
the desktop's. The wish that goes with it: the desktop is the main device; a
phone joining through GitHub takes everything and writes nothing over it;
after that both push after every change and pull on every open, return and
wake.

Read for this: `syncClient.ts`, `githubSync.ts`, `syncMerge.ts`,
`syncEntities.ts`, `cloudBackup.ts`, `store/core.ts` (where stamps are
written), `store/lifecycle.ts` (restore), `ensureDay.ts`, and the Sync and
Backup sections of Settings.

## How it stood

- **Sync** merges two plans one entity at a time: for each task, day,
  template, recipe, setting, the side that changed it later wins, and a
  deletion is a dated fact like an edit. Through GitHub the shared copy is
  `data/sync.json`, written only over the version that was read (the
  Contents API's sha), so two devices writing at once merge again rather
  than flatten each other. That part is sound, and `syncMerge.test.ts`
  holds it.
- **Stamps** are written by `commit()`, from the device's own clock.
- **The backup** writes the whole of this device's plan to
  `data/state.json` and to the day's file under `data/history/`.
- **Restore from cloud** puts the backup back through `commit()`, stamped as
  a change made now, so that it wins the next sync.

## The paths

Each has a test in `src/lib/syncTwoDevices.test.ts` that walks it with two
devices - two separate storages, the app's modules loaded afresh for each
open, as a page load does - and one repo held in memory with GitHub's lock.
Every one of them failed before its fix, for the reason given.

### 1. The repo route forgot itself on every reload

`loadConfig()` read the address, the token and the switch, and dropped
`via`. A device switched on through GitHub synced for as long as that page
was open; after the first reload it read as "a server of your own" with no
address, and `syncNow` returned at once, quietly, with the status still
"idle". Settings showed the server fields, empty.

This is the one that turns every other path from possible into likely:
after a reload neither device synced, so the only copy moving between them
was the backup (2) and the only way to "get the other device's plan" was
Restore (5).

- Test: *a device syncing through the repo is still syncing through it
  after a reload.* Failed: `via` read back as undefined.

### 2. The backup put this device's whole plan over the file

`push()` wrote `getData()` to `data/state.json` whole. Whichever device
backed up last owned the file, and the phone backs up on its first open of
a day - so the phone's copy from last night went over the desktop's copy
from the evening. On a refused write it read the new sha and wrote again,
which made the overwrite certain instead of stopping it.

- Tests: *a backup from a device that is behind does not put its older copy
  over the newer one* (failed: the file held only the phone's task), and *a
  backup that loses the race to another write reads again and merges,
  rather than writing over it* (failed: the other write was lost).

### 3. Two devices backing up with sync off, and nobody told

The same overwrite, both ways, every day, with nothing on either screen to
say that the two plans never met.

- Test: *two devices backing up with sync off are told that they are not
  seeing each other.* Failed: there was nothing to say it with.

### 4. The first connection merged at once

Switching sync on merged this device's plan into the shared one on the
spot. A phone with a plan of its own put all of it into the desktop's; and
a phone with nothing but a first-run choice - a text size, say - carried a
stamp newer than the desktop's older choice, so the phone's won everywhere.
A newer stamp on an older wish.

- Tests: *a device with nothing of its own takes the plan on GitHub whole,
  its settings too* (failed: the phone's text size won); *a device with a
  plan of its own is asked before anything is written, and nothing is*
  (failed: it wrote); *taking from GitHub replaces the plan here and writes
  nothing*; *merging keeps both plans, and both devices end up with both*
  (both failed: there was no choice to make).

### 5. Restore from cloud won everywhere

A restore is stamped as a change made now - on purpose, so that a restore
is not undone by the next sync. With sync on, that meant a backup up to a
day old won on every device: anything changed since was put back the way
the backup had it, and anything made since was deleted, because a removal
is a tombstone. The note beside the button said the opposite - that the
next sync would merge the shared plan into the restored one.

- Test: *bringing back from the backup what is missing leaves what is newer
  on the other device alone.* Failed: there was no press that did only
  that.

### 6. Two clocks

A stamp was the device's own clock. A desktop five minutes slow that pulled
the phone's task and renamed it a minute later stamped the rename four
minutes *before* the phone's version - and the next sync put the phone's
back, on both devices. An edit made after seeing another lost to it.

- Test: *a change made after seeing the other device wins, even on a clock
  that is behind.* Failed: the rename was undone.

### 7. The tab closed before the push

Through GitHub a change waited 30 seconds before it went up. The push on
leaving the page was an ordinary request, which the browser drops with the
page - and with path 1, the next open did not send it either. A phone is
put away seconds after the last tap.

- Test: *a change made just before the tab closes reaches the other
  device.* Failed: it never arrived.

### 8. A day opened before the first pull

The day view stamps the day's template the moment it mounts; the first pull
comes back a second later. A phone picked up in the morning stamped its own
copy of a day the desktop had already opened and ticked, with its own task
ids, and the merge kept both: every block twice, on both devices, the
ticked one beside an unticked twin.

- Test: *opening a day before the first pull has come back does not stamp a
  second copy of it.* Failed: four blocks where there were two.

### 9. Failures that said nothing

A failed minute's poll was swallowed, and a sync that lost the lock three
times running said "Cannot reach GitHub". Nothing in Settings said when this
device last pulled, last pushed, or whether it was behind.

- Tests: in `syncClient.test.ts` and `SyncSettings.test.tsx`.

### 10. A plan past a megabyte

Found while fixing 2. Past one megabyte the Contents API refuses a file in
its ordinary form, with a 403 - which read here as "GitHub refused the
token", on sync and on the backup alike, from the day the plan grew past
it. A few months of blocks is a megabyte.

- Test: *a plan past a megabyte still syncs and still backs up.* With the
  repo's object form taken away - the way it was read before - it fails:
  sync in error.

## What was not a path

- The merge itself: per entity, deletions included, is what it says.
- `data/sync.json`'s lock: a write over a version that was not read is
  refused and the round trip starts again.
- The minute's poll: it reads and merges and writes nothing.

## The fixes, v2.34

| Path | Fix | Where |
|---|---|---|
| 1. The route forgotten on reload | `via` read back with the rest of the config | `syncClient.ts` |
| 2. The backup's whole-plan write | Each write the merge of the file and this device, over the sha read, read and merged again on a refusal; the merge goes to the file only | `cloudBackup.ts` |
| 3. Two devices backing up, sync off | The merge in 2; a red line in Backup and Sync when the file held changes this device never saw and sync is off here | `cloudBackup.ts`, Settings |
| 4. The first connection | Nothing of its own: takes the shared plan whole, stamping nothing. A plan of its own: asked first - Take from GitHub (recommended) or Merge - with both sides described; nothing written until then | `syncClient.ts`, Settings, the line at the top of the app |
| 5. Restore from cloud | Bring back what is missing - a merge, nothing newer touched - is the first press; Replace everything is the second, armed, and says it replaces every device | `store/lifecycle.ts`, Backup |
| 6. Two clocks | Stamps never behind any stamp seen, and on GitHub's clock where it differs by more than two seconds | `clock.ts`, `store/core.ts` |
| 7. The tab closed before the push | Three seconds on a phone, eight on a computer; `keepalive` on the exit push where it fits; what is owed remembered and sent first on the next open | `syncClient.ts`, `githubSync.ts` |
| 8. A day opened before the first pull | The store's own writes wait for the page's first pull, at most five seconds, not at all offline | `store/core.ts`, `store/days.ts` |
| 9. Failures that said nothing | A failed pull on its own line; the lock lost three times called that; last pull, last push, what waits and whether this device is behind in Settings; a line at the top of the app while sync fails or waits | `syncClient.ts`, Settings |
| 10. A plan past a megabyte | Files read in the Contents API's object form, and raw past a megabyte | `cloudBackup.ts`, `githubSync.ts` |

What a person does on seeing an old copy is in `docs/SYNC.md`.
