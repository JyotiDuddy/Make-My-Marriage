# **Make My Marriage**

# **System Design & Architecture Document**

**Version:** 1.1  
**Status:** Updated Architecture Baseline  
**Related Documents:** PRD v1.1, Database Design v1.2, API Design v1.1  
**Architecture Style:** Modular Monolith  
**Frontend:** React.js  
**Backend:** Node.js \+ Express.js  
**Database:** MongoDB Atlas  
**Deployment:** GitHub Actions CI/CD

---

# **1\. Purpose**

This document defines the technical architecture of Make My Marriage.

It describes:

* Frontend and backend components.  
* Backend module responsibilities.  
* Database communication.  
* Authentication and authorization.  
* Public wedding website architecture.  
* Our Story content management.  
* Invitation and photo upload workflows.  
* YouTube video integration.  
* External services.  
* Security.  
* Testing and CI/CD deployment.

The architecture must implement the approved PRD without adding unnecessary infrastructure.

---

# **2\. Architecture Style**

## **2.1 Modular Monolith**

We will use a Modular Monolith Architecture.

The application consists of:

1. One React frontend application.  
2. One Node.js and Express backend application.  
3. One MongoDB database per environment.  
4. External services for image storage, email and video hosting.

The backend is logically divided into feature modules, but all modules run inside one Express application.

We will not use microservices for the MVP.

## **2.2 Why Modular Monolith?**

* Simpler development and deployment.  
* Clear separation of business responsibilities.  
* Easier testing and debugging.  
* No unnecessary service-to-service communication.  
* Appropriate for the current product scope.  
* Can be expanded later when justified by actual requirements.

---

# **3\. High-Level System Architecture**

```
flowchart TB
    ADMIN["Admin"]
    MANAGER["Wedding Manager"]
    GUEST["Wedding Guest"]

    subgraph FRONTEND["React Application"]
        REACT["React App"]
        PRIVATE["Private Management Dashboard"]
        PUBLIC["Public Wedding Website"]

        REACT --> PRIVATE
        REACT --> PUBLIC
    end

    ADMIN --> REACT
    MANAGER --> REACT
    GUEST --> REACT

    subgraph BACKEND["Express Application"]
        API["REST API Layer"]
        AUTH["Authentication"]
        PERM["Authorization"]
        MODULES["Business Modules"]
        SERVICES["Service Layer"]

        API --> AUTH
        AUTH --> PERM
        PERM --> MODULES
        MODULES --> SERVICES
    end

    REACT <-->|"HTTPS / JSON"| API

    subgraph DATA["Data Layer"]
        DB[("MongoDB Atlas")]
    end

    SERVICES <-->|"Mongoose"| DB

    subgraph EXTERNAL["External Services"]
        EMAIL["Email Provider"]
        CLOUD["Cloudinary"]
        YOUTUBE["YouTube"]
        MAPS["Google Maps"]
        WHATSAPP["WhatsApp Share Links"]
    end

    SERVICES --> EMAIL
    SERVICES --> CLOUD
    REACT --> YOUTUBE
    REACT --> MAPS
    REACT --> WHATSAPP
```

---

# **4\. User Access Architecture**

## **4.1 Admin**

The admin:

* Registers and logs in.  
* Creates one wedding.  
* Invites one designated manager.  
* Manages wedding settings and Our Story.  
* Manages events, tasks, expenses and guest records.  
* Uploads invitations.  
* Publishes the website.  
* Approves guest-submitted photographs.

## **4.2 Manager**

The manager:

* Activates through an invitation email.  
* Logs in.  
* Manages events, tasks, expenses and guests.  
* Uploads invitation cards.  
* Views RSVPs.  
* Manages announcements.  
* Uploads photographs.

The manager cannot edit Our Story, publish the wedding website, change ownership or approve guest-submitted photographs.

## **4.3 Guest**

Guests:

* Do not have application accounts.  
* Visit the public wedding website.  
* View published wedding information.  
* View the couple's story.  
* View published events and invitation cards.  
* Watch embedded YouTube videos.  
* Submit family-based RSVP responses through a secure token.  
* Submit photographs through a public upload link.

---

# **5\. Frontend Architecture**

## **5.1 Technology**

* React.js.  
* React Router.  
* Tailwind CSS.  
* Redux Toolkit or Context API where appropriate.  
* Axios or Fetch API.

## **5.2 Frontend Structure**

We will maintain one React application with two main route groups.

