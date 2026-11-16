import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import {
  demoApprovedPhotos,
  demoEvents,
  demoPublishedAnnouncements,
  demoWedding,
} from './data/demoWedding.js';
import AnnouncementsSection from './components/AnnouncementsSection.jsx';
import CelebrationsSection from './components/CelebrationsSection.jsx';
import Dialog from './components/Dialog.jsx';
import FamilyRsvpSection from './components/FamilyRsvpSection.jsx';
import GallerySection from './components/GallerySection.jsx';
import HeroSection from './components/HeroSection.jsx';
import InvitationModal from './components/InvitationModal.jsx';
import OurStorySection from './components/OurStorySection.jsx';
import PhotoSubmissionModal from './components/PhotoSubmissionModal.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import './public-wedding.css';

function getWeddingDateLabel(events, timeZone) {
  const dates = [...new Set(events.map((event) => event.eventDate))].sort();
  if (!dates.length) return '';
  const first = new Date(`${dates[0]}T00:00:00+05:30`);
  const last = new Date(`${dates.at(-1)}T00:00:00+05:30`);
  const firstMonth = new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone }).format(first);
  const lastMonth = new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone }).format(last);
  const year = new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone }).format(last);
  const firstDay = new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone }).format(first);
  const lastDay = new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone }).format(last);
  return firstMonth === lastMonth
    ? `${firstMonth} ${firstDay}–${lastDay}, ${year}`
    : `${firstMonth} ${firstDay} – ${lastMonth} ${lastDay}, ${year}`;
}

export default function PublicWeddingPage() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const [invitationSelection, setInvitationSelection] = useState(null);
  const [activePhoto, setActivePhoto] = useState(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

  // This milestone intentionally renders a local, static public API-shaped demo payload.
  const wedding = demoWedding;
  const publishedEvents = useMemo(() => demoEvents.filter((event) => event.isPublished), []);
  const approvedPhotos = useMemo(() => demoApprovedPhotos.filter((photo) => photo.status === 'APPROVED'), []);
  const publishedAnnouncements = useMemo(() => demoPublishedAnnouncements.filter((item) => item.status === 'PUBLISHED'), []);
  const dateLabel = getWeddingDateLabel(publishedEvents, wedding.timeZone);
  const firstEvent = publishedEvents[0];
  const venueLabel = firstEvent ? `${firstEvent.venueName}, Udaipur, Rajasthan` : 'Udaipur, Rajasthan';

  const openInvitation = useCallback((selection) => setInvitationSelection(selection), []);
  const closeInvitation = useCallback(() => setInvitationSelection(null), []);
  const closePhotoDialog = useCallback(() => setPhotoDialogOpen(false), []);

  const openPhoto = (photo, eventName) => setActivePhoto({ photo, eventName });
  const closePhoto = useCallback(() => setActivePhoto(null), []);

  useEffect(() => {
    if (!hash) return undefined;

    const section = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!section) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      section.scrollIntoView({ behavior, block: 'start' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [hash, slug]);

  return (
    <div className="public-wedding-app" data-demo-slug={slug ?? wedding.slug}>
      <SiteHeader
        coupleNames={`${wedding.partnerOneName} & ${wedding.partnerTwoName}`}
        hasAnnouncements={publishedAnnouncements.length > 0}
        hasOurStory={Boolean(wedding.ourStory?.description || wedding.ourStory?.images?.length)}
        weddingDateLabel={dateLabel}
        city="Udaipur, Rajasthan"
        weddingSlug={wedding.slug}
      />
      <main>
        <HeroSection wedding={wedding} dateLabel={dateLabel} venueLabel={venueLabel} />
        <OurStorySection ourStory={wedding.ourStory} />
        <CelebrationsSection events={publishedEvents} timeZone={wedding.timeZone} onViewInvitation={openInvitation} />
        <FamilyRsvpSection wedding={wedding} onViewInvitation={openInvitation} />
        <GallerySection photos={approvedPhotos} events={publishedEvents} onOpenPhoto={openPhoto} onOpenPhotoForm={() => setPhotoDialogOpen(true)} />
        <AnnouncementsSection announcements={publishedAnnouncements} />
      </main>
      <SiteFooter wedding={wedding} dateLabel={dateLabel} venueLabel={venueLabel} />

      {invitationSelection && (
        <InvitationModal
          event={invitationSelection.isCommon ? null : invitationSelection}
          invitation={invitationSelection.isCommon ? invitationSelection.invitation : invitationSelection.invitation}
          wedding={wedding}
          venueLabel={venueLabel}
          onClose={closeInvitation}
        />
      )}
      {activePhoto && (
        <Dialog className="lightbox-dialog" onClose={closePhoto} titleId="lightbox-caption">
          <img alt={`Wedding memory from ${activePhoto.eventName}`} className="lightbox-image" src={activePhoto.photo.imageUrl} />
          <p className="lightbox-caption" id="lightbox-caption">{activePhoto.eventName}</p>
        </Dialog>
      )}
      {photoDialogOpen && <PhotoSubmissionModal events={publishedEvents} onClose={closePhotoDialog} />}
    </div>
  );
}
