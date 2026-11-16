import { Link } from 'react-router';

export default function FamilyRsvpSection({ wedding, onViewInvitation }) {
  return (
    <section className="rsvp-section section-pad" id="rsvp">
      <div className="section-heading section-heading--center section-heading--compact">
        <span className="eyebrow">Attendance</span>
        <h2>Family RSVP</h2>
        <span aria-hidden="true" className="heading-rule" />
      </div>
      <div className="rsvp-notice">
        <div className="rsvp-notice__seal" aria-hidden="true">✉</div>
        <h3>Personalized family invitations</h3>
        <p>Your family has received a personal invitation with a secure RSVP link. Please use that link to confirm your attendance.</p>
        <div className="private-note">
          <span aria-hidden="true">▣</span>
          <div><strong>Private invitation required</strong><br />Each household’s itinerary and RSVP preferences are accessed through its private digital wedding link.</div>
        </div>
        <div className="rsvp-notice__actions">
          <button className="text-link" onClick={() => onViewInvitation({ name: 'Wedding invitation', invitation: wedding.commonInvitation, isCommon: true })} type="button">View wedding invitation</button>
          <Link className="text-link" to="/wedding/ananya-kabir/rsvp/demo-family-token">Preview family RSVP experience <span aria-hidden="true">→</span></Link>
        </div>
        <p className="demo-note">RSVP preview uses local demo data. Responses are not sent or saved.</p>
      </div>
    </section>
  );
}
