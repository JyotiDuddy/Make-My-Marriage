# **Make My Marriage**

# **Database Design Document**

**Version:** 1.2  
**Status:** Updated MVP Database Design  
**Related Documents:** PRD v1.1, System Architecture v1.1, API Design v1.1  
**Database:** MongoDB Atlas  
**ODM:** Mongoose

---

# **1\. Purpose**

This document defines the database structure for Make My Marriage.

It covers:

* Database collections.  
* Entity relationships.  
* Mongoose document structures.  
* Field types and validation.  
* Data ownership and isolation.  
* Indexes and unique constraints.  
* Manager activation and password reset.  
* Family-based RSVP token management.  
* Invitation card storage.  
* Our Story content and supporting photographs.  
* YouTube video information.  
* Record lifecycle and deletion rules.

The design must remain consistent with the approved PRD.

## **1.1 Database Design Principles**

1. Every private wedding record must belong to a specific wedding.  
2. Use references for independently managed records.  
3. Embed data when it naturally belongs to a parent document.  
4. Use indexes to prevent duplicate records.  
5. Protect private guest information.  
6. Validate relationships in the service layer.  
7. Store image files in Cloudinary, not MongoDB.  
8. Store video metadata, not video files.  
9. Avoid unnecessary collections.  
10. Preserve important relationships when records are deleted.

---

# **2\. Database Technology**

| Technology | Purpose |
| ----- | ----- |
| MongoDB Atlas | Managed database |
| Mongoose | Object Data Modeling |
| ObjectId | Document identifiers |
| MongoDB Indexes | Query optimization and uniqueness |
| MongoDB Transactions | Atomic multi-document operations |
| MongoDB session store | Technical authentication session storage |

We will use separate database configurations for development, staging and production.

The session store may create a technical MongoDB collection. This is infrastructure storage, not a new product collection.

---

# **3\. Database Collections**

The MVP has ten primary product collections.

| No. | Collection | Responsibility |
| ----- | ----- | ----- |
| 1 | User | Admin and manager accounts |
| 2 | Wedding | Main wedding information and Our Story |
| 3 | Event | Events, food menus, venues and YouTube video metadata |
| 4 | Task | Shared tasks |
| 5 | Expense | Actual expenses |
| 6 | Guest | Family-based guest records |
| 7 | RSVP | Family-wise event responses |
| 8 | Invitation | Common and event-specific invitation card metadata |
| 9 | Photo | Wedding photograph records and approval status |
| 10 | Announcement | Wedding announcements |

### **No separate collections for**

* FoodMenu: embedded inside Event.  
* OurStory: embedded inside Wedding.  
* Dashboard: calculated from existing collections.  
* Video or Livestream: video metadata embedded inside Event.  
* InvitationTemplate: not required because cards are designed externally.  
* IndividualGuest: excluded from the MVP.  
* ActivityHistory: excluded from the MVP.  
* Budget: excluded from the MVP.

---

# **4\. Entity Relationship Diagram**

```
erDiagram
    USER ||--o| WEDDING : owns

    WEDDING ||--o{ EVENT : contains
    WEDDING ||--o{ TASK : contains
    WEDDING ||--o{ EXPENSE : contains
    WEDDING ||--o{ GUEST : contains
    WEDDING ||--o{ RSVP : contains
    WEDDING ||--o{ INVITATION : contains
    WEDDING ||--o{ PHOTO : contains
    WEDDING ||--o{ ANNOUNCEMENT : contains

    USER ||--o{ EVENT : creates
    USER ||--o{ TASK : creates
    USER ||--o{ EXPENSE : creates
    USER ||--o{ GUEST : manages
    USER ||--o{ INVITATION : uploads
    USER ||--o{ PHOTO : uploads
    USER ||--o{ ANNOUNCEMENT : creates

    EVENT o|--o{ TASK : relates_to
    EVENT o|--o{ EXPENSE : relates_to
    EVENT ||--o{ RSVP : receives
    EVENT o|--o{ INVITATION : has
    EVENT o|--o{ PHOTO : groups

    GUEST ||--o{ RSVP : submits
```

Our Story is an embedded subdocument inside Wedding, not a separate entity.

Guest-to-Event invitations are represented by `Guest.invitedEvents`. Actual RSVP responses are separate documents.

Fields such as `createdBy`, `updatedBy`, and `uploadedBy` are metadata references.

---

# **5\. Collection Designs**

## **5.1 User Collection**

