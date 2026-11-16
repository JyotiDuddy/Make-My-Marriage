import { useState } from 'react';

function formatEventDate(value, timeZone) {
  const date = new Date(`${value}T00:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone,
  }).format(date);
}

function formatTime(value) {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export default function CelebrationsSection({ events, timeZone, onViewInvitation }) {
  const [activeId, setActiveId] = useState(events[0]?.id ?? null);
  if (!events.length) return null;

  return (
    <section className="celebrations-section section-pad" id="celebrations">
      <div className="section-heading section-heading--center">
        <span className="eyebrow">The schedule</span>
        <h2>Wedding Celebrations</h2>
        <p>We warmly invite you to share each meaningful ritual, feast, and celebration across three unforgettable days.</p>
        <span aria-hidden="true" className="heading-rule" />
      </div>

      <div aria-label="Select a celebration" className="event-tabs" role="tablist">
        {events.map((event, index) => (
          <button
            aria-selected={activeId === event.id}
            className={`event-tab ${activeId === event.id ? 'is-active' : ''}`}
            key={event.id}
            onClick={() => setActiveId(event.id)}
            role="tab"
            type="button"
          >
            {event.name.replace(/^The\s+/, '').split(':')[0]}
            {index === 0 && <span className="event-tab__day">Day one</span>}
          </button>
        ))}
      </div>

      <div className="event-list">
        {events.map((event) => {
          const expanded = activeId === event.id;
          return (
            <article className={`event-card ${expanded ? 'is-expanded' : ''}`} key={event.id}>
              <button
                aria-controls={`event-panel-${event.id}`}
                aria-expanded={expanded}
                className="event-card__trigger"
                onClick={() => setActiveId(expanded ? null : event.id)}
                type="button"
              >
                <span className="event-card__summary">
                  <span className="event-card__meta">
                    <span className="event-date-chip">{formatEventDate(event.eventDate, timeZone)}</span>
                    <span className="event-time"><span aria-hidden="true">◷</span>{formatTime(event.startTime)} – {formatTime(event.endTime)}</span>
                  </span>
                  <span className="event-card__name">{event.name}</span>
                  <span className="event-card__venue"><span aria-hidden="true">⌖</span>{event.venueName}</span>
                  <span className="event-card__description">{event.description}</span>
                </span>
                <span className="event-card__toggle">
                  <span>{expanded ? 'Hide details' : 'View details'}</span>
                  <span aria-hidden="true" className="event-card__chevron">⌄</span>
                </span>
              </button>

              {expanded && (
                <div className="event-card__panel" id={`event-panel-${event.id}`} role="tabpanel">
                  <p className="event-card__long-description">{event.description}</p>
                  <div className="event-card__actions">
                    {event.googleMapsUrl && (
                      <a className="button button--sage" href={event.googleMapsUrl} rel="noreferrer" target="_blank">
                        <span aria-hidden="true">↗</span> Get directions
                      </a>
                    )}
                    {event.invitation && (
                      <button className="button button--white" onClick={() => onViewInvitation(event)} type="button">
                        <span aria-hidden="true">✉</span> Event invitation
                      </button>
                    )}
                  </div>

                  {!!event.foodMenu?.length && (
                    <div className="event-menu">
                      <div className="subsection-heading"><span aria-hidden="true">◇</span><h3>Curated celebratory menu</h3></div>
                      <div className="event-menu__grid">
                        {event.foodMenu.map((category) => (
                          <div className="menu-card" key={category.category}>
                            <h4>{category.category}</h4>
                            <ul>{category.items.map((item) => <li key={item}>{item}</li>)}</ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {event.video?.videoId && (
                    <div className="event-video">
                      <div className="subsection-heading"><span aria-hidden="true">▷</span><h3>{event.video.videoType === 'LIVE' ? 'Ceremony live stream' : 'Event film'}</h3></div>
                      {event.video.videoType === 'LIVE' && <span className="live-badge">Live stream</span>}
                      <div className="event-video__frame">
                        <iframe
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="strict-origin-when-cross-origin"
                          src={`https://www.youtube-nocookie.com/embed/${event.video.videoId}?rel=0`}
                          title={`${event.name} video`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
