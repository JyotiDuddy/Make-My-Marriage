# **Make My Marriage**

# **Product Requirements Document (PRD)**

**Version:** 1.1  
**Status:** Updated MVP Requirements  
**Product:** Wedding Management Platform  
**Technology:** MERN Stack  
**Primary Market:** Indian Weddings

## **1\. Product Overview**

### **1.1 Product Description**

Make My Marriage is a web-based wedding management platform that helps couples and their designated wedding managers organise wedding events, guests, invitations, RSVPs, expenses, tasks, announcements and wedding memories.

The platform provides two connected experiences:

1. **Private Management Dashboard:** An authenticated workspace used by the admin and designated manager to manage wedding operations.  
2. **Public Wedding Website:** A personalised, shareable website where guests can explore the couple's wedding information, read their story, view event schedules, access invitations, submit RSVPs, view approved photographs and watch available videos.

The public wedding website is designed as a digital wedding invitation and guest experience, not as a marketing or software sales page.

### **1.2 Problem Statement**

Wedding information is often scattered across WhatsApp conversations, spreadsheets, phone calls and separate applications.

This makes it difficult to coordinate events, manage family invitations, collect RSVPs, track expenses and share updated information with guests.

Make My Marriage brings these activities together in one platform.

### **1.3 Product Vision**

To provide a simple, elegant and centralised wedding management platform that helps organisers coordinate wedding operations and gives guests a beautiful digital wedding experience.

---

## **2\. Product Goals**

The MVP should:

1. Allow an admin to create and manage one wedding.  
2. Allow the admin to invite one designated manager.  
3. Provide a central dashboard for wedding operations.  
4. Manage multiple wedding events and shared tasks.  
5. Maintain family-based guest records.  
6. Manage one common wedding invitation and separate event invitation cards.  
7. Collect secure, event-wise family RSVPs.  
8. Track actual wedding expenses.  
9. Provide a personalised public wedding website.  
10. Allow the admin to manage the couple's story and supporting photographs.  
11. Support event-specific YouTube Live and recorded videos.  
12. Provide a photo gallery with an approval workflow.  
13. Support AI-assisted software development throughout the development lifecycle.

---

## **3\. Target Users**

### **3.1 Wedding Admin**

The admin is the wedding owner or primary organiser.

Responsibilities:

* Create and configure the wedding.  
* Invite the designated manager.  
* Manage wedding details and website content.  
* Manage events, tasks, expenses and guests.  
* Upload invitation cards.  
* View and manage RSVP responses.  
* Publish and unpublish the wedding website.  
* Approve or reject guest photo submissions.

### **3.2 Wedding Manager**

The manager assists the admin with wedding operations.

Responsibilities:

* Manage events and tasks.  
* Add and update expenses.  
* Manage guest records and invitation-sharing status.  
* View RSVP responses.  
* Upload invitation cards.  
* Upload wedding photographs.  
* Manage announcements.

The manager cannot change wedding ownership, invite another manager, publish or unpublish the website, or approve/reject guest-submitted photographs.

### **3.3 Wedding Guest**

Guests do not require an account or login.

They can:

* Visit the public wedding website.  
* View the couple's introduction and story.  
* View wedding events and schedules.  
* View event invitation cards and food menus.  
* Open venue directions.  
* Submit event-wise family RSVPs through a secure link.  
* View published announcements.  
* View approved wedding photographs.  
* Watch available YouTube videos directly on the website.  
* Submit photographs through the public upload link.

---

## **4\. User Roles and Permissions**

| Feature | Admin | Manager | Guest |
| ----- | ----- | ----- | ----- |
| Create wedding | Yes | No | No |
| Invite manager | Yes | No | No |
| Manage wedding details | Yes | No | No |
| Manage Our Story | Yes | No | No |
| Manage events | Yes | Yes | No |
| Manage tasks | Yes | Yes | No |
| Manage expenses | Yes | Yes | No |
| Manage guests | Yes | Yes | No |
| Upload invitation cards | Yes | Yes | No |
| View RSVP responses | Yes | Yes | Own family only |
| Publish website | Yes | No | No |
| Manage announcements | Yes | Yes | No |
| Upload photographs | Yes | Yes | Yes |
| Approve guest photographs | Yes | No | No |
| Watch public videos | Yes | Yes | Yes |
| Delete wedding | Yes, subject to safe deletion | No | No |

---

## **5\. Product Structure**

### **5.1 Private Dashboard**

The dashboard contains seven primary sections:

