import { useEffect, useState } from 'react'
import type { NotePhoto } from '../../lib/types'
import { readPhoto } from '../../lib/photos'

/**
 * The pictures on a note: a row of thumbnails, and a full-screen look at
 * one of them.
 *
 * Two things here are decisions rather than details.
 *
 * **The shape is drawn before the picture arrives.** The note stores the
 * width and height, so the thumbnail can hold its box from the first paint
 * and the row does not jump as three blobs come back from IndexedDB at
 * three different moments. It costs two numbers on the note and it is the
 * whole reason those numbers are stored.
 *
 * **A picture that is not on this device is a sentence, not a broken
 * frame.** Sync carries the note and never the blob - see DECISIONS "A
 * photograph stays on the device it was taken on" - so opening a note
 * written on the phone on the laptop finds ids with nothing behind them.
 * That is the design working, and it says so in words.
 */

/** The blob behind an id as an object URL, revoked when it is done with. */
function usePhotoUrl(id: string): { url: string | null; missing: boolean } {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let live = true
    let made: string | null = null
    setUrl(null)
    setMissing(false)
    readPhoto(id).then(blob => {
      if (!live) return
      if (!blob) {
        setMissing(true)
        return
      }
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [id])

  return { url, missing }
}

function Thumb({ photo, onOpen, onRemove }: { photo: NotePhoto; onOpen: () => void; onRemove: () => void }) {
  const { url, missing } = usePhotoUrl(photo.id)

  if (missing) {
    return (
      <span className="note-photo is-elsewhere" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
        Kept on another device
      </span>
    )
  }

  return (
    <span className="note-photo">
      <button
        type="button"
        className="note-photo-open"
        aria-label="Open the picture"
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        onClick={onOpen}
      >
        {url && <img src={url} alt="" />}
      </button>
      <button type="button" className="note-photo-remove" aria-label={`Remove picture ${photo.id}`} onClick={onRemove}>
        &times;
      </button>
    </span>
  )
}

function Viewer({ photos, at, onMove, onClose }: { photos: NotePhoto[]; at: number; onMove: (next: number) => void; onClose: () => void }) {
  const photo = photos[at]
  const { url, missing } = usePhotoUrl(photo.id)

  // Escape closes and the arrows walk, from wherever the focus landed. The
  // same keys the viewer's own buttons offer, for the hand already on the
  // keyboard - and a phone gets the buttons, which are thumb-sized.
  //
  // Capture phase, the same way useClickAway does it: the note sheet under
  // this one closes on Escape too, and a bubble-phase listener cannot stop
  // a sibling listener on the same node. One Escape has to close one thing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'ArrowRight' && at < photos.length - 1) onMove(at + 1)
      if (e.key === 'ArrowLeft' && at > 0) onMove(at - 1)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [at, photos.length, onMove, onClose])

  return (
    <div className="photo-viewer" role="dialog" aria-label="Picture" data-keeps-keys="" onClick={onClose}>
      <div className="photo-viewer-frame" onClick={e => e.stopPropagation()}>
        {url ? <img src={url} alt="" /> : <p className="photo-viewer-empty">{missing ? 'Kept on another device' : 'Opening'}</p>}
      </div>
      <div className="photo-viewer-bar" onClick={e => e.stopPropagation()}>
        {photos.length > 1 && (
          <>
            <button type="button" className="photo-viewer-step" aria-label="Previous picture" disabled={at === 0} onClick={() => onMove(at - 1)}>
              &larr;
            </button>
            <span className="photo-viewer-where">
              {at + 1} of {photos.length}
            </span>
            <button
              type="button"
              className="photo-viewer-step"
              aria-label="Next picture"
              disabled={at === photos.length - 1}
              onClick={() => onMove(at + 1)}
            >
              &rarr;
            </button>
          </>
        )}
        <button type="button" className="photo-viewer-close" aria-label="Close the picture" onClick={onClose}>
          &times;
        </button>
      </div>
    </div>
  )
}

export interface NotePhotosProps {
  photos: NotePhoto[]
  onRemove: (photoId: string) => void
}

export function NotePhotos({ photos, onRemove }: NotePhotosProps) {
  const [open, setOpen] = useState<number | null>(null)
  if (photos.length === 0) return null

  return (
    <div className="note-photos">
      {photos.map((photo, i) => (
        <Thumb key={photo.id} photo={photo} onOpen={() => setOpen(i)} onRemove={() => onRemove(photo.id)} />
      ))}
      {open !== null && photos[open] && <Viewer photos={photos} at={open} onMove={setOpen} onClose={() => setOpen(null)} />}
    </div>
  )
}