### **A. Private Dashboard**

| Feature | Responsibility |
| ----- | ----- |
| Authentication | Registration, login, manager activation |
| Dashboard | Wedding overview and statistics |
| Events & Tasks | Events, menus, venues and shared tasks |
| Expenses | Actual expense management |
| Guest Management | Family records and CSV import |
| Invitations & RSVP | Invitation cards, sharing and RSVP records |
| Wedding Website | Wedding profile, Our Story, website content and publication |
| Wedding Memories | Photo uploads and approval |

### **B. Public Wedding Website**

The public website is designed for guests.

It contains:

1. Hero section.  
2. Wedding countdown.  
3. Our Story.  
4. Published wedding events.  
5. Food menus and directions.  
6. Event invitations.  
7. Secure RSVP experience.  
8. Approved wedding gallery.  
9. Event YouTube videos.  
10. Published announcements.  
11. Footer.

The public website has one fixed Warm Editorial Luxury theme in the MVP.

The frontend contains the visual design and reusable components. Wedding-specific content is fetched from the backend.

No theme selector or product marketing sections are required.

## **5.3 Frontend Route Structure**

```
/
├── login
├── activate-manager/:token
│
├── dashboard
├── events
├── tasks
├── expenses
├── guests
├── invitations
├── rsvp
├── website-management
│   └── our-story
└── memories
│
└── wedding/:slug
    ├── rsvp/:token
    └── photos/submit
```

The public wedding website is separate from the private dashboard in layout and access, but both use the same React application.

---

# **6\. Wedding Website Architecture**

The public wedding website is a guest-facing digital wedding experience.

It must not look like a software marketing homepage.

## **6.1 Fixed Visual Design**

The MVP uses one visual theme:

**Warm Editorial Luxury**

Design characteristics:

* Warm ivory background.  
* Deep forest green.  
* Muted neutral accents.  
* Elegant serif headings.  
* Clean sans-serif body typography.  
* Large couple photography.  
* Spacious layouts.  
* Subtle animations.  
* Mobile-first responsive design.

These rules are implemented through the React design system, not stored as a theme selection in MongoDB.

## **6.2 Public Website Component Structure**

```
flowchart TD
    W["Public Wedding Website"]

    W --> HERO["Hero"]
    W --> COUNT["Countdown"]
    W --> STORY["Our Story"]
    W --> EVENTS["Wedding Celebrations"]
    W --> RSVP["Family RSVP"]
    W --> MEM["Wedding Memories"]
    W --> ANN["Announcements"]
    W --> FOOTER["Footer"]

    EVENTS --> MENU["Event Food Menus"]
    EVENTS --> CARD["Invitation Cards"]
    EVENTS --> MAP["Venue Directions"]
    EVENTS --> VIDEO["YouTube Video Player"]

    STORY --> DESCRIPTION["Couple Story Description"]
    STORY --> IMAGE1["Supporting Photo 1"]
    STORY --> IMAGE2["Supporting Photo 2"]

    MEM --> GALLERY["Approved Photo Gallery"]
```

## **6.3 Hero Section**

Displays:

* Couple's names.  
* Hero/cover photograph.  
* Short wedding introduction.  
* Wedding date.  
* Countdown.

The hero image is managed through the Wedding collection.

## **6.4 Our Story Section**

This is a new explicit component of the public website architecture.

The admin can manage:

* Couple's story description.  
* Up to two supporting photographs.

The content belongs to the Wedding document.

The Our Story UI component fetches the content through the public Wedding API.

### **Content Flow**

```
flowchart TD
    ADMIN["Admin Dashboard"]
    EDITOR["Our Story Editor"]
    API["Wedding API"]
    SERVICE["Wedding Service"]
    CLOUD["Cloudinary"]
    DB[("MongoDB Wedding Document")]

    ADMIN --> EDITOR
    EDITOR --> API
    API --> SERVICE
    SERVICE --> CLOUD
    CLOUD --> SERVICE
    SERVICE --> DB
```

### **Behaviour**

* Admin edits the story description.  
* Admin uploads up to two photographs.  
* Backend validates the image files.  
* Cloudinary stores the image files.  
* MongoDB stores the image URL, storage ID and alt text.  
* Public Website API returns the published story.  
* React renders the Our Story section.

The section is hidden when both the description and supporting image array are empty.

The two supporting images are different from guest-submitted Wedding Memories photographs.

---