1. Dashboard  
2. Events & Tasks  
3. Expense Tracker  
4. Guest Management  
5. Invitations & RSVP  
6. Wedding Website  
7. Wedding Memories

Our Story editing, wedding introduction, photographs, publication controls and website content management are part of Wedding Website Management.

Food menus, venue directions and event videos are managed within Events.

### **5.2 Public Wedding Website**

The public website uses one fixed visual design for the current MVP.

**Visual direction:** Warm Editorial Luxury.

Design characteristics:

* Warm ivory backgrounds.  
* Deep forest green and restrained neutral accents.  
* Elegant serif headings.  
* Clean sans-serif body typography.  
* Spacious editorial layouts.  
* Large couple photography.  
* Subtle animations.  
* Responsive desktop and mobile layouts.

There is no theme selector or multiple-theme system in the MVP. The design is implemented in React and is not stored as a user-selectable database setting.

The website is personalised through the couple's names, photographs, introduction, story, events and other wedding information.

---

## **6\. Functional Requirements**

### **FR-01: Authentication and Wedding Setup**

The platform must support secure authentication for an admin and one designated manager.

Admin features:

* Register.  
* Log in and log out.  
* Reset password.  
* Create one wedding.  
* Update wedding details.

Wedding information:

* Couple's names.  
* Wedding title.  
* Wedding date.  
* Timezone.  
* Short wedding introduction.  
* Couple's hero/cover photograph.  
* Public website slug.  
* Website publication status.

Manager onboarding:

1. Admin enters the manager's name and email.  
2. System generates a secure activation link.  
3. Email provider sends the activation link.  
4. Manager opens the link and sets a password.  
5. Manager can log in.

The activation link must be secure, expiring and single-use.

### **FR-02: Dashboard**

The dashboard provides:

* Total events.  
* Upcoming events.  
* Total actual expenses.  
* Total family records.  
* Accepted RSVP count.  
* Pending RSVP count.  
* Upcoming task deadlines.  
* Recent record updates.

Guest count represents family invitation records, not individual people.

### **FR-03: Events and Tasks Management**

#### **A. Event Management**

The admin and manager can manage multiple wedding events, such as:

* Haldi.  
* Mehendi.  
* Sangeet.  
* Cocktail.  
* Wedding Ceremony.  
* Reception.

Event fields:

* Event name.  
* Event date.  
* Start time.  
* End time.  
* Venue name.  
* Venue address.  
* Google Maps URL.  
* Description.  
* Embedded food menu.  
* Event status.  
* Publication status.  
* Optional YouTube video.

Event status:

* Upcoming.  
* Completed.  
* Cancelled.

Existing RSVP records must be preserved when an event is cancelled.

#### **B. Food Menu**

Each event can have categories and multiple food items.

Example:

Haldi:

* Breakfast: Aloo Paratha, Curd, Tea.  
* Snacks: Samosa, Juice.

Food menus are embedded inside Event. Separate food preference or meal selection functionality is excluded.

#### **C. Venue Directions**

The organiser can store a Google Maps URL against the event.

Guests click Get Directions to open Google Maps.

No Maps API or embedded map is required.

#### **D. Task Management**

Tasks are shared between admin and manager.

Task fields:

* Title.  
* Description.  
* Optional event.  
* Deadline.  
* Priority.  
* Status.  
* Created by.

Priority: Low, Medium, High.

Status: To Do, In Progress, Completed.

No individual task assignment system is included.

#### **E. Event Videos**

Each event can have one optional YouTube video.

Supported types:

1. LIVE — YouTube Live broadcast.  
2. RECORDED — Existing prerecorded YouTube video.

The admin or manager enters the video type and YouTube URL.

The backend validates the URL and extracts the video ID.

Guests must be able to play the actual video directly on the public wedding website through an embedded YouTube player.

The application stores only the video URL and video ID. It does not upload or host the video file.

When an event has no video, its video section is hidden.

No custom streaming infrastructure or YouTube Data API integration is required for the MVP.

### **FR-04: Expense Tracker**

Records actual expenses only.

Fields:

* Expense title.  
* Category.  
* Amount.  
* Payment date.  
* Payment method.  
* Optional event.  
* Notes.  
* Created by.

Categories include catering, decoration, photography, venue, clothing, transportation, entertainment and miscellaneous.

The MVP does not include budget planning, budget allocation, forecasting or budget-versus-actual reporting.

### **FR-05: Guest Management**

Guest records represent families.

