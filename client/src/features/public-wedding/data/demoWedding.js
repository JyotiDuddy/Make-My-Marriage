const imageUrls = {
  lakeside: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB11SiZLOOT-oJf_Y8o-s2pVDslcSvV2cGgkPhCflF1tlJSmNw_5UmERyWB29kh_M4Us8q1pjjVeC4dpic0eUQ4LR47bc6Mw6h3GJToHsAs2PMrns62gubXI3UcW5FaOfo6CXRtbBLMN6VVYl-Amgb1fhhx2GXq9Q4asYqqSZ6mGAPjWz0ggNHI_fkW3qtyYjwBhTU0qLFLp9P0BsccZH0oxn1kjqGuSGVm13DR_IB3',
  storyOne: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDVY41xnlXrWp8osaciaWXkh5QgGAurT4nHpfGRvhnA8ZiV1w1CGLmYazMF3ruIc5pIAsqRbpHD0WZK5Yn6d81LQ2uFlpUxFmVPhMHMHa6mcbiw-3sfz5I82-uEwfsmZR5CQfZ4R3sBpdoT5Zf8kg9RL4izzCDuRKiCoOsuQA8fIj8hmo1QDJAEtokeX25OlWaPDtoCVz4UT2GL2Iq7X8xQ8K3bRKIjeQQ17FPaXuZX',
  storyTwo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCaRgTZKEFT6pk5ERNaApLESxOEjDqXbLkfmpo31ss_x1f6xjoo-qdSWLOsYwLfuVTzGBaLR-olsXlHNdWYi1P-hDZzybCaPrV-oQGIkBQuMchNVOi1huMiCsI31z6GFHLSk6BWwzwXq3zDesbg-igsy9nNrIw-xBY-rV_4mrlU3c0Xn_5v9vOQoC8Jj8oEPPS6XCORgKdBXFAb_2p2A3RDXM4Eja_5T-Td6_zMYu2u',
};

// Presentation-only captions stay separate from the approved story image schema.
export const demoStoryCaptions = {
  'story-image-01': { title: 'A quiet evening in Udaipur', detail: 'October 2024' },
  'story-image-02': { title: 'Promises by Lake Pichola', detail: 'Udaipur, India' },
};

// Static demo payloads mirror the public API's Wedding and Event response shapes.
export const demoWedding = {
  title: 'Ananya Weds Kabir',
  slug: 'ananya-kabir',
  partnerOneName: 'Ananya',
  partnerTwoName: 'Kabir',
  weddingDate: '2027-11-22',
  timeZone: 'Asia/Kolkata',
  introduction: 'Together with our families, we invite you to celebrate a weekend woven with love, laughter, and the beauty of Udaipur.',
  coverImage: { url: imageUrls.lakeside },
  ourStory: {
    description: 'Two paths crossed over shared passions and endless conversations under twilight skies. From quiet coffee shops in Mumbai to starry rooftop talks in Jaipur, we found comfort and wonder in each other’s dreams. Surrounded by our families and dearest friends on the banks of Lake Pichola, we step into forever.',
    images: [
      {
        id: 'story-image-01',
        url: imageUrls.storyOne,
        altText: 'Ananya and Kabir walking through a lakeside garden at twilight.',
      },
      {
        id: 'story-image-02',
        url: imageUrls.storyTwo,
        altText: 'Ananya and Kabir sharing a joyful moment beneath a carved archway.',
      },
    ],
  },
  commonInvitation: { imageUrl: imageUrls.lakeside },
};