### **Purpose**

Stores authenticated accounts for Admin and Manager.

Guests do not have User documents.

### **Proposed Schema**

| Field | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| `_id` | ObjectId | Yes | User ID |
| `name` | String | Yes | User name |
| `email` | String | Yes | Unique normalized email |
| `passwordHash` | String | Conditional | Hashed password |
| `role` | String | Yes | ADMIN / MANAGER |
| `status` | String | Yes | INVITED / ACTIVE / DISABLED |
| `activationTokenHash` | String | No | Hashed manager activation token |
| `activationExpiresAt` | Date | No | Activation expiry |
| `activatedAt` | Date | No | Account activation time |
| `passwordResetTokenHash` | String | No | Hashed password reset token |
| `passwordResetExpiresAt` | Date | No | Password reset expiry |
| `createdAt` | Date | Yes | Creation time |
| `updatedAt` | Date | Yes | Last update |

### **Example Document**

```
{
  "_id": "USER_ID",
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "passwordHash": "HASHED_PASSWORD",
  "role": "ADMIN",
  "status": "ACTIVE",
  "activatedAt": "2026-11-10T10:00:00.000Z",
  "passwordResetTokenHash": null,
  "passwordResetExpiresAt": null
}
```

### **Manager Activation**

1. Admin enters manager name and email.  
2. Backend generates a cryptographically random activation token.  
3. Backend stores only its hash.  
4. Email provider sends the raw token in an activation link.  
5. Manager opens the link.  
6. Backend hashes the received token and matches it against the stored hash.  
7. Backend checks expiry and account status.  
8. Manager sets a password.  
9. User status changes to ACTIVE.  
10. Activation fields are cleared.

### **Password Reset**

The same security principle applies to password reset.

* Generate a random token.  
* Store only its hash.  
* Send the raw token through email.  
* Validate expiry.  
* Update password hash.  
* Clear reset-token fields.  
* Invalidate existing sessions as appropriate.

### **Business Rules**

* Email must be normalized and unique.  
* Admin passwords are required.  
* An invited manager initially has no password.  
* Guests cannot register as authenticated users.  
* Activation tokens are single-use.  
* Password reset tokens are single-use.  
* Sensitive token values must never be stored in plain text.

### **Indexes**

```
{ email: 1 } // Unique

{
  activationTokenHash: 1
} // Unique partial index when present

{
  passwordResetTokenHash: 1
} // Unique partial index when present
```

---

## **5.2 Wedding Collection**

### **Purpose**

Wedding is the central document in the application.

It stores:

* Couple information.  
* Wedding details.  
* Hero image.  
* Short welcome introduction.  
* Our Story description.  
* Up to two supporting Our Story photographs.  
* Public website settings.  
* Admin and manager references.

### **Proposed Schema**

| Field | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| `_id` | ObjectId | Yes | Wedding ID |
| `adminId` | ObjectId | Yes | Reference to User |
| `managerId` | ObjectId | Until assigned | Reference to User |
| `title` | String | Yes | Wedding title |
| `partnerOneName` | String | Yes | First partner |
| `partnerTwoName` | String | Yes | Second partner |
| `weddingDate` | String | Yes | YYYY-MM-DD |
| `timeZone` | String | Yes | IANA timezone |
| `introduction` | String | No | Short hero welcome message |
| `coverImage` | Object | No | Hero image information |
| `ourStory` | Object | No | Couple story content |
| `slug` | String | Yes | Public website identifier |
| `websitePublished` | Boolean | Yes | Website publication status |
| `publishedAt` | Date | No | Publication time |
| `createdAt` | Date | Yes | Creation time |
| `updatedAt` | Date | Yes | Last update |

### **Important distinction**

`introduction` and `ourStory.description` have different purposes.

| Field | Purpose |
| ----- | ----- |
| `introduction` | Short welcome message displayed in the hero section |
| `ourStory.description` | Longer personal story displayed in the Our Story section |

We should not reuse the same field for both purposes.

### **Hero Image Structure**

```
coverImage: {
  url: String,
  publicId: String
}
```

This is the primary couple photograph used in the hero section.

### **Our Story Structure**

```
ourStory: {
  description: {
    type: String,
    default: ""
  },

  images: [
    {
      _id: ObjectId,
      url: String,
      publicId: String,
      altText: String
    }
  ]
}
```

The `images` array can contain a maximum of two supporting photographs.