Fields:

* Family name.  
* Primary contact name (optional).  
* Mobile number.  
* Email (optional).  
* Family group information (optional).  
* Notes (optional).  
* Invited events.  
* Invitation-sharing status.

Features:

* Create and update family records.  
* Search and filter.  
* CSV import.  
* Duplicate mobile-number detection.

Individual family-member records are excluded.

Private guest contact information must never be publicly accessible.

### **FR-06: Invitations and RSVP**

#### **A. Invitation Cards**

The platform supports:

* One common wedding invitation.  
* Separate invitation cards for individual events.

Cards are created externally using Canva or similar design software.

Workflow:

1. Admin or manager designs the card.  
2. Downloads it as PNG, JPG or WebP.  
3. Uploads it through the frontend.  
4. Backend validates the file.  
5. Cloudinary stores the actual image.  
6. MongoDB stores its metadata.

One card can be reused for multiple families.

The platform does not generate a personalised card for every family or include an in-app invitation designer.

#### **B. WhatsApp Sharing**

The system creates prefilled WhatsApp messages containing invitation information and the relevant family RSVP link.

The organiser manually sends the message.

The system may record that the organiser marked the invitation as shared. This does not prove message delivery or reading.

#### **C. RSVP**

RSVP is family-based and event-specific.

Available responses:

* Yes.  
* No.

Rules:

* One family can be invited to multiple events.  
* One family has one current response per invited event.  
* Responses can be updated through a valid secure family link.  
* Guests cannot respond to events they were not invited to.  
* Guests do not need accounts.

One unique, unguessable family token covers all events to which that family is invited.

### **FR-07: Public Wedding Website**

#### **A. Hero Section**

Displays:

* Couple's names.  
* Hero photograph.  
* Short welcome/introduction.  
* Wedding date and location.  
* Wedding countdown.

The hero photograph is managed separately from Our Story supporting photographs.

#### **B. Our Story**

The website must include an optional **Our Story** section.

The admin can manage:

* A couple's story/description.  
* Up to two supporting photographs.

The story describes the couple's journey and provides a personal introduction to guests.

Each supporting photograph is uploaded through the dashboard and stored in Cloudinary.

MongoDB stores:

* Image URL.  
* Cloudinary public ID.  
* Alt text.  
* Image identifier.

The two photographs are embedded inside the Wedding document as part of the `ourStory` object.

The Our Story section is displayed only when a story description or supporting photograph exists.

The section is not mandatory for publication.

#### **C. Event Schedule**

Displays published events with:

* Event name.  
* Date and time.  
* Venue.  
* Description.  
* Food menu, when available.  
* Event invitation card, when available.  
* Get Directions link, when available.  
* YouTube embedded video, when available.

#### **D. RSVP**

Guests use their secure family-specific RSVP link to respond to invited events.

The ordinary public website must not expose family contact information or RSVP details belonging to other families.

#### **E. Announcements**

Only published announcements are shown.

#### **F. Wedding Gallery**

Only admin-approved photographs are displayed.

#### **G. Video Experience**

If an event has a YouTube video:

* LIVE videos show the embedded YouTube Live player.  
* RECORDED videos show the embedded recorded video player.

Guests can watch directly on the wedding website.

#### **H. Website Publication**

Admin can preview, publish and unpublish the website.

Unpublishing the website does not automatically revoke secure family RSVP links.

### **FR-08: Announcements**

Admin and manager can:

* Create announcements.  
* Edit announcements.  
* Delete announcements.  
* Publish or unpublish announcements.

Only published announcements appear on the public website.

### **FR-09: Wedding Memories**

Admin and manager can upload photographs.

Guests can submit photographs through the public photo submission link.

Guest submissions start as Pending.

Only admin can approve or reject guest submissions.

Only approved images are publicly displayed.

### **FR-10: YouTube Video Integration**

Event videos are stored in the Event document.

Fields:

* `videoType`: LIVE or RECORDED.  
* `provider`: YOUTUBE.  
* `url`: YouTube URL.  
* `videoId`: Extracted video identifier.

Video content is hosted by YouTube and played through an embedded player.

No video collection or custom video hosting is required.

### **FR-11: Basic Record Tracking**

Applicable records may include:

* `createdBy`.  
* `updatedBy`.  
* `createdAt`.  
* `updatedAt`.

This is basic record metadata, not a full activity-history module.

---

## **7\. Public Website Page Structure**

The guest-facing wedding homepage should follow this structure:

