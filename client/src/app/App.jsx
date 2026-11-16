import { Route, Routes } from 'react-router';
import FamilyRsvpPage from '../features/public-wedding/components/FamilyRsvpPage.jsx';
import PublicWeddingPage from '../features/public-wedding/PublicWeddingPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicWeddingPage />} path="/" />
      <Route element={<PublicWeddingPage />} path="/wedding/:slug" />
      <Route element={<FamilyRsvpPage />} path="/wedding/:slug/rsvp/:token" />
      <Route element={<PublicWeddingPage />} path="*" />
    </Routes>
  );
}