Mongoose automatically creates `_id` values for embedded subdocuments unless disabled.

### **Example Wedding Document**

```
{
  "_id": "WEDDING_ID",
  "adminId": "ADMIN_USER_ID",
  "managerId": "MANAGER_USER_ID",

  "title": "Rahul Weds Priya",
  "partnerOneName": "Rahul",
  "partnerTwoName": "Priya",

  "weddingDate": "2027-02-15",
  "timeZone": "Asia/Kolkata",

  "introduction": "Together with our families, we invite you to celebrate our wedding.",

  "coverImage": {
    "url": "https://res.cloudinary.com/example/hero.jpg",
    "publicId": "wedding/hero"
  },

  "ourStory": {
    "description": "Our journey began with a friendship that slowly grew into something beautiful. We are excited to celebrate this new chapter with our families and loved ones.",

    "images": [
      {
        "_id": "STORY_IMAGE_ID_1",
        "url": "https://res.cloudinary.com/example/story1.jpg",
        "publicId": "wedding/story-1",
        "altText": "Rahul and Priya together"
      },
      {
        "_id": "STORY_IMAGE_ID_2",
        "url": "https://res.cloudinary.com/example/story2.jpg",
        "publicId": "wedding/story-2",
        "altText": "A favourite memory of the couple"
      }
    ]
  },

  "slug": "rahul-weds-priya",
  "websitePublished": false
}
```

### **Our Story Business Rules**

1. Only the admin can create or update Our Story.  
2. Story description is optional.  
3. Supporting photographs are optional.  
4. Maximum supporting photographs: two.  
5. JPEG, PNG and WebP are supported.  
6. Each supporting photograph is stored in Cloudinary.  
7. MongoDB stores the image URL, Cloudinary public ID and alt text.  
8. Embedded image records have their own subdocument IDs.  
9. The public website displays Our Story when description or photographs exist.  
10. Removing a supporting image does not delete the wedding or gallery records.  
11. Our Story photographs are not guest-submitted Photo records.

### **Business Rules**

* One admin owns one wedding.  
* One wedding has one designated manager once assigned.  
* Manager ID can be null before assignment.  
* Wedding slug is unique.  
* Only a published wedding exposes public wedding content.  
* Wedding timezone determines how dates and times are interpreted.

### **Indexes**

```
{ adminId: 1 } // Unique

{ managerId: 1 }

{ slug: 1 } // Unique
```

---

## **5.3 Event Collection**

### **Purpose**

Stores wedding events, venues, schedules, menus and optional YouTube video information.

### **Proposed Schema**

| Field | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| `_id` | ObjectId | Yes | Event ID |
| `weddingId` | ObjectId | Yes | Reference to Wedding |
| `name` | String | Yes | Event name |
| `eventDate` | String | Yes | YYYY-MM-DD |
| `startTime` | String | Yes | HH |
| `endTime` | String | No | HH |
| `venueName` | String | Yes | Venue name |
| `venueAddress` | String | Yes | Venue address |
| `googleMapsUrl` | String | No | Maps URL |
| `description` | String | No | Event description |
| `foodMenu` | Array | No | Embedded menu |
| `status` | String | Yes | UPCOMING / COMPLETED / CANCELLED |
| `isPublished` | Boolean | Yes | Public visibility |
| `video` | Object | No | YouTube video metadata |
| `createdBy` | ObjectId | Yes | User reference |
| `updatedBy` | ObjectId | No | User reference |
| `createdAt` | Date | Yes | Creation time |
| `updatedAt` | Date | Yes | Last update |
| `deletedAt` | Date | No | Logical deletion time |

### **Embedded Food Menu**

```
{
  "foodMenu": [
    {
      "category": "Breakfast",
      "items": [
        "Aloo Paratha",
        "Curd",
        "Tea"
      ]
    },
    {
      "category": "Snacks",
      "items": [
        "Samosa",
        "Juice"
      ]
    }
  ]
}
```

There is no FoodMenu collection.

### **Embedded Video Structure**

Each event can have no video or one current YouTube video.

```
video: {
  videoType: {
    type: String,
    enum: ["LIVE", "RECORDED"]
  },

  provider: {
    type: String,
    enum: ["YOUTUBE"],
    default: "YOUTUBE"
  },

  url: String,

  videoId: String
}
```

### **Recorded Video Example**

```
{
  "video": {
    "videoType": "RECORDED",
    "provider": "YOUTUBE",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "videoId": "VIDEO_ID"
  }
}
```

