export default function SiteFooter({ wedding, dateLabel, venueLabel }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="site-footer__names">{wedding.partnerOneName} <span>&amp;</span> {wedding.partnerTwoName}</p>
        <span aria-hidden="true" className="champagne-divider" />
        <p className="site-footer__details">{dateLabel} <span>·</span> {venueLabel}</p>
        <p className="site-footer__thanks">With immense love and gratitude from both families.</p>
        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} {wedding.partnerOneName} &amp; {wedding.partnerTwoName}</span>
          <span>Made with care <b>·</b> Make My Marriage</span>
        </div>
      </div>
    </footer>
  );
}
