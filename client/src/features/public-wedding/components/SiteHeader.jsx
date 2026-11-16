import { useState } from 'react';
import { Link } from 'react-router';

const navigation = [
  ['Home', '#hero'],
  ['Our Story', '#our-story'],
  ['Celebrations', '#celebrations'],
  ['RSVP', '#rsvp'],
  ['Gallery', '#gallery'],
  ['Announcements', '#announcements'],
];

export default function SiteHeader({ coupleNames, weddingDateLabel, city, weddingSlug = 'ananya-kabir', hasOurStory = true, hasAnnouncements = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleNavigation = navigation.filter(([label]) => (
    (label !== 'Our Story' || hasOurStory) && (label !== 'Announcements' || hasAnnouncements)
  ));
  const weddingPath = `/wedding/${weddingSlug}`;

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <div className="preview-bar">
        <div className="preview-bar__label"><span className="preview-bar__dot" />Interactive preview <span className="preview-bar__divider">/</span> Local demo data</div>
        <Link className="preview-bar__link" to="/wedding/ananya-kabir/rsvp/demo-family-token">Preview family RSVP <span aria-hidden="true">↗</span></Link>
      </div>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="site-brand" onClick={closeMenu} to={`${weddingPath}#hero`}>
            <span className="site-brand__names">{coupleNames}</span>
            <span className="site-brand__product">Make My Marriage</span>
          </Link>

          <nav aria-label="Main navigation" className="site-nav site-nav--desktop">
            {visibleNavigation.map(([label, href]) => (
              <Link to={`${weddingPath}${href}`} key={label}>{label}</Link>
            ))}
          </nav>

          <div className="site-header__actions">
            <Link className="header-rsvp-link" to={`${weddingPath}#rsvp`}>RSVP</Link>
            <button
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="menu-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-drawer" id="mobile-navigation">
          <div className="mobile-drawer__top">
            <div>
              <div className="mobile-drawer__names">{coupleNames}</div>
              <div className="mobile-drawer__product">Make My Marriage</div>
            </div>
            <button aria-label="Close navigation menu" className="mobile-drawer__close" onClick={closeMenu} type="button">×</button>
          </div>
          <nav aria-label="Mobile navigation" className="mobile-drawer__links">
            {visibleNavigation.map(([label, href]) => (
              <Link to={`${weddingPath}${href}`} key={label} onClick={closeMenu}>{label}</Link>
            ))}
          </nav>
          <div className="mobile-drawer__bottom">
            <Link className="button button--outline button--full" onClick={closeMenu} to="/wedding/ananya-kabir/rsvp/demo-family-token">View family RSVP preview</Link>
            <p>{weddingDateLabel} · {city}</p>
          </div>
        </div>
      )}
    </>
  );
}