# **7\. Backend Architecture**

## **7.1 Technology**

* Node.js.  
* Express.js.  
* Mongoose.  
* REST APIs.

## **7.2 Layered Architecture**

The backend will follow:

1. Routes.  
2. Middleware.  
3. Validators.  
4. Controllers.  
5. Services.  
6. Models.

```
flowchart TD
    CLIENT["React Request"]
    ROUTE["Express Route"]
    AUTH["Authentication"]
    PERM["Authorization"]
    VALIDATE["Request Validator"]
    CONTROLLER["Controller"]
    SERVICE["Service Layer"]
    MODEL["Mongoose Model"]
    DB[("MongoDB")]

    CLIENT --> ROUTE
    ROUTE --> AUTH
    AUTH --> PERM
    PERM --> VALIDATE
    VALIDATE --> CONTROLLER
    CONTROLLER --> SERVICE
    SERVICE --> MODEL
    MODEL --> DB
```

Controllers handle HTTP requests and responses.

Services implement business rules and coordinate operations.

Models define database structures.

Validators check incoming request data.

---

# **8\. Backend Modules**

| Module | Responsibility | PRD |
| ----- | ----- | ----- |
| Auth | Registration, login, manager activation | FR-01 |
| Wedding | Wedding setup and configuration | FR-01 |
| Dashboard | Dashboard statistics | FR-02 |
| Events | Events, food menus, venues and YouTube video metadata | FR-03 |
| Tasks | Shared task management | FR-03 |
| Expenses | Actual expense management | FR-04 |
| Guests | Family-based guest management | FR-05 |
| Invitations | Common and event invitation uploads | FR-06 |
| RSVP | Secure family-based RSVP | FR-06 |
| Website | Public wedding website content | FR-07 |
| Announcements | Wedding updates | FR-08 |
| Photos | Guest photo submission and approval | FR-09 |

Our Story is part of the Wedding module and Wedding Website Management functionality. It does not require another module or collection.

## **8.1 Our Story Backend Responsibilities**

The Wedding module will provide:

* Update story description.  
* Upload supporting photograph.  
* Validate the maximum of two images.  
* Delete supporting photograph.  
* Coordinate Cloudinary operations.  
* Return public story content.

Only the admin can modify Our Story.

The public website service reads Our Story through the Wedding document.

## **8.2 Module Communication**

Modules communicate through service functions within the same Express application.

Examples:

* Dashboard service reads Events, Expenses, Guests, RSVP and Tasks.  
* RSVP service checks Guest and Event.  
* Website service reads published Wedding, Event, Announcement and Photo data.  
* Invitation service manages card uploads.  
* Wedding service manages cover image and Our Story assets.

There are no separate microservices or internal HTTP calls between modules.

---

# **9\. Database Architecture**

The application uses ten primary collections:

1. User.  
2. Wedding.  
3. Event.  
4. Task.  
5. Expense.  
6. Guest.  
7. RSVP.  
8. Invitation.  
9. Photo.  
10. Announcement.

## **9.1 Our Story Database Integration**

Our Story is embedded inside Wedding:

```
Wedding
  |
  |-- partnerOneName
  |-- partnerTwoName
  |-- weddingDate
  |-- introduction
  |-- coverImage
  |
  |-- ourStory
       |
       |-- description
       |
       |-- images[]
            |-- imageId
            |-- url
            |-- publicId
            |-- altText
```

Maximum supporting images: two.

No separate OurStory collection is required.

## **9.2 Other Data Relationships**

* One admin owns one wedding.  
* One wedding has one designated manager.  
* One wedding has multiple events, tasks, expenses, guests, photos and announcements.  
* A family can be invited to multiple events.  
* A family has one RSVP per invited event.  
* Event food menus are embedded inside Event.  
* Common and event invitation cards are stored in Invitation.  
* Event video metadata is embedded inside Event.

All private records are scoped to the correct `weddingId`.

---

# **10\. Authentication and Authorization Architecture**

## **10.1 Authentication**

We will use secure server-side sessions.

Session properties:

* HTTP-only cookie.  
* Secure cookie in production.  
* Appropriate SameSite configuration.  
* Session regeneration after login.  
* Session invalidation on logout.  
* MongoDB-backed session storage.

Cookie-authenticated state-changing requests will use CSRF protection.

## **10.2 Role Permissions**

Admin-only operations:

