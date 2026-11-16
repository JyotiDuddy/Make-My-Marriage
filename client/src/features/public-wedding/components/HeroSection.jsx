import { useEffect, useState } from 'react';

function getCountdown(weddingDate) {
  const target = new Date(`${weddingDate}T16:00:00+05:30`).getTime();
  const remaining = Math.max(0, target - Date.now());
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return { days, hours, minutes, seconds, complete: target <= Date.now() };
}

export default function HeroSection({ wedding, dateLabel, venueLabel }) {
  const [countdown, setCountdown] = useState(() => getCountdown(wedding.weddingDate));

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(getCountdown(wedding.weddingDate)), 1_000);
    return () => window.clearInterval(timer);
  }, [wedding.weddingDate]);

  const units = [
    ['Days', countdown.days],
    ['Hours', countdown.hours],
    ['Minutes', countdown.minutes],
    ['Seconds', countdown.seconds],
  ];

  return (
    <section className="hero-section" id="hero" style={{ '--hero-image': `url("${wedding.coverImage.url}")` }}>
      <div className="hero-section__wash" />
      <div className="hero-section__content">
        <span className="eyebrow eyebrow--champagne">The wedding celebration of</span>
        <h1>{wedding.partnerOneName} <span>&amp;</span> {wedding.partnerTwoName}</h1>
        <div aria-hidden="true" className="champagne-divider" />
        <p className="hero-section__intro">{dateLabel} <span>·</span> {venueLabel}</p>
        <p className="hero-section__welcome">{wedding.introduction}</p>
        <div aria-label="Countdown to the wedding" className="countdown-card">
          {countdown.complete ? (
            <div className="countdown-card__complete">The celebration has begun</div>
          ) : (
            <div className="countdown-grid">
              {units.map(([label, value]) => (
                <div className="countdown-unit" key={label}>
                  <span>{String(value).padStart(2, '0')}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          )}
        </div>
        <a className="hero-section__explore" href="#celebrations">
          <span>Explore the celebrations</span>
          <span aria-hidden="true" className="hero-section__arrow">⌄</span>
        </a>
      </div>
    </section>
  );
}