### **Livestream Example**

```
{
  "video": {
    "videoType": "LIVE",
    "provider": "YOUTUBE",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "videoId": "VIDEO_ID"
  }
}
```

### **No Video**

```
{
  "video": null
}
```

### **Video Business Rules**

1. Supported video types are LIVE and RECORDED.  
2. YouTube is the only provider in the MVP.  
3. Backend validates the submitted URL.  
4. Backend extracts the video ID from the validated URL.  
5. The client cannot be trusted to provide an arbitrary video ID.  
6. MongoDB stores only video metadata.  
7. Video files remain hosted by YouTube.  
8. React embeds the player using the extracted video ID.  
9. Embedding must be allowed by the video's YouTube settings.  
10. No separate Video collection is required.

### **Event Business Rules**

* Every event belongs to one wedding.  
* Food menus are embedded.  
* Each event may have one optional YouTube video.  
* Published events belonging to published weddings appear publicly.  
* Cancelled events do not accept new RSVPs.  
* When important dependent records exist, cancellation is preferred over deletion.

### **Indexes**

```
{ weddingId: 1, eventDate: 1, startTime: 1 }

{ weddingId: 1, isPublished: 1, eventDate: 1 }

{ weddingId: 1, status: 1 }
```

---

## **5.4 Task Collection**

### **Purpose**

Stores the shared wedding task list.

### **Schema**

| Field | Data Type | Required |
| ----- | ----- | ----- |
| `_id` | ObjectId | Yes |
| `weddingId` | ObjectId | Yes |
| `title` | String | Yes |
| `description` | String | No |
| `eventId` | ObjectId | No |
| `deadline` | Date | Yes |
| `priority` | String | Yes |
| `status` | String | Yes |
| `createdBy` | ObjectId | Yes |
| `updatedBy` | ObjectId | No |
| `createdAt` | Date | Yes |
| `updatedAt` | Date | Yes |

Priority: LOW, MEDIUM, HIGH.

Status: TODO, IN\_PROGRESS, COMPLETED.

### **Business Rules**

* Every task belongs to a wedding.  
* Event reference is optional.  
* Tasks are shared between admin and manager.  
* No `assignedTo` field is required.  
* Referenced events must belong to the same wedding.

### **Indexes**

```
{ weddingId: 1, status: 1, deadline: 1 }

{ weddingId: 1, eventId: 1 }
```

---

## **5.5 Expense Collection**

### **Purpose**

Stores actual wedding expenses only.

### **Schema**

| Field | Data Type | Required |
| ----- | ----- | ----- |
| `_id` | ObjectId | Yes |
| `weddingId` | ObjectId | Yes |
| `title` | String | Yes |
| `category` | String | Yes |
| `amountPaise` | Number | Yes |
| `paymentDate` | Date | Yes |
| `paymentMethod` | String | No |
| `eventId` | ObjectId | No |
| `notes` | String | No |
| `createdBy` | ObjectId | Yes |
| `updatedBy` | ObjectId | No |
| `createdAt` | Date | Yes |
| `updatedAt` | Date | Yes |

Money is stored as integer paise.

For example:

* ₹1,000 \= 100000 paise.  
* ₹80,000 \= 8000000 paise.

### **Business Rules**

* Amount must be a positive integer.  
* Currency is INR.  
* Event reference is optional.  
* Event must belong to the same wedding.  
* No budget or forecasting fields are included.

### **Indexes**

```
{ weddingId: 1, paymentDate: -1 }

{ weddingId: 1, category: 1 }

{ weddingId: 1, eventId: 1 }
```

---

## **5.6 Guest Collection**

### **Purpose**

Stores family-based guest records.

One Guest document represents one family or invitation unit.

### **Schema**

| Field | Data Type | Required |
| ----- | ----- | ----- |
| `_id` | ObjectId | Yes |
| `weddingId` | ObjectId | Yes |
| `familyName` | String | Yes |
| `primaryContactName` | String | No |
| `mobile` | String | Yes |
| `email` | String | No |
| `familyGroupInfo` | String | No |
| `notes` | String | No |
| `weddingInvitationStatus` | String | Yes |
| `weddingInvitationSharedAt` | Date | No |
| `weddingInvitationSharedBy` | ObjectId | No |
| `invitedEvents` | Array | Yes |
| `rsvpAccess` | Object | No |
| `createdBy` | ObjectId | Yes |
| `updatedBy` | ObjectId | No |
| `createdAt` | Date | Yes |
| `updatedAt` | Date | Yes |
| `deletedAt` | Date | No |

