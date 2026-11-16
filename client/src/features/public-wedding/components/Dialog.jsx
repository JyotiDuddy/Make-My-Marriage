import { useEffect } from 'react';

export default function Dialog({ titleId, onClose, children, className = '' }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className={`dialog-backdrop ${className}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      role="presentation"
    >
      <section aria-labelledby={titleId} aria-modal="true" className="dialog-panel" role="dialog" tabIndex={-1}>
        <button aria-label="Close dialog" className="dialog-close" onClick={onClose} type="button">×</button>
        {children}
      </section>
    </div>
  );
}
