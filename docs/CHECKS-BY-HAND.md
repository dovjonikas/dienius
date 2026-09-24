# Checks only the owner can run

Two things in the v2.21 plan cannot be done from a build machine: one needs
the owner's own GitHub token, which is not for anybody else to hold, and one
needs a real finger on real iOS hardware. Both are written here as lists with
the expected outcome beside every step, so the result is a set of ticks
rather than an impression. Write down what actually happened next to each
line, including the exact sentence any status line showed.

## A1 - sync against the real GitHub, both directions

Setup, once: both devices have the same repo and token in Settings > Backup,
and Settings > Sync says **Your GitHub repo** and is on. On both, the Sync
line should read "Last synced ... Nothing from another device yet." until
the first change crosses.

Every step below: do the thing, then on the *other* device switch away from
the app and back (or just open it), and read its Sync line before looking
for the change.

| # | On the computer | Then on the phone, expect |
| --- | --- | --- |
| 1 | Add a task to today: "A1 test 1". | Within a minute of opening: the task is there. Sync line: "The other device's last change arrived just now." |
| 2 | Tick it done. | The tick shows. |
| 3 | Clear today (the day card's Clear). | Today is empty on the phone too. This is the one that walked back in during the first week, when Restore was pressed instead of sync. |
| 4 | Change a template block's note. | Open a day stamped from that template: the note is there without re-stamping. |
| 5 | On the *phone*: add "A1 test 5". Then put the phone down and open the computer. | The computer has it after its next pull (switch tab and back, or within a minute). |
| 6 | Both at once: on the computer add "A1 both PC", on the phone add "A1 both phone", within the same minute. | After both have synced, **both tasks are on both devices**. Neither overwrote the other. |
| 7 | Leave the phone open on the desk. On the computer add "A1 test 7" and do nothing else. | Without touching the phone, within about a minute the task appears (this is the read-a-minute poll). |
| 8 | Go offline on the phone (airplane mode), add "A1 test 8", come back online. | Sync line goes "No connection. It will catch up on its own." and then catches up; the task reaches the computer. |
| 9 | Open the repo on github.com. | `data/sync.json` exists and its history shows a commit per real change, not a commit a minute. `data/state.json` is still the backup's, written a few times a day. |

If any line does not match, note the step number and the exact Sync line
text on both devices. That sentence is written to be specific enough to
locate the fault.

## B1 - the four gestures, on real iOS Safari

The four were built and verified with synthesised pointer events. A finger
is different from a mouse in ways emulation does not carry: the page's own
scroll, pull-to-refresh, the long-press callout, a finger leaving the screen
mid-gesture.

| # | Gesture | Expect | Watch for |
| --- | --- | --- | --- |
| 1 | On Today, press and hold a timed block, drag it to a gap, let go. | It lands in the gap and stays. | The page scrolling under the finger instead; the block snapping back; a text-selection callout appearing. |
| 2 | Press and hold the block's bottom edge, drag down. | The block lengthens and the time under its title follows. | Dragging the page; the resize handle too small to catch. |
| 3 | Long-press a task in the list. | Its menu opens; the checkbox underneath is **not** toggled; the page does not scroll. | A tick appearing along with the menu; the browser's own share sheet or callout instead of the menu. |
| 4 | On the calendar's month, press a template chip, then press and drag across five dates in a row, fast and slightly diagonal. | All five dates are stamped, none skipped. | A date the finger crossed quickly left unstamped; the page scrolling sideways or refreshing mid-drag. |
| 5 | Start any of the drags above and slide the finger off the bottom of the screen without lifting. | The gesture ends cleanly; nothing is left "held". | A block still following an invisible finger when you touch again. |

For each: which iPhone, which iOS version, and what happened. A gesture that
works four times and fails once is a finding, not a pass.

## B2 - the book's file, from the phone

The address beside a picked file - see DECISIONS "The book's file, on the
phone too" - is decided by each device on its own: the door asks whether
this device holds the file. That question can only be asked on the two real
devices.

| # | On the computer | Then on the phone, expect |
| --- | --- | --- |
| 1 | In Library, open a book whose file was picked here. Paste the same file's share link from your cloud drive into **Also at** and leave the field. | After sync: the book's row has a door with the arrow-out icon; its bubble shows the drive address; pressing it opens the file in the drive. |
| 2 | Press the book's door here, on the computer. | Still the file from this disk, in a new tab - not the drive. |
| 3 | Clear **Also at** here. | After sync: the phone's door is the page icon again, and pressing it says "This file was picked on another computer." |
| 4 | On the phone, open the same book's detail. | The file's name is there with **Remove** beside it and no **Change**; **Also at** is there to type into. |

## B3 - the phone with no network, and the next deploy

The freeze's point 3 is held by `e2e/offline.e2e.ts` and
`e2e/deploy.e2e.ts` in Chromium. iOS Safari keeps its own service worker
rules, and an app on the home screen is not a tab: these are the same steps
on the phone itself.

| # | On the iPhone | Expect |
| --- | --- | --- |
| 1 | Open the app from the home screen with the network on, and leave it open for ten seconds. | The day as usual. |
| 2 | Close it from the app switcher. Airplane mode on. Open it again. | It opens, on today, with everything that was there. |
| 3 | Still in airplane mode: add a task, tick it, open Calendar and lay one date of the roster with Apply. | Both stay; nothing says an error. |
| 4 | Settings, Export backup. | The share sheet offers the file; saved to Files, it opens as text with the new task in it. |
| 5 | Airplane mode off. Open the app again. | The task and the date are still there. |
| 6 | After the next deploy: open the app from the home screen. | The change the deploy made is there, and no line asks for a reload. |
| 7 | Leave the app open in the background across a deploy, then switch back to it. | Within a few seconds "An update is ready." appears; the next open is the new version. |