* Create wedding.  
* Update wedding settings.  
* Update Our Story.  
* Publish or unpublish website.  
* Invite or replace the designated manager.  
* Approve or reject guest photographs.

Admin and manager operations:

* Manage events.  
* Manage tasks.  
* Manage expenses.  
* Manage guests.  
* Upload invitation cards.  
* Manage announcements.  
* Upload organiser photographs.

Guest operations:

* Public website viewing.  
* Token-based family RSVP.  
* Public photo submission.

The backend is the final authority for all permissions.

## **10.3 Wedding Data Isolation**

The backend derives the wedding context from authenticated identity.

* Admin: resolve Wedding through `adminId`.  
* Manager: resolve Wedding through `managerId`.  
* Guest RSVP: resolve family and wedding through the validated RSVP token.

Client-provided `weddingId` must never be trusted for authorization.

---

# **11\. External Services Architecture**

| Service | Purpose |
| ----- | ----- |
| Cloudinary | Store invitation cards, couple photographs and gallery images |
| Email provider | Manager activation and password reset |
| WhatsApp | Prefilled manual invitation sharing |
| Google Maps | External venue directions |
| YouTube | Live and recorded video hosting |
| MongoDB Atlas | Managed database |

## **11.1 Image Storage**

Image files are stored in Cloudinary.

MongoDB stores:

* Image URL.  
* Cloudinary public ID.  
* Alt text where relevant.  
* Other required metadata.

This applies to:

* Wedding cover image.  
* Our Story photographs.  
* Invitation cards.  
* Wedding Memories photographs.

## **11.2 YouTube Videos**

The actual videos are hosted by YouTube.

MongoDB stores the Event video object:

* Video type.  
* Provider.  
* URL.  
* Video ID.

React constructs an embedded YouTube player.

No video file is uploaded to Make My Marriage.

---

# **12\. Our Story Image Upload Architecture**

## **Upload Flow**

```
flowchart TD
    A["Admin opens Our Story Editor"]
    B["Selects supporting photograph"]
    C["React sends multipart request"]
    D["Express authenticates admin"]
    E["Validate image and two-image limit"]
    F["Upload image to Cloudinary"]
    G["Receive image URL and public ID"]
    H["Update Wedding.ourStory.images"]
    I["Return updated story"]
    J["React displays image preview"]

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J
```

## **Deletion Flow**

1. Admin selects a supporting photograph to remove.  
2. Backend verifies admin permissions.  
3. Backend finds the image by its embedded image ID.  
4. Backend updates the Wedding document to remove the image reference.  
5. After database update succeeds, backend deletes the Cloudinary asset.  
6. Frontend refreshes the story preview.

If Cloudinary deletion fails after the database update, the failure must be logged and handled through a cleanup operation. The public website should no longer reference the removed image.

## **Limits**

* Maximum two Our Story photographs.  
* JPEG, PNG and WebP.  
* Proposed maximum file size: 10 MB per image.  
* No guest uploads in Our Story.  
* Only admin edits Our Story.

---

# **13\. Public Website Data Architecture**

The public website reads published information through dedicated public APIs.

The API response is constructed from allowed fields, not by returning complete MongoDB documents.

## **Public Content**

* Wedding names and introduction.  
* Cover image.  
* Our Story description and supporting photographs.  
* Published events.  
* Food menus.  
* Venue information and Maps links.  
* Invitation card image URLs.  
* YouTube video metadata.  
* Published announcements.  
* Approved gallery photographs.

## **Private Content**

Never expose:

* Admin or manager account details.  
* Guest contact information.  
* Private family notes.  
* Other families' RSVP records.  
* Draft announcements.  
* Pending or rejected images.  
* Internal Cloudinary credentials.  
* Authentication tokens.

Our Story and all other wedding content are returned only when the wedding website is published.

Family RSVP access remains separate from website publication.

---

# **14\. File and Video Integration**

## **14.1 Invitation Cards**

Admin or manager designs cards externally using Canva.

The card is downloaded and uploaded through the React frontend.

Express validates the file, uploads it to Cloudinary and stores its metadata in Invitation.

One common card per wedding and one event-specific card per event.

## **14.2 Our Story Photographs**

Only the admin can manage the story description and supporting images.

The two-photo maximum is enforced in the backend service.

## **14.3 Wedding Gallery**

Admin and manager photographs are approved automatically.

Guest submissions start as PENDING.

Only admin can approve or reject guest submissions.

## **14.4 YouTube Video**