// These objects represent the published-event API response, including its invitation projection.
export const demoEvents = [
  {
    id: 'event-mehendi',
    name: 'The Mehendi & Welcome Soirée',
    eventDate: '2027-11-22',
    startTime: '11:00',
    endTime: '15:30',
    venueName: 'Crescent Lawn & Poolside Courtyard',
    venueAddress: 'The Oberoi Udaivilas, Lake Pichola, Udaipur, Rajasthan',
    googleMapsUrl: 'https://maps.google.com/?q=The+Oberoi+Udaivilas+Udaipur',
    description: 'Begin the weekend festivities in vibrant daylight tones. Enjoy live Manganiyar percussion, delicate henna, artisanal cocktails, and street-food counters beside the pool.',
    foodMenu: [
      { category: 'Artisanal Canapés', items: ['Truffle Mathri with Avocado Cream', 'Crispy Palak Patta Chaat', 'Smoked Paneer Tikka'] },
      { category: 'Royal Mains', items: ['Dal Baati Churma', 'Royal Ker Sangri', 'Dum Biryani with Mint Raita'] },
      { category: 'Sweet Endings', items: ['Warm Ghewar with Saffron Rabdi', 'Rose Petal Kulfi'] },
    ],
    status: 'UPCOMING',
    isPublished: true,
    invitation: { imageUrl: imageUrls.storyOne },
    video: {
      videoType: 'RECORDED',
      provider: 'YOUTUBE',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
    },
  },
  {
    id: 'event-sangeet',
    name: 'Sangeet: Twilight Symphony',
    eventDate: '2027-11-22',
    startTime: '19:30',
    endTime: '01:00',
    venueName: 'Grand Pichola Ballroom & Terrace',
    venueAddress: 'The Oberoi Udaivilas, Lake Pichola, Udaipur, Rajasthan',
    googleMapsUrl: 'https://maps.google.com/?q=The+Oberoi+Udaivilas+Udaipur',
    description: 'A glittering evening of family performances and dancing beneath the Udaipur stars, followed by a brass band and music on the terrace.',
    foodMenu: [
      { category: 'Small Plates', items: ['Smoked Burrata & Fig Bruschetta', 'Crispy Lotus Stem', 'Galouti Sliders'] },
      { category: 'Global & Regional', items: ['Awadhi Dum Biryani', 'Paneer Pasanda', 'Black Lentil Dal Bukhara'] },
      { category: 'Dessert Studio', items: ['Dark Chocolate Fondant', 'Flambéed Malpua', 'Artisan Gelato'] },
    ],
    status: 'UPCOMING',
    isPublished: true,
    invitation: { imageUrl: imageUrls.storyTwo },
    video: null,
  },
  {
    id: 'event-wedding',
    name: 'The Pheras & Royal Vows',
    eventDate: '2027-11-23',
    startTime: '16:30',
    endTime: '20:00',
    venueName: 'Lakeside Mandap Promenade',
    venueAddress: 'The Oberoi Udaivilas, Lake Pichola, Udaipur, Rajasthan',
    googleMapsUrl: 'https://maps.google.com/?q=The+Oberoi+Udaivilas+Udaipur',
    description: 'As the sun dips behind the Aravalli hills, join Kabir’s royal Baraat along the promenade, followed by the sacred Pheras in a candlelit mandap facing Lake Pichola.',
    foodMenu: [
      { category: 'Before the Ceremony', items: ['Saffron Almond Milk', 'Kashmiri Kahwa', 'Petite Savoury Tartlets'] },
      { category: 'Traditional Feast', items: ['Shahi Paneer Lababdar', 'Gatte ki Subzi', 'Rajasthani Kadhi'] },
      { category: 'Desserts', items: ['Warm Moong Dal Halwa', 'Bikaneri Rasgullas'] },
    ],
    status: 'UPCOMING',
    isPublished: true,
    invitation: { imageUrl: imageUrls.lakeside },
    video: null,
  },
  {
    id: 'event-reception',
    name: 'The Formal Wedding Banquet',
    eventDate: '2027-11-24',
    startTime: '20:00',
    endTime: '23:59',
    venueName: 'The Royal Gardens & Glass Pavilion',
    venueAddress: 'The Oberoi Udaivilas, Lake Pichola, Udaipur, Rajasthan',
    googleMapsUrl: 'https://maps.google.com/?q=The+Oberoi+Udaivilas+Udaipur',
    description: 'An elegant seated dinner, celebratory toasts, live strings, and our first dance beneath chandeliers overlooking the illuminated palace.',
    foodMenu: [
      { category: 'Appetizers', items: ['Wild Mushroom Velouté', 'Charred Peach Crostini', 'Cured Beetroot Carpaccio'] },
      { category: 'Plated Entrées', items: ['Saffron Risotto', 'Smoked Aubergine Cannelloni'] },
      { category: 'Grand Finale', items: ['Champagne & Pistachio Wedding Cake', 'Chocolate Truffles'] },
    ],
    status: 'UPCOMING',
    isPublished: true,
    invitation: { imageUrl: imageUrls.storyOne },
    video: null,
  },
];