### **Embedded Invited Events**

```
{
  "invitedEvents": [
    {
      "eventId": "HALDI_EVENT_ID",
      "invitationStatus": "SHARED",
      "sharedAt": "2027-01-10T10:00:00.000Z",
      "sharedBy": "ADMIN_USER_ID"
    },
    {
      "eventId": "WEDDING_EVENT_ID",
      "invitationStatus": "NOT_SENT",
      "sharedAt": null,
      "sharedBy": null
    }
  ]
}
```

### **RSVP Token Metadata**

```
{
  "rsvpAccess": {
    "tokenHash": "HASHED_RANDOM_TOKEN",
    "createdAt": "2027-01-01T10:00:00.000Z",
    "expiresAt": "2027-02-20T18:30:00.000Z",
    "revokedAt": null
  }
}
```

The original token is shared through the family RSVP link. Only its hash is stored.

### **Business Rules**

* One document represents one family.  
* A family can be invited to multiple events.  
* Duplicate event references are prohibited within one guest.  
* All event references must belong to the same wedding.  
* Mobile numbers are normalized.  
* Duplicate mobile numbers generate warnings.  
* Guest contact information remains private.  
* `NOT_SENT` and `SHARED` are the invitation-sharing states.  
* A family token provides access to only that family's invited events and responses.  
* Deleting a family revokes its RSVP token.

### **Indexes**

```
{ weddingId: 1, familyName: 1 }

{ weddingId: 1, mobile: 1 }

{ weddingId: 1, "invitedEvents.eventId": 1 }

{
  "rsvpAccess.tokenHash": 1
} // Unique partial index
```

---

## **5.7 RSVP Collection**

### **Purpose**

Stores one family response per invited event.

### **Schema**

| Field | Data Type | Required |
| ----- | ----- | ----- |
| `_id` | ObjectId | Yes |
| `weddingId` | ObjectId | Yes |
| `guestId` | ObjectId | Yes |
| `eventId` | ObjectId | Yes |
| `response` | String | Yes |
| `respondedAt` | Date | Yes |
| `createdAt` | Date | Yes |
| `updatedAt` | Date | Yes |

Response: YES or NO.

### **Example**

```
{
  "_id": "RSVP_ID",
  "weddingId": "WEDDING_ID",
  "guestId": "GUEST_ID",
  "eventId": "HALDI_EVENT_ID",
  "response": "YES",
  "respondedAt": "2027-01-15T10:00:00.000Z"
}
```

### **Business Rules**

* One family can have one current response per event.  
* A family can change its response.  
* RSVP requires a valid family token.  
* Family must be invited to the event.  
* Cancelled events cannot accept new responses.  
* Existing responses are retained when an event is cancelled.

### **Unique Compound Index**

```
RSVPSchema.index(
  {
    weddingId: 1,
    guestId: 1,
    eventId: 1
  },
  {
    unique: true
  }
);
```

Additional index:

```
{ weddingId: 1, eventId: 1, response: 1 }
```

---

## **5.8 Invitation Collection**

### **Purpose**

Stores metadata for uploaded invitation card images.

Cards are designed externally using Canva, downloaded and uploaded through our frontend.

### **Invitation Types**

* COMMON: One common wedding invitation.  
* EVENT: One invitation for a particular event.

### **Schema**

| Field | Data Type | Required |
| ----- | ----- | ----- |
| `_id` | ObjectId | Yes |
| `weddingId` | ObjectId | Yes |
| `type` | String | Yes |
| `eventId` | ObjectId | Conditional |
| `imageUrl` | String | Yes |
| `storagePublicId` | String | Yes |
| `fileName` | String | No |
| `format` | String | Yes |
| `uploadedBy` | ObjectId | Yes |
| `updatedBy` | ObjectId | No |
| `createdAt` | Date | Yes |
| `updatedAt` | Date | Yes |

### **Business Rules**

* One common invitation per wedding.  
* One current event invitation per event.  
* Event cards reference events within the same wedding.  
* Cards are stored as Cloudinary assets.  
* MongoDB stores their metadata.  
* One card may be reused across multiple families.  
* Replacing a card updates the existing Invitation document.  
* No personalised family cards or invitation designer are included.

### **Partial Unique Indexes**