Events support LIVE or RECORDED YouTube URLs.

The backend validates the URL and extracts the video ID.

React displays the embedded player.

We do not host video files ourselves.

---

# **15\. Error Handling and Logging**

Centralised Express error handling will manage:

* Validation errors.  
* Authentication failures.  
* Authorization errors.  
* Missing resources.  
* Duplicate records.  
* Database failures.  
* Cloudinary failures.  
* Email failures.  
* Unexpected server errors.

Logs must not include raw passwords, session identifiers, invitation tokens or private guest details.

Our Story upload failures must not leave broken image references in MongoDB.

---

# **16\. Deployment Architecture**

| Component | Hosting |
| ----- | ----- |
| Frontend | Vercel or Netlify |
| Backend | Render or equivalent Node.js hosting |
| Database | MongoDB Atlas |
| Images | Cloudinary |
| Source code | GitHub |
| CI/CD | GitHub Actions |

Environments:

* Development.  
* Staging.  
* Production.

Each environment uses separate database configuration and secrets.

---

# **17\. CI/CD Architecture**

We will use GitHub Actions.

## **Continuous Integration**

On push or pull request:

1. Checkout source.  
2. Install dependencies.  
3. Run ESLint.  
4. Run frontend tests.  
5. Run backend tests.  
6. Run API integration tests.  
7. Build React application.  
8. Validate backend.

Failed checks block merging into protected branches.

## **Continuous Deployment**

**Staging:**

Successful merge into `develop` triggers staging deployment and health checks.

**Production:**

An approved release to `main` triggers production deployment.

Production secrets remain separate from staging secrets.

Database deployment must not automatically reset or delete production data.

---

# **18\. Testing Architecture**

We will test:

* Authentication.  
* Role permissions.  
* Wedding data isolation.  
* Event and task operations.  
* Expense operations.  
* Family invitation and RSVP.  
* Invitation uploads.  
* Our Story editing.  
* Our Story image upload limit.  
* Public website privacy.  
* Photo approval.  
* YouTube video URL validation and embedding data.  
* Cloudinary failure handling.  
* Production health checks.

Important Our Story tests:

1. Admin can update description.  
2. Manager cannot edit Our Story.  
3. Admin can upload the first photograph.  
4. Admin can upload the second photograph.  
5. Third photograph is rejected.  
6. Removing a photograph removes its reference.  
7. Public API returns story content only for a published wedding.  
8. Public API returns no Cloudinary management credentials.  
9. Removing Our Story content hides the section on the frontend.

---

# **19\. Repository Structure**

```
MakeMyMarriage/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── store/
│   │   └── utils/
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── wedding/
│   │   │   ├── dashboard/
│   │   │   ├── events/
│   │   │   ├── tasks/
│   │   │   ├── expenses/
│   │   │   ├── guests/
│   │   │   ├── invitations/
│   │   │   ├── rsvp/
│   │   │   ├── website/
│   │   │   ├── announcements/
│   │   │   └── photos/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   └── package.json
│
├── docs/
│   ├── PRD.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── DATABASE_DESIGN.md
│   ├── API_DOCUMENTATION.md
│   ├── USER_STORIES.md
│   ├── BUSINESS_RULES.md
│   ├── TESTING_STRATEGY.md
│   └── AI_DEVELOPMENT_LOG.md
│
└── .github/
    └── workflows/
        ├── ci.yml
        ├── deploy-staging.yml
        └── deploy-production.yml
```

---

# **20\. Final Architecture Decisions**

| Area | Decision |
| ----- | ----- |
| Architecture | Modular monolith |
| Frontend | One React application |
| Backend | One Express application |
| Database | MongoDB Atlas |
| Primary collections | 10 |
| Frontend visual theme | One fixed Warm Editorial Luxury theme |
| Public wedding site | Guest-facing React route |
| Our Story | Embedded Wedding content |
| Supporting Our Story images | Maximum two |
| Story image hosting | Cloudinary |
| Invitation design | External Canva upload workflow |
| Video hosting | YouTube |
| Video types | LIVE and RECORDED |
| Video playback | Embedded YouTube player |
| RSVP | Secure family invitation token |
| Authentication | Secure server-side sessions |
| Deployment | GitHub Actions CI/CD |

**Architecture principle:** Every component must support a requirement in the PRD or a necessary technical concern. Our Story is implemented within the existing Wedding module and does not require additional infrastructure.

