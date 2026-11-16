export default function AnnouncementsSection({ announcements }) {
  if (!announcements.length) return null;

  return (
    <section className="announcements-section section-pad" id="announcements">
      <div className="section-heading section-heading--center">
        <span className="eyebrow">Guest notices</span>
        <h2>Announcements &amp; Updates</h2>
        <p>Thoughtful notes and the latest details from our families.</p>
        <span aria-hidden="true" className="heading-rule" />
      </div>
      <div className="announcement-list">
        {announcements.map((announcement) => (
          <article className="announcement-card" key={announcement._id}>
            <div className="announcement-card__content">
              <div className="announcement-card__meta">
                <span>Wedding update</span>
                <time dateTime={announcement.publishedAt}>
                  {new Intl.DateTimeFormat('en-IN', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(announcement.publishedAt))}
                </time>
              </div>
              <h3>{announcement.title}</h3>
              <p>{announcement.description}</p>
            </div>
            <span aria-hidden="true" className="announcement-card__mark">✦</span>
          </article>
        ))}
      </div>
    </section>
  );
}