```
InvitationSchema.index(
  { weddingId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: "COMMON"
    }
  }
);

InvitationSchema.index(
  { weddingId: 1, eventId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: "EVENT"
    }
  }
);
```

---

## **5.9 Photo Collection**

### **Purpose**

Stores wedding photograph metadata and approval information.

Image files are stored in Cloudinary.

### **Schema**

| Field | Data Type | Required |
| ----- | ----- | ----- |
| `_id` | ObjectId | Yes |
| `weddingId` | ObjectId | Yes |
| `eventId` | ObjectId | No |
| `imageUrl` | String | Yes |
| `storagePublicId` | String | Yes |
| `uploadedByType` | String | Yes |
| `uploadedByUserId` | ObjectId | Conditional |
| `status` | String | Yes |
| `reviewedBy` | ObjectId | No |
| `reviewedAt` | Date | No |
| `createdAt` | Date | Yes |
| `updatedAt` | Date | Yes |

Uploader types:

* ADMIN.  
* MANAGER.  
* GUEST.

Approval statuses:

* PENDING.  
* APPROVED.  
* REJECTED.

### **Business Rules**

* Admin and manager uploads are approved.  
* Guest submissions are pending.  
* Only admin can approve or reject guest submissions.  
* Only approved photographs are shown publicly.  
* Our Story supporting images do not belong to this collection.

### **Indexes**

```
{ weddingId: 1, status: 1, createdAt: -1 }

{ weddingId: 1, eventId: 1, status: 1 }
```

---

## **5.10 Announcement Collection**

### **Purpose**

Stores wedding announcements.

### **Schema**

| Field | Data Type | Required |
| ----- | ----- | ----- |
| `_id` | ObjectId | Yes |
| `weddingId` | ObjectId | Yes |
| `title` | String | Yes |
| `description` | String | Yes |
| `status` | String | Yes |
| `publishedAt` | Date | No |
| `createdBy` | ObjectId | Yes |
| `updatedBy` | ObjectId | No |
| `createdAt` | Date | Yes |
| `updatedAt` | Date | Yes |

Status:

* DRAFT.  
* PUBLISHED.

### **Business Rules**

* Admin and manager can create and update announcements.  
* Only published announcements appear publicly.  
* Public queries must be scoped to published weddings.

### **Index**

```
{ weddingId: 1, status: 1, publishedAt: -1 }
```

---

# **6\. Our Story Data Design**

Our Story is part of Wedding, not a separate collection.

## **6.1 Content Responsibilities**

| Data | Storage |
| ----- | ----- |
| Short welcome text | `Wedding.introduction` |
| Hero photograph | `Wedding.coverImage` |
| Story description | `Wedding.ourStory.description` |
| First supporting photograph | `Wedding.ourStory.images[0]` |
| Second supporting photograph | `Wedding.ourStory.images[1]` |

## **6.2 Embedded Image Structure**

Each supporting image contains:

| Field | Data Type | Purpose |
| ----- | ----- | ----- |
| `_id` | ObjectId | Embedded image identifier |
| `url` | String | Cloudinary secure URL |
| `publicId` | String | Cloudinary asset identifier |
| `altText` | String | Accessible image description |

The array order determines display order.

There must be a maximum of two images.

## **6.3 Example Queries**

Update description:

```
Wedding.findOneAndUpdate(
  { _id: weddingId },
  {
    $set: {
      "ourStory.description": description
    }
  },
  { new: true }
);
```

Add an image:

```
Wedding.updateOne(
  { _id: weddingId },
  {
    $push: {
      "ourStory.images": {
        $each: [imageData]
      }
    }
  }
);
```

The service must check the current image count before adding a new image. The schema and service must both protect the two-image limit.

Remove an image by its embedded ID:

```
Wedding.updateOne(
  { _id: weddingId },
  {
    $pull: {
      "ourStory.images": {
        _id: imageId
      }
    }
  }
);
```

The Cloudinary asset is deleted only after the database update succeeds.

---

# **7\. Data Integrity and Validation Rules**

MongoDB does not provide relational foreign-key constraints. We will enforce relationships using Mongoose and the service layer.