// Photo records follow Database Design §5.9. Public projection excludes storagePublicId.
const demoPhotoRecords = [
  { _id: 'photo-01', eventId: 'event-mehendi', imageUrl: imageUrls.lakeside, storagePublicId: 'demo/photo-01', uploadedByType: 'ADMIN', status: 'APPROVED', createdAt: '2027-11-22T12:15:00+05:30' },
  { _id: 'photo-02', eventId: 'event-sangeet', imageUrl: imageUrls.storyOne, storagePublicId: 'demo/photo-02', uploadedByType: 'MANAGER', status: 'APPROVED', createdAt: '2027-11-22T20:45:00+05:30' },
  { _id: 'photo-03', eventId: 'event-wedding', imageUrl: imageUrls.storyTwo, storagePublicId: 'demo/photo-03', uploadedByType: 'ADMIN', status: 'APPROVED', createdAt: '2027-11-23T18:10:00+05:30' },
  { _id: 'photo-04', eventId: 'event-reception', imageUrl: imageUrls.storyOne, storagePublicId: 'demo/photo-04', uploadedByType: 'MANAGER', status: 'APPROVED', createdAt: '2027-11-24T21:30:00+05:30' },
  { _id: 'photo-05', eventId: 'event-wedding', imageUrl: imageUrls.lakeside, storagePublicId: 'demo/photo-05', uploadedByType: 'ADMIN', status: 'APPROVED', createdAt: '2027-11-23T19:05:00+05:30' },
  { _id: 'photo-06', eventId: 'event-mehendi', imageUrl: imageUrls.storyTwo, storagePublicId: 'demo/photo-06', uploadedByType: 'MANAGER', status: 'APPROVED', createdAt: '2027-11-22T13:00:00+05:30' },
  { _id: 'photo-pending', eventId: 'event-sangeet', imageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=85', storagePublicId: 'demo/photo-pending', uploadedByType: 'GUEST', status: 'PENDING', createdAt: '2027-11-22T22:00:00+05:30' },
];

export const demoApprovedPhotos = demoPhotoRecords
  .filter((photo) => photo.status === 'APPROVED')
  .map(({ _id, eventId, imageUrl, uploadedByType, status, createdAt }) => ({
    _id,
    eventId,
    imageUrl,
    uploadedByType,
    status,
    createdAt,
  }));

const demoAnnouncementRecords = [
  { _id: 'announcement-01', title: 'Mehendi Soirée Timing', description: 'The Mehendi Soirée begins at 11:00 AM on the Crescent Lawn. We look forward to welcoming you.', status: 'PUBLISHED', publishedAt: '2027-10-15T09:00:00+05:30' },
  { _id: 'announcement-02', title: 'Valet Parking & Lakeside Seating', description: 'Valet parking will be available at the main gate. Golf carts will take guests to the Lakeside Promenade.', status: 'PUBLISHED', publishedAt: '2027-10-08T14:30:00+05:30' },
  { _id: 'announcement-draft', title: 'Unpublished planning note', description: 'This draft must not appear on the public website.', status: 'DRAFT', publishedAt: '2027-10-01T00:00:00+05:30' },
];

export const demoPublishedAnnouncements = demoAnnouncementRecords
  .filter((announcement) => announcement.status === 'PUBLISHED');

// Mirrors the public family RSVP response shape. This token and data are illustrative only.
export const demoFamilyRsvp = {
  familyName: 'The Singhania Family',
  wedding: { title: demoWedding.title, slug: demoWedding.slug },
  events: [
    { eventId: 'event-mehendi', name: demoEvents[0].name, eventDate: demoEvents[0].eventDate, status: 'UPCOMING', existingResponse: 'YES', canRespond: true },
    { eventId: 'event-sangeet', name: demoEvents[1].name, eventDate: demoEvents[1].eventDate, status: 'UPCOMING', existingResponse: 'YES', canRespond: true },
    { eventId: 'event-wedding', name: demoEvents[2].name, eventDate: demoEvents[2].eventDate, status: 'UPCOMING', existingResponse: null, canRespond: true },
    { eventId: 'event-reception', name: demoEvents[3].name, eventDate: demoEvents[3].eventDate, status: 'UPCOMING', existingResponse: 'NO', canRespond: true },
  ],
};

