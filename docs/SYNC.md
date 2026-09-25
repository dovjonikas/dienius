# Sync

How the plan gets between the computer and the phone, and what to do when a
device shows an older copy. The diagnosis behind the way it works now, and
the test for every way it used to go wrong, is `docs/SYNC-AUDIT.md`.

## In one paragraph

Each device keeps the whole plan and works without a connection. Sync keeps
two of them agreeing through one file in your private GitHub repo,
`data/sync.json` (or through a server of your own, the older route). A change
goes up a few seconds after it is made - three seconds on a phone, eight on a
computer - and as the page is left. Every open, every return to the tab, and
every minute a screen stays open, the device reads what the other one left.
What is read is merged into what is here one thing at a time - a task, a day,
a template, a recipe, a setting - and where both devices changed the same
thing, the later change wins. A deletion is a change like any other.

## Setting it up

Backup and sync share the repo and the token, and they are two switches: a
backup made on one device does not bring the other one in. Sync has to be
on, on both.

1. **Backup first**, on each device: the repo (`you/dienius-data`) and a
   fine-grained token with Contents read and write on that one repo. The
   token stays on the device; it is in no export and no sync file.
2. **Sync, on the device whose plan is the right one first** - the
   computer: Settings, Sync, Your GitHub repo, Turn on. If it is the first
   one there, its plan goes up as it is. If GitHub already holds a plan - an
   older one, or the phone's, there first - it asks which to keep: **Keep
   this one** (it asks twice) puts the computer's plan on GitHub in place of
   that one, and on the other devices at their next sync.
3. **Then the phone**: Settings, Sync, Your GitHub repo, Turn on.
   - A phone with nothing of its own takes the computer's plan whole,
     settings included, and writes nothing.
   - A phone that has a plan of its own is asked which to keep, with both
     described - how many tasks, when last changed - and nothing is written
     anywhere until you answer. **Take from GitHub** puts the shared plan
     on the phone in place of its own; today's snapshot keeps the phone's as
     it was on its first open today. **Merge** keeps both, one thing at a
     time. On the phone, take.

**Sync turned off and on again asks again.** A device that was off may have
gone its own way in between, so switching it back on is joining again: the
same question, whenever it has a plan of its own. Until 2026-09-24 a device
that had joined once merged whatever it held when it was switched back on,
without asking - which is how a phone could show the computer's plan and
its own together.

A device that synced before v2.34 is asked the same question once, on its
first open after it: it cannot tell by itself whether it is the main device.
On the computer, Merge; on the phone, Take from GitHub.

## What each device shows

Settings, Sync, under the switch, for this device:

- **Last pull** - when it last read the shared plan and took in what was
  there.
- **Last push** - when what it has last went up, or was found there already.
- **Waiting to send** - nothing, or since when a change has been waiting.
- **GitHub** - whether it holds anything this device has not taken: nothing
  newer, a plan waiting on the first connection's question, or why it could
  not be read.

When this device may be showing an older plan than the shared one - the last
pull failed, the question is unanswered, or nothing has been pulled for three
minutes on an open screen - the status says **This device is behind GitHub.
Press Pull.**, and the button beside it is Pull.

A failure is never silent. When sync fails, or waits for the first
connection's answer, one line says so at the top of every screen, with a
button to the Sync section. Having no connection is not a failure: it says
so in Settings and catches up by itself.

## How an older copy is kept from winning

1. **Everything that goes up is a merge** against what was read a moment
   before, and is written only over that version of the file; if the other
   device wrote in between, it reads and merges again.
2. **A change made after seeing another is stamped after it.** Stamps come
   from a clock that is never behind any stamp this device has read, and
   that is set by GitHub's clock whenever GitHub's differs by more than two
   seconds (`lib/clock.ts`).
3. **The first connection asks** before a device with a plan of its own
   writes anything - and so does a device that turns sync on again.
4. **A day waits for the first pull.** On a page that has just loaded, the
   day's template is stamped only after the first pull has come back - at
   most five seconds, not at all offline - so a phone picked up in the
   morning does not stamp its own copy of a day the computer already
   opened.
