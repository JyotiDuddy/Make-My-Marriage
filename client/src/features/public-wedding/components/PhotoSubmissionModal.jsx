import { useEffect, useRef, useState } from 'react';
import Dialog from './Dialog.jsx';

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxBytes = 10 * 1024 * 1024;

export default function PhotoSubmissionModal({ events, onClose }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewUrlRef = useRef('');
  const [eventId, setEventId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const clearPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setPreviewUrl('');
  };

  const handleFile = (candidate) => {
    setMessage('');
    if (!candidate) {
      clearPreview();
      setFile(null);
      return;
    }
    if (!acceptedTypes.includes(candidate.type)) {
      clearPreview();
      setFile(null);
      setMessage('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (candidate.size > maxBytes) {
      clearPreview();
      setFile(null);
      setMessage('Choose an image smaller than 10 MB.');
      return;
    }
    clearPreview();
    const objectUrl = URL.createObjectURL(candidate);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setFile(candidate);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!file) {
      setMessage('Choose a photo to preview first.');
      return;
    }
    setMessage('Demo only — no photo was uploaded or saved. The preview stays on this device.');
  };

  return (
    <Dialog className="photo-dialog" onClose={onClose} titleId="photo-dialog-title">
      <div className="dialog-emblem" aria-hidden="true">＋</div>
      <h2 id="photo-dialog-title">Share a memory</h2>
      <p className="dialog-intro">Share a favourite moment from the celebrations. Guest photos are reviewed before they appear in the gallery.</p>
      <form className="photo-form" onSubmit={handleSubmit}>
        <label className={`photo-dropzone ${file ? 'has-file' : ''}`} htmlFor="guest-photo-file">
          {previewUrl ? (
            <img alt="Selected photo preview" className="photo-dropzone__preview" src={previewUrl} />
          ) : (
            <span aria-hidden="true" className="photo-dropzone__icon">▧</span>
          )}
          <strong>{file ? file.name : 'Choose a photograph'}</strong>
          <span>JPEG, PNG, or WebP · up to 10 MB</span>
          <input accept="image/jpeg,image/png,image/webp" id="guest-photo-file" onChange={(event) => handleFile(event.target.files?.[0])} type="file" />
        </label>
        <label className="form-field" htmlFor="photo-event">
          <span>Celebration <small>(optional)</small></span>
          <select id="photo-event" onChange={(event) => setEventId(event.target.value)} value={eventId}>
            <option value="">Choose an event</option>
            {events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {message && <p aria-live="polite" className="form-message">{message}</p>}
        <button className="button button--primary button--full" type="submit">Preview submission</button>
        <p className="photo-form__demo-note">Local preview only. This milestone does not upload images to a server.</p>
      </form>
    </Dialog>
  );
}