| Rule | Enforcement |
| ----- | ----- |
| One wedding per admin | Unique `Wedding.adminId` |
| One designated manager per wedding | Single `managerId` field |
| Unique website slug | Unique index |
| Event belongs to correct wedding | Service validation |
| Task event belongs to same wedding | Service validation |
| Expense event belongs to same wedding | Service validation |
| Guest invited events belong to same wedding | Service validation |
| RSVP guest belongs to same wedding | Service validation |
| RSVP event belongs to same wedding | Service validation |
| One RSVP per family-event | Unique compound index |
| One common invitation | Partial unique index |
| One event card per event | Partial unique index |
| RSVP token uniqueness | Unique token-hash index |
| Our Story image count | Mongoose validation \+ service validation |
| Our Story image deletion | Embedded ID validation |
| Video URL | Backend YouTube validation |
| Video ID | Extracted by backend from validated URL |

A valid ObjectId does not prove that a document belongs to the correct wedding.

All references must be checked against the authorized wedding.

---

# **8\. Data Isolation Strategy**

Every private wedding record contains `weddingId`.

The backend resolves wedding context through authenticated identity:

* Admin: `Wedding.adminId`.  
* Manager: `Wedding.managerId`.  
* RSVP guest: family record found through the validated RSVP token.

For every private request:

1. Authenticate the user.  
2. Resolve their wedding.  
3. Check role and permissions.  
4. Query using the authorized wedding ID.  
5. Verify referenced resources belong to the same wedding.

Our Story editing is restricted to the admin.

---

# **9\. Important Data Flows**

## **9.1 Manager Activation**

1. Admin enters manager details.  
2. Backend creates an invited User.  
3. Backend generates a random token.  
4. Only its hash is stored.  
5. Wedding receives the manager assignment.  
6. Email provider sends the raw activation link.  
7. Manager opens the link.  
8. Backend checks token and expiry.  
9. Manager sets password.  
10. User changes to ACTIVE.  
11. Token fields are cleared.

Database updates should be atomic where appropriate. Email delivery occurs after database commit.

## **9.2 Family RSVP**

1. Create Guest.  
2. Assign invited events.  
3. Generate one random family token.  
4. Store token hash in Guest.  
5. Share the family link through WhatsApp.  
6. Guest opens the link.  
7. Backend hashes and validates the token.  
8. Backend loads the family's invited events.  
9. Guest submits YES or NO.  
10. Backend validates event eligibility.  
11. RSVP is created or updated.

## **9.3 Invitation Upload**

1. Design card in Canva.  
2. Download image.  
3. Upload through React.  
4. Backend validates file and permissions.  
5. Cloudinary stores image.  
6. MongoDB stores card metadata.  
7. Frontend previews and shares the card.

## **9.4 Our Story Image Upload**

1. Admin opens Our Story editor.  
2. Selects an image.  
3. React sends multipart request.  
4. Backend verifies admin permissions.  
5. Backend checks that fewer than two supporting images exist.  
6. Backend validates the image.  
7. Cloudinary stores the file.  
8. Backend saves URL, public ID, alt text and embedded image ID.  
9. React displays the updated preview.

If MongoDB update fails after Cloudinary upload, the newly uploaded asset is cleaned up.

## **9.5 YouTube Video**

1. Generate or obtain a recorded video.  
2. Upload it to YouTube.  
3. Copy YouTube URL.  
4. Select an Event.  
5. Select LIVE or RECORDED.  
6. Paste YouTube URL.  
7. Backend validates URL and extracts video ID.  
8. Event document stores the video object.  
9. Public API returns permitted video data.  
10. React embeds the player.

No video file is stored by Make My Marriage.

## **9.6 Guest Photo Submission**

1. Guest opens public photo-upload page.  
2. Backend validates wedding and request.  
3. File is uploaded to Cloudinary.  
4. Photo document is created as PENDING.  
5. Admin reviews it.  
6. Admin approves or rejects.  
7. Only approved photos appear publicly.

---

# **10\. Dashboard Query Design**

Dashboard information is calculated from the existing collections.

| Metric | Source |
| ----- | ----- |
| Total events | Event |
| Upcoming events | Event |
| Total actual expenses | Expense |
| Total family records | Guest |
| Accepted RSVPs | RSVP |
| Pending RSVPs | Invited family-event pairs without responses |
| Upcoming task deadlines | Task |
| Recent updates | Existing record timestamps |

RSVP counts represent family-event responses, not individual attendee counts.

---

# **11\. Indexing Strategy**

