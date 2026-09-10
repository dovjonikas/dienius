
- A file attached to a library item, rather than a link to one. The owner
  asked for it after a `file://` link could not work (a page may not open a
  file on the reader's disk, confirmed in Chromium). The machinery exists -
  `lib/photos.ts` already keeps blobs in IndexedDB - but the standing rule
  there is that bytes stay on the device they arrived on: not synced, not in
  the backup. A PDF attached on the desktop would not be on the phone, which
  for an iPhone-first owner is most of the value gone. Serving the folder at
  a local address works today and works from the phone, so that is the
  answer until somebody wants the trade the other way.