1. **Hero:** Couple's names, hero photograph, welcome message, wedding date.  
2. **Countdown:** Time remaining until the wedding.  
3. **Our Story:** Couple's story and up to two supporting photographs.  
4. **Wedding Celebrations:** Published event cards and details.  
5. **RSVP:** Accessed through a secure family-specific link.  
6. **Wedding Memories:** Approved photographs and available event videos.  
7. **Announcements:** Published updates, when available.  
8. **Footer:** Couple's names, wedding date and optional product attribution.

This is a guest experience, not the Make My Marriage software marketing homepage.

A generic product FAQ, software feature promotions, dashboard screenshots, marketing value propositions and sales CTAs are not part of this page.

### **Conditional Display Rules**

| Section/content | Display condition |
| ----- | ----- |
| Hero | Wedding is published |
| Countdown | Wedding date exists |
| Our Story | Story text or supporting images exist |
| Events | Published events exist |
| Food menu | Event has menu items |
| Directions | Google Maps URL exists |
| Invitation card | Card exists |
| RSVP | Guest has valid family RSVP link |
| Gallery | Approved photographs exist |
| Video | Event has valid YouTube video information |
| Announcements | Published announcements exist |

---

## **8\. Non-Functional Requirements**

### **Security**

* Secure password hashing.  
* HTTP-only session cookies.  
* CSRF protection for authenticated state-changing requests.  
* Role-based authorization.  
* Wedding-level data isolation.  
* Hashed activation and RSVP tokens.  
* Private guest information must not be exposed publicly.  
* File validation.  
* Public upload rate limits.

### **Performance**

* Pagination for large lists.  
* Optimised image delivery.  
* Efficient database queries.  
* Avoid unnecessary data duplication.  
* Responsive public website.

### **Usability**

* Mobile-first guest experience.  
* Clear event information.  
* Readable typography.  
* Accessible image descriptions.  
* Simple navigation.  
* Meaningful empty states.  
* Conditional display of optional sections.

### **Reliability**

* Consistent API responses.  
* Centralised error handling.  
* Duplicate RSVP prevention.  
* Safe image replacement.  
* Preservation of important records.  
* Automated tests.

---

## **9\. MVP Scope**

The MVP includes:

* Admin and manager authentication.  
* One wedding per admin.  
* One designated manager.  
* Dashboard.  
* Multiple events.  
* Embedded food menus.  
* Google Maps directions.  
* YouTube Live and recorded video embedding.  
* Shared task management.  
* Actual expense tracking.  
* Family-based guest management.  
* CSV guest import.  
* Common and event-specific invitation card uploads.  
* WhatsApp share links.  
* Secure family RSVP.  
* Public wedding website.  
* Couple's Our Story section with up to two supporting images.  
* Wedding countdown.  
* Announcements.  
* Guest photo submission and admin approval.  
* Cloudinary image storage.  
* CI/CD deployment workflow.

---

## **10\. Features Excluded from MVP**

* Multiple weddings per admin.  
* Multiple managers.  
* Event-specific manager assignments.  
* Individual guest accounts.  
* Individual family-member attendance tracking.  
* Personalised invitation card generation.  
* In-app invitation designer.  
* Automated WhatsApp delivery.  
* WhatsApp read receipts.  
* Budget planning or forecasting.  
* Task assignment to individuals.  
* Full activity-history module.  
* Food preference selection.  
* Custom livestream infrastructure.  
* Direct video hosting.  
* AI-generated videos inside the application.  
* AI chatbot.  
* Multiple selectable wedding website themes.  
* Guest-facing software FAQ or product marketing sections.

---

## **11\. AI-Assisted Development Strategy**

AI will support:

* Product planning.  
* User stories.  
* Architecture.  
* Database design.  
* API contracts.  
* UI/UX exploration.  
* Development and debugging.  
* Test-case creation.  
* Code review.  
* Deployment documentation.

We will maintain `AI_DEVELOPMENT_LOG.md` documenting prompts, suggestions, accepted decisions, rejected suggestions and test results.

---

## **12\. Final Product Definition**

Make My Marriage combines a private wedding management dashboard with a personalised public wedding website.

The admin and manager coordinate the wedding privately.

Guests experience the couple's celebration through an elegant, mobile-friendly digital wedding invitation containing their story, events, invitations, RSVP access, venue details, approved memories and available videos.

The public website is designed to celebrate the couple, not to advertise the software.

**Product principle: Every wedding detail, thoughtfully organised and beautifully shared.**

