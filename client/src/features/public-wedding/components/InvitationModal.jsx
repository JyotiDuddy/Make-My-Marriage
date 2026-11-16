import Dialog from './Dialog.jsx';

function formatDate(value, timeZone) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone })
    .format(new Date(`${value}T00:00:00+05:30`));
}

export default function InvitationModal({ invitation, event, wedding, venueLabel, onClose }) {
  const common = !event;
  const eventDate = event?.eventDate;
  const eventVenue = event ? `${event.venueName}, ${event.venueAddress}` : venueLabel;

  return (
    <Dialog className="invitation-dialog" onClose={onClose} titleId="invitation-title">
      <div className="invitation-modal__seal" aria-hidden="true">✦</div>
      <span className="eyebrow">{common ? 'A family invitation' : 'Ceremonial invitation'}</span>
      <h2 id="invitation-title">{common ? 'The Wedding Celebration' : event?.name}</h2>
      <div className="invitation-preview" style={{ '--invitation-image': `url("${invitation?.invitation?.imageUrl ?? invitation?.imageUrl ?? wedding.coverImage.url}")` }}>
        <div className="invitation-preview__veil" />
        <div className="invitation-preview__copy">
          <span>Together with their families</span>
          <strong>{wedding.partnerOneName} <i>&amp;</i> {wedding.partnerTwoName}</strong>
          <span>{common ? 'invite you to celebrate their wedding' : `invite you to celebrate ${event?.name}`}</span>
          <span className="invitation-preview__rule" />
          <b>{eventDate ? formatDate(eventDate, wedding.timeZone) : formatDate(wedding.weddingDate, wedding.timeZone)}</b>
          <span>{event ? `${event.startTime} · ` : ''}{eventVenue}</span>
        </div>
      </div>
      <p className="invitation-modal__footnote">A digital keepsake for the celebration in Udaipur.</p>
    </Dialog>
  );
}