5. **The backup is not sync.** Each backup merges this device's plan into
   `data/state.json` - never the other way - so no device's backup is older
   than the one before it. When a backup finds changes from another device
   and sync is off here, Settings says in red that the two plans do not see
   each other.
6. **Restore from cloud brings back, first.** Bring back what is missing
   adds what the backup has and this plan does not, and touches nothing
   newer. Replace everything is the second, armed press: it puts the backup
   back on every device and undoes there what was done since.
7. **Leaving the page pushes.** Where the plan fits in the 64 KB a browser
   will carry past a closing page, the push goes with `keepalive`; where it
   does not, or the browser drops it, the change is remembered and sent
   first on the next open.

## If a device shows an old copy

1. **Open Settings, Sync on that device** and read the four lines. If it
   says it is behind, press Pull. Pull reads before it writes; it cannot put
   this device's older copy over the other one.
2. **If it is waiting for the first connection's answer**, answer it. On the
   phone: Take from GitHub. On the device whose plan is the right one: Keep
   this one.
3. **If a device shows the other one's plan and its own together**, it
   merged. On the device whose plan is the right one: Settings, Sync, Turn
   off, Turn on, Keep this one. Then on the other: Turn off, Turn on, Take
   from GitHub. If the right one has taken the other's things in as well,
   first restore it, in Settings, Snapshots, to a day before the merge.
4. **If the change is missing on this device but was made on the other**,
   look at the other device's Waiting to send. Anything there goes up when
   that device is opened, or on Sync now there.
5. **If the line is red**, it names what to check: the token, the repo name,
   or the connection.
6. **If something is really gone**: Settings, Snapshots, has a week of this
   device's own daily copies; Backup, Restore from cloud, Bring back what is
   missing adds back what the backup has, and touches nothing newer.
7. **Never Replace everything to get the other device's changes.** That is
   what Pull is for. Replace everything is for rolling every device back to
   the backup, on purpose.

## The archive beside them

Since v2.43 the backup's repo also keeps an archive (docs/ARCHIVE-FORMAT.md):
`archive/days/YYYY/MM/YYYY-MM-DD.json` for every lived day, and
`archive/weekly/YYYY-MM-DD.json`, the whole plan once a week, named by the
week's Monday. The same token, and on whenever the backup is. It is not
sync and not the backup: nothing in it is ever read back into a plan by
itself, and nothing in it is deleted.

- **When.** The first open of a new day, after every backup, and on
  Archive now in Settings, Backup - a day is archived once it is over, and
  written again only when it changes afterwards.
- **A long history.** Forty days a run at most, oldest first, so a plan
  with months behind it is archived over its first few runs, each one
  reaching further - "Archived until" says how far. A run keeps well
  inside what GitHub lets one token write in a minute.
- **Two devices.** A day's file is named by its date, so there is one
  whichever device writes it. A device finding the day there as it would
  write it writes nothing; one holding an older copy of the day leaves the
  newer file alone, and one holding a later change writes it - the day's
  `changedAt`, the newest stamp in it, says which. A week's file is written
  only where there is none.
- **No connection, or a refused token.** Said on the archive's line in
  Settings, Backup, and nothing is marked as archived: what waited goes on
  the next run.

## What was checked where

- **Two devices through every path** in `src/lib/syncTwoDevices.test.ts`:
  two storages, the app loaded afresh for each open, and the repo held in
  memory with GitHub's lock.
- **In a browser**, `e2e/sync-github.e2e.ts`: a desktop and an iPhone-sized phone
  in Chromium - Android's engine - against one repo. The phone's tab is
  closed straight after a change, with the connection gone as it closes:
  the page is seen making its exit push, and the change still reaches the
  desktop, through the phone's next open. And a phone with a plan of its
  own is asked, on a screen that fits it, and taking writes nothing.
- **The archive**, in `src/lib/archive.test.ts`: a day written once and
  again only when changed, a week's file never written over, no connection
  and a refused token waiting for the next run, and two devices making one
  file with an older copy never over a newer one.
- **iOS Safari** could not be run here. Nothing depends on it carrying a
  request past a closing page: the three-second wait on a phone keeps that
  window small, and whatever does not leave with the page is sent on the
  next open, before anything else.
