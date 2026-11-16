export default function GallerySection({ photos, events, onOpenPhoto, onOpenPhotoForm }) {
  if (!photos.length) return null;
  const eventNames = new Map(events.map((event) => [event.id, event.name]));

  return (
    <section className="gallery-section section-pad" id="gallery">
      <div className="gallery-heading">
        <div>
          <span className="eyebrow">Visual archives</span>
          <h2>Memories &amp; Moments</h2>
          <span aria-hidden="true" className="heading-rule heading-rule--left" />
        </div>
        <button className="button button--white gallery-heading__button" onClick={onOpenPhotoForm} type="button">
          <span aria-hidden="true">＋</span> Share a memory
        </button>
      </div>
      <div className="gallery-grid">
        {photos.map((photo, index) => (
          <button
            aria-label={`Open approved wedding photograph from ${eventNames.get(photo.eventId) ?? 'the celebration'}`}
            className="gallery-tile"
            key={photo._id}
            onClick={() => onOpenPhoto(photo, eventNames.get(photo.eventId) ?? 'Wedding memory')}
            type="button"
          >
            <img alt={`Wedding memory from ${eventNames.get(photo.eventId) ?? 'the celebration'}`} loading="lazy" src={photo.imageUrl} />
            <span className="gallery-tile__overlay">
              <small>Photograph {String(index + 1).padStart(2, '0')}</small>
              <strong>{eventNames.get(photo.eventId) ?? 'Udaipur moments'}</strong>
              <span>View photograph <span aria-hidden="true">↗</span></span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
