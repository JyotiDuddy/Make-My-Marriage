import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { demoEvents, demoFamilyRsvp, demoWedding } from '../data/demoWedding.js';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', month: 'short', day: 'numeric', timeZone: demoWedding.timeZone })
    .format(new Date(`${value}T00:00:00+05:30`));
}

function formatTime(value) {
  const [hour, minute] = value.split(':').map(Number);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function FamilyRsvpPage() {
  const { slug, token } = useParams();
  const validDemoToken = slug === demoWedding.slug && token === 'demo-family-token';
  const [responses, setResponses] = useState(() => Object.fromEntries(demoFamilyRsvp.events.map((item) => [item.eventId, item.existingResponse ?? ''])));
  const [notice, setNotice] = useState('');
  const rangeLabel = 'November 22–24, 2027';
  const venueLabel = 'Udaipur, Rajasthan';

  const handleSubmit = (event) => {
    event.preventDefault();
    if (demoFamilyRsvp.events.some((item) => !responses[item.eventId])) {
      setNotice('Please choose YES or NO for each invited celebration.');
      return;
    }
    setNotice('Demo only — these choices were updated locally and were not sent or saved.');
  };

  return (
    <div className="public-wedding-app">
      <SiteHeader coupleNames={`${demoWedding.partnerOneName} & ${demoWedding.partnerTwoName}`} weddingDateLabel={rangeLabel} city={venueLabel} weddingSlug={demoWedding.slug} />
      <main className="dedicated-rsvp-page">
        <div className="dedicated-rsvp-page__inner">
          <Link className="back-link" to={`/wedding/${demoWedding.slug}`}><span aria-hidden="true">←</span> Return to wedding celebration</Link>
          <section className="rsvp-form-card">
            {validDemoToken ? (
              <>
                <div className="rsvp-form-card__heading">
                  <span className="rsvp-pill">Family attendance confirmation</span>
                  <h1>{demoWedding.partnerOneName} <i>&amp;</i> {demoWedding.partnerTwoName}</h1>
                  <p className="rsvp-form-card__family">{demoFamilyRsvp.familyName}</p>
                  <span aria-hidden="true" className="heading-rule" />
                  <p>Please confirm your attendance for the celebrations to which your family has been invited.</p>
                </div>
                <form className="family-rsvp-form" onSubmit={handleSubmit}>
                  <div className="family-rsvp-form__events">
                    {demoFamilyRsvp.events.map((item) => {
                      const event = demoEvents.find((candidate) => candidate.id === item.eventId);
                      if (!event) return null;
                      return (
                        <fieldset className="family-event-choice" key={item.eventId}>
                          <legend className="sr-only">{event.name} attendance</legend>
                          <div className="family-event-choice__details">
                            <h2>{event.name}</h2>
                            <p><span aria-hidden="true">◷</span> {formatDate(event.eventDate)} · {formatTime(event.startTime)}</p>
                            <p><span aria-hidden="true">⌖</span> {event.venueName}</p>
                          </div>
                          <div aria-label={`Your response for ${event.name}`} className="response-options" role="radiogroup">
                            {['YES', 'NO'].map((answer) => (
                              <label className={`response-option response-option--${answer.toLowerCase()} ${responses[item.eventId] === answer ? 'is-selected' : ''}`} key={answer}>
                                <input
                                  checked={responses[item.eventId] === answer}
                                  name={`rsvp-${item.eventId}`}
                                  onChange={() => setResponses((current) => ({ ...current, [item.eventId]: answer }))}
                                  required
                                  type="radio"
                                  value={answer}
                                />
                                <span>{answer}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      );
                    })}
                  </div>
                  <div className="family-rsvp-form__bottom">
                    <span className="rsvp-local-status"><span aria-hidden="true">◇</span> Demo family invitation</span>
                    <button className="button button--primary" type="submit">Preview my responses</button>
                  </div>
                  <p aria-live="polite" className={`rsvp-form-notice ${notice ? 'is-visible' : ''}`}>{notice}</p>
                  <p className="demo-note demo-note--center">This is a visual demo. Responses are not submitted to a server or saved.</p>
                </form>
              </>
            ) : (
              <div className="rsvp-unavailable">
                <div className="rsvp-notice__seal" aria-hidden="true">⌑</div>
                <h1>Private invitation not found</h1>
                <p>This preview link does not match the sample family invitation.</p>
                <Link className="button button--primary" to={`/wedding/${demoWedding.slug}`}>Return to celebration home</Link>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter wedding={demoWedding} dateLabel={rangeLabel} venueLabel={venueLabel} />
    </div>
  );
}