| Collection | Index | Purpose |
| ----- | ----- | ----- |
| User | `email` unique | Login |
| User | `activationTokenHash` unique partial | Activation |
| User | `passwordResetTokenHash` unique partial | Password reset |
| Wedding | `adminId` unique | One wedding per admin |
| Wedding | `managerId` | Manager lookup |
| Wedding | `slug` unique | Public page |
| Event | `weddingId + eventDate + startTime` | Event listing |
| Event | `weddingId + isPublished + eventDate` | Public event listing |
| Task | `weddingId + status + deadline` | Task filtering |
| Expense | `weddingId + paymentDate` | Expense history |
| Guest | `weddingId + familyName` | Family search |
| Guest | `weddingId + mobile` | Duplicate detection |
| Guest | `rsvpAccess.tokenHash` unique partial | RSVP lookup |
| RSVP | `weddingId + guestId + eventId` unique | Duplicate prevention |
| RSVP | `weddingId + eventId + response` | RSVP reporting |
| Invitation | `weddingId` partial unique | Common card |
| Invitation | `weddingId + eventId` partial unique | Event card |
| Photo | `weddingId + status + createdAt` | Gallery and approval |
| Announcement | `weddingId + status + publishedAt` | Public announcements |

Indexes will be validated against actual query patterns.

---

# **12\. Record Lifecycle and Deletion Rules**

## **Events**

* Cancellation is the normal event-removal action.  
* Cancelled events preserve linked RSVP and financial data.  
* Cancelled events cannot accept new RSVPs.  
* Before deletion, the service checks tasks, expenses, invitation cards, photos and RSVP records.  
* Logical deletion is used when safe.  
* Deleted events are excluded from normal queries.

## **Guests**

* Families with RSVP history should be soft-deleted.  
* RSVP token must be revoked.  
* Existing RSVP records are retained.  
* Deleted family records are excluded from normal guest listings.

## **Invitations**

* Replace the existing card document.  
* Upload the new image first.  
* Update the database.  
* Remove old Cloudinary asset after successful update.  
* Keep Guest and RSVP data unchanged.

## **Photos**

* REJECTED does not automatically mean deleted.  
* Only APPROVED photos appear publicly.  
* Permanent deletion coordinates MongoDB and Cloudinary.

## **Our Story Supporting Images**

* Removing an image removes its embedded subdocument by ID.  
* After the database update succeeds, the Cloudinary asset is deleted.  
* Deleting a supporting image does not affect the hero image or Wedding Memories gallery.  
* Replacing an image follows the upload-first and database-update-first cleanup pattern.

---

# **13\. Public Data Access**

The public API returns selected fields only.

Public content includes:

* Wedding names.  
* Wedding date.  
* Introduction.  
* Hero image URL.  
* Our Story description.  
* Our Story supporting image URLs and alt text.  
* Published events.  
* Menus.  
* Venue information.  
* Invitation image URLs.  
* YouTube video information.  
* Published announcements.  
* Approved photos.

Public responses must not expose:

* User details.  
* Guest contact information.  
* Family notes.  
* Other families' RSVP responses.  
* Password hashes.  
* Activation token hashes.  
* RSVP token hashes.  
* Cloudinary credentials or unnecessary management metadata.  
* Pending and rejected photographs.  
* Unpublished wedding content.

Family RSVP access remains separate from public website publication.

---

# **14\. Final Database Decisions**

| Area | Final Decision |
| ----- | ----- |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Product collections | 10 |
| Authenticated users | Admin and Manager |
| Wedding ownership | One admin per wedding |
| Manager | One designated manager |
| Hero introduction | `Wedding.introduction` |
| Hero photograph | `Wedding.coverImage` |
| Our Story description | `Wedding.ourStory.description` |
| Our Story photos | `Wedding.ourStory.images` |
| Maximum Our Story photos | 2 |
| Our Story storage | Embedded in Wedding |
| Our Story image hosting | Cloudinary |
| Events | Separate collection |
| Food menus | Embedded inside Event |
| YouTube video | Embedded inside Event |
| Video types | LIVE / RECORDED |
| Video hosting | YouTube |
| Video playback | Embedded on public website |
| Tasks | Separate collection |
| Expenses | Separate collection |
| Guests | Family-based records |
| RSVP | Separate collection |
| Invitations | Separate collection |
| Invitation card hosting | Cloudinary |
| Photos | Separate collection |
| Announcements | Separate collection |
| Dashboard | Aggregations from existing collections |
| Data isolation | Wedding-level authorization |

**Final principle:** Every collection, field, index and relationship must support an approved PRD requirement or a necessary technical constraint. No separate Our Story, FoodMenu, Video or InvitationTemplate collection is required.

