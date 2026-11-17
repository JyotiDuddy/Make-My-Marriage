# **Make My Marriage**

# **API Design Document**

**Version: 1.1**  
**Status: Updated MVP API Contract**  
**Related Documents: PRD v1.1, System Architecture v1.1, Database Design v1.2**  
**Backend: Node.js \+ Express.js**  
**Database: MongoDB \+ Mongoose**  
**API Style: REST**  
**API Base Path: `/api/v1`**

---

# **1\. Purpose**

**This document defines the REST API contract for Make My Marriage.**

**It establishes the communication rules between the React frontend and Express backend.**

**It covers:**

* **HTTP methods and endpoints.**  
* **Request and response structures.**  
* **Authentication and authorization.**  
* **Request validation.**  
* **Wedding data access.**  
* **Our Story content management.**  
* **Event and YouTube video management.**  
* **Guest and family RSVP workflows.**  
* **Invitation uploads.**  
* **Photo upload and approval.**  
* **Public wedding website.**  
* **External service integrations.**  
* **Error handling.**  
* **API testing.**

**Every endpoint must support an approved PRD requirement or a necessary technical operation.**

---

# **2\. API Architecture**

## **2.1 Request Processing**

```
flowchart TD
    CLIENT["React Frontend"]
    ROUTE["Express Route"]
    AUTH["Authentication Middleware"]
    PERM["Authorization Middleware"]
    VALIDATE["Request Validation"]
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

**Protected requests require an authenticated session.**

**Public requests do not require an authenticated user, but some require a secure family RSVP token.**

## **2.2 Base URL**

```
/api/v1
```

**Example:**

```
POST /api/v1/events
GET /api/v1/events
PATCH /api/v1/events/:eventId
```

## **2.3 HTTP Methods**

| Method | Purpose |
| ----- | ----- |
| **GET** | **Retrieve resources** |
| **POST** | **Create a resource or initiate an operation** |
| **PATCH** | **Partially update a resource** |
| **PUT** | **Replace a resource or perform an idempotent update** |
| **DELETE** | **Delete a resource** |

## **2.4 Content Types**

**JSON requests:**

```
Content-Type: application/json
```

**Image uploads:**

```
Content-Type: multipart/form-data
```

## **2.5 Standard Success Response**

```
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "id": "EVENT_ID",
    "name": "Haldi Ceremony"
  }
}
```

## **2.6 Standard Error Response**

```
{
  "success": false,
  "message": "You are not authorized to perform this action",
  "error": {
    "code": "FORBIDDEN"
  }
}
```

**All APIs must use a consistent response structure.**

## **2.7 Pagination**

**List endpoints support:**

```
?page=1&limit=10
```

**Defaults:**

* **Page: 1\.**  
* **Limit: 10\.**  
* **Maximum limit: 100\.**

**Response:**

```
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalRecords": 100,
    "totalPages": 10
  }
}
```

## **2.8 Date and Time Format**

| Data | Format |
| ----- | ----- |
| **Wedding date** | **YYYY-MM-DD** |
| **Event date** | **YYYY-MM-DD** |
| **Event time** | **24-hour HH:mm** |
| **Timestamp** | **ISO 8601** |
| **Timezone** | **IANA timezone** |

**Example timezone:**

```
Asia/Kolkata
```

**Event date and time are interpreted using the associated Wedding timezone.**

## **2.9 Money Format**

**Expense APIs use integer paise.**

**Example:**

```
{
  "amountPaise": 8000000
}
```

**This represents ₹80,000.**

---

# **3\. Authentication and Session Architecture**

## **3.1 Authentication Method**

**We will use secure server-side sessions.**

**The session ID will be stored in an HTTP-only cookie.**

**Cookie requirements:**

* **HttpOnly enabled.**  
* **Secure enabled in production.**  
* **Appropriate SameSite configuration.**  
* **Session regeneration after successful authentication.**  
* **Session destruction on logout.**  
* **Controlled session expiration.**

**Session storage will use MongoDB.**

**This creates technical session-storage data, not an additional product collection.**

## **3.2 CSRF Protection**

**Since the browser uses session cookies, state-changing authenticated requests must have CSRF protection.**

**React obtains a CSRF token and sends it in the `X-CSRF-Token` header.**

**For frontend API calls:**

```
axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true
});
```

**Production CORS must allow only the configured frontend origin and credentials.**

## **3.3 Authentication Endpoints**

| Method | Endpoint | Access |
| ----- | ----- | ----- |
| **GET** | **`/auth/csrf`** | **Public** |
| **POST** | **`/auth/register`** | **Public** |
| **POST** | **`/auth/login`** | **Public** |
| **POST** | **`/auth/logout`** | **Authenticated** |
| **GET** | **`/auth/me`** | **Authenticated** |
| **POST** | **`/auth/forgot-password`** | **Public** |
| **POST** | **`/auth/reset-password`** | **Public** |
| **POST** | **`/auth/manager-activation`** | **Public** |

### **POST /auth/register**

**Registers a new admin.**

**Request:**

```
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "password": "StrongPassword123"
}
```

**Backend:**

1. **Validate input.**  
2. **Normalize email.**  
3. **Check email uniqueness.**  
4. **Hash password.**  
5. **Create an ACTIVE ADMIN.**  
6. **Establish authenticated session.**  
7. **Return public user details.**

**The client cannot choose its own role.**

**Response:**

```
{
  "success": true,
  "message": "Account registered successfully",
  "data": {
    "user": {
      "id": "USER_ID",
      "name": "Rahul Sharma",
      "email": "rahul@example.com",
      "role": "ADMIN"
    },
    "onboardingRequired": true
  }
}
```

### **POST /auth/login**

**Request:**

```
{
  "email": "rahul@example.com",
  "password": "StrongPassword123"
}
```

**Backend verifies credentials, checks account status, regenerates the session ID, and establishes the authenticated session.**

### **POST /auth/logout**

**Destroys the current session and clears the session cookie.**

**Response: `204 No Content`.**

### **GET /auth/me**

**Returns the authenticated user's profile.**

**Response:**

```
{
  "success": true,
  "data": {
    "user": {
      "id": "USER_ID",
      "name": "Rahul Sharma",
      "email": "rahul@example.com",
      "role": "ADMIN",
      "weddingId": "WEDDING_ID"
    }
  }
}
```

**Never return password hashes, activation-token hashes, reset-token hashes or session identifiers.**

### **POST /auth/forgot-password**

**Request:**

```
{
  "email": "rahul@example.com"
}
```

**Backend generates a password reset token, stores its hash and expiry, and sends the raw token through email.**

**Response must not reveal whether the email address exists.**

### **POST /auth/reset-password**

**Request:**

```
{
  "token": "RAW_RESET_TOKEN",
  "newPassword": "NewStrongPassword123"
}
```

**Backend validates the token and expiry, updates the password hash, clears reset fields and invalidates existing sessions as appropriate.**

### **POST /auth/manager-activation**

**Request:**

```
{
  "token": "RAW_ACTIVATION_TOKEN",
  "password": "StrongPassword123"
}
```

**Backend:**

1. **Hashes the supplied token.**  
2. **Finds the invited manager.**  
3. **Checks account status.**  
4. **Validates expiry.**  
5. **Hashes the new password.**  
6. **Changes status to ACTIVE.**  
7. **Sets `activatedAt`.**  
8. **Clears activation token fields.**  
9. **Creates the manager session.**

---

# **4\. Wedding Management APIs**

## **4.1 Endpoint Summary**

| Method | Endpoint | Access | Purpose |
| ----- | ----- | ----- | ----- |
| **POST** | **`/weddings`** | **Admin** | **Create wedding** |
| **GET** | **`/weddings/me`** | **Admin / Manager** | **Retrieve wedding** |
| **PATCH** | **`/weddings/me`** | **Admin** | **Update wedding** |
| **PATCH** | **`/weddings/me/publication`** | **Admin** | **Publish/unpublish website** |
| **PUT** | **`/weddings/me/cover-image`** | **Admin** | **Upload/replace hero image** |
| **DELETE** | **`/weddings/me/cover-image`** | **Admin** | **Remove hero image** |
| **POST** | **`/weddings/me/manager-invitation`** | **Admin** | **Invite manager** |
| **POST** | **`/weddings/me/manager-invitation/resend`** | **Admin** | **Resend invitation** |
| **PATCH** | **`/weddings/me/our-story`** | **Admin** | **Update Our Story description** |
| **POST** | **`/weddings/me/our-story/images`** | **Admin** | **Upload supporting photo** |
| **DELETE** | **`/weddings/me/our-story/images/:imageId`** | **Admin** | **Remove supporting photo** |

## **4.2 POST /weddings**

**Creates a wedding owned by the authenticated admin.**

**Request:**

```
{
  "title": "Rahul Weds Priya",
  "partnerOneName": "Rahul",
  "partnerTwoName": "Priya",
  "weddingDate": "2027-02-15",
  "timeZone": "Asia/Kolkata",
  "introduction": "Together with our families, we invite you to celebrate our wedding.",
  "slug": "rahul-weds-priya"
}
```

**Backend:**

1. **Verify admin role.**  
2. **Check admin does not already own a wedding.**  
3. **Validate information.**  
4. **Check slug uniqueness.**  
5. **Create Wedding.**  
6. **Set `managerId` to null.**  
7. **Set `adminId` from the authenticated session.**

**The client cannot choose `adminId` or `managerId`.**

**Response: `201 Created`.**

## **4.3 GET /weddings/me**

**Returns the wedding belonging to the authenticated admin or manager.**

**The response includes wedding management information and can include private cover-image metadata needed by the dashboard.**

## **4.4 PATCH /weddings/me**

**Updates normal wedding details.**

**Allowed fields:**

* **Title.**  
* **Partner names.**  
* **Wedding date.**  
* **Timezone.**  
* **Introduction.**  
* **Slug, subject to uniqueness validation.**

**This endpoint must not allow the client to change ownership or manager assignment.**

## **4.5 PATCH /weddings/me/publication**

**Request:**

```
{
  "websitePublished": true
}
```

**Access: Admin only.**

**Backend:**

* **Changes publication state.**  
* **Updates `publishedAt`.**  
* **Does not automatically revoke RSVP tokens.**

## **4.6 PUT /weddings/me/cover-image**

**Content type:**

```
multipart/form-data
```

**Field:**

```
image: <file>
```

**Backend:**

1. **Verify admin permission.**  
2. **Validate JPEG, PNG or WebP content and enforce the 10 MB maximum.**
3. **Upload new image to Cloudinary.**  
4. **Update Wedding.coverImage.**  
5. **Delete old Cloudinary asset only after the database update succeeds.**

**If the database update fails after a successful upload, attempt to delete the newly uploaded asset. If Cloudinary cleanup fails, record the asset public ID and operation in structured server logs for manual retry. Do not expose the public ID to the client.**

## **4.8 DELETE /weddings/me/cover-image**

**Purpose: Remove the Wedding hero/cover image.**

**Access: Admin only. Request body: none.**

**Backend:**

1. **Resolve the authenticated Admin's Wedding.**
2. **Remove `Wedding.coverImage` from MongoDB first.**
3. **After the database update succeeds, attempt to delete the Cloudinary asset.**
4. **If no cover image exists, return the same successful result (idempotent).**

**Cloudinary deletion failure does not restore the database reference. Record the asset public ID and operation in structured server logs for manual retry. Do not return the public ID.**

**Success response: HTTP 200 using the standard response envelope, with `data.coverImage` set to `null`.**

## **4.7 Manager Invitation**

### **POST /weddings/me/manager-invitation**

**Request:**

```
{
  "name": "Amit Sharma",
  "email": "amit@example.com"
}
```

**Backend:**

1. **Verify there is no existing manager assignment that prevents another invitation.**  
2. **Normalize and validate email.**  
3. **Check uniqueness and account eligibility.**  
4. **Create invited manager User.**  
5. **Generate activation token.**  
6. **Store token hash and expiry.**  
7. **Assign manager to Wedding.**  
8. **Commit the database changes.**  
9. **Send activation email.**

### **POST /weddings/me/manager-invitation/resend**

**Invalidates the previous activation token, creates a new one, stores its hash and sends a replacement email.**

**It must not create another manager account.**

---

# **5\. Our Story Management APIs**

**This is the new addition to our API design.**

**Our Story belongs to the Wedding module. It does not require a separate controller module or collection.**

**Only the admin can modify the story.**

## **5.1 Our Story API Summary**

| Method | Endpoint | Access | Purpose |
| ----- | ----- | ----- | ----- |
| **PATCH** | **`/weddings/me/our-story`** | **Admin** | **Update story description** |
| **POST** | **`/weddings/me/our-story/images`** | **Admin** | **Add supporting photograph** |
| **DELETE** | **`/weddings/me/our-story/images/:imageId`** | **Admin** | **Remove supporting photograph** |
| **GET** | **`/public/weddings/:slug`** | **Public** | **Retrieve published story** |

**The public GET endpoint is part of the existing Public Website API.**

## **5.2 PATCH /weddings/me/our-story**

**Purpose: Create or update the couple's story description.**

**Request:**

```
{
  "description": "Our journey began with a friendship that slowly grew into something beautiful. We are excited to celebrate this new chapter with our families and loved ones."
}
```

**Backend responsibilities:**

1. **Authenticate the user.**  
2. **Verify the role is ADMIN.**  
3. **Resolve the user's wedding.**  
4. **Validate that description is a string no longer than 1,000 characters.**
5. **Update `Wedding.ourStory.description`.**  
6. **Return the updated story.**

**The endpoint updates only the story description. It must not overwrite supporting photographs.**

**Response:**

```
{
  "success": true,
  "message": "Our Story updated successfully",
  "data": {
    "ourStory": {
      "description": "Our journey began with a friendship that slowly grew into something beautiful.",
      "images": []
    }
  }
}
```

**An empty description can be used to clear the story text.**

## **5.3 POST /weddings/me/our-story/images**

**Purpose: Upload a supporting Our Story photograph.**

**Access: Admin only.**

**Content type:**

```
multipart/form-data
```

**Fields:**

```
image: <file>
altText: "Rahul and Priya together"
```

**Backend responsibilities:**

1. **Authenticate the admin.**  
2. **Resolve the wedding.**  
3. **Validate the uploaded file.**  
4. **Check the current number of supporting images.**  
5. **Reject the request if two images already exist.**  
6. **Upload the file to Cloudinary.**  
7. **Generate an embedded image subdocument ID.**  
8. **Save URL, Cloudinary public ID and alt text in `Wedding.ourStory.images`.**  
9. **Return the updated story information.**

### **Example successful response**

```
{
  "success": true,
  "message": "Our Story photograph uploaded successfully",
  "data": {
    "image": {
      "id": "STORY_IMAGE_ID",
      "url": "https://res.cloudinary.com/example/story1.jpg",
      "altText": "Rahul and Priya together"
    }
  }
}
```

### **Image Limits**

* **Maximum supporting images: 2\.**  
* **JPEG, PNG and WebP.**  
* **Maximum: 10 MB per image.**
* **One upload per API request.**

**The service must enforce the image limit under concurrent requests. A simple check followed by a later update is insufficient if two uploads can run simultaneously. Use an atomic conditional update or suitable transaction/locking strategy so the array cannot exceed two elements.**

**If the database update fails after a successful Cloudinary upload, clean up the newly uploaded asset.**

## **5.4 DELETE /weddings/me/our-story/images/**

**Purpose: Remove one supporting photograph.**

**Access: Admin only.**

**Example:**

```
DELETE /api/v1/weddings/me/our-story/images/STORY_IMAGE_ID
```

**Backend:**

1. **Authenticate admin.**  
2. **Resolve the wedding.**  
3. **Find the embedded image by its subdocument ID.**  
4. **Return 404 if the image is not present.**  
5. **Remove the embedded image from Wedding.**  
6. **After the database update succeeds, delete its Cloudinary asset.**  
7. **Return updated story information.**

**Response:**

```
{
  "success": true,
  "message": "Our Story photograph removed successfully",
  "data": {
    "ourStory": {
      "description": "Our journey began with a friendship.",
      "images": []
    }
  }
}
```

**If Cloudinary deletion fails after the database update, the public website must still stop referencing the removed image. Record the asset public ID and operation in structured server logs for manual retry. Do not restore the database reference.**

## **5.5 Our Story Content Rules**

* **Hero welcome message remains in `Wedding.introduction`.**  
* **Hero image remains in `Wedding.coverImage`.**  
* **Longer couple story is in `Wedding.ourStory.description`.**  
* **Supporting photographs are in `Wedding.ourStory.images`.**  
* **Maximum two photographs.**  
* **Only admin can modify the story.**  
* **The Our Story section is optional.**  
* **Public website displays it only when story content exists.**  
* **Story photographs are separate from Wedding Memories photographs.**  
* **Public APIs return image URL and alt text, not Cloudinary management credentials or private fields.**

---

# **6\. Dashboard APIs**

## **Endpoint Summary**

| Method | Endpoint | Access |
| ----- | ----- | ----- |
| **GET** | **`/dashboard/summary`** | **Admin / Manager** |

### **GET /dashboard/summary**

**Returns:**

* **Total events.**  
* **Upcoming events.**  
* **Total actual expenses.**  
* **Total family records.**  
* **Accepted RSVPs.**  
* **Pending RSVPs.**  
* **Upcoming task deadlines.**

**Example:**

```
{
  "success": true,
  "data": {
    "totalEvents": 5,
    "upcomingEvents": 2,
    "totalExpensesPaise": 35000000,
    "totalFamilies": 150,
    "acceptedRsvps": 95,
    "pendingRsvps": 55,
    "upcomingTasks": 8
  }
}
```

**Values are illustrative.**

**Pending RSVP count represents invited family-event combinations without a response, not individual attendees.**

**The dashboard does not have its own collection.**

---

# **7\. Event Management APIs**

## **7.1 Endpoint Summary**

| Method | Endpoint | Access |
| ----- | ----- | ----- |
| **POST** | **`/events`** | **Admin / Manager** |
| **GET** | **`/events`** | **Admin / Manager** |
| **GET** | **`/events/:eventId`** | **Admin / Manager** |
| **PATCH** | **`/events/:eventId`** | **Admin / Manager** |
| **PATCH** | **`/events/:eventId/status`** | **Admin / Manager** |
| **DELETE** | **`/events/:eventId`** | **Admin / Manager** |

## **7.2 POST /events**

**Request:**

```
{
  "name": "Haldi Ceremony",
  "eventDate": "2027-02-13",
  "startTime": "10:00",
  "endTime": "13:00",
  "status": "UPCOMING",
  "venueName": "The Wedding Garden",
  "venueAddress": "Delhi, India",
  "googleMapsUrl": "https://maps.google.com/?q=example",
  "description": "Join us for the Haldi ceremony.",
  "foodMenu": [
    {
      "category": "Breakfast",
      "items": [
        "Aloo Paratha",
        "Curd",
        "Tea"
      ]
    }
  ],
  "isPublished": false
}
```

**`status` is required and must be `UPCOMING`, `COMPLETED`, or `CANCELLED`. The backend does not supply an undocumented default.**

**Event times use 24-hour `HH:mm` format. Values such as `25:00` and `10:65` are invalid.**

**Backend:**

* **Authenticate organizer.**  
* **Check event-management permissions.**  
* **Resolve wedding from session.**  
* **Validate event fields and menu.**  
* **Validate Maps URL if provided.**  
* **Set `weddingId` and `createdBy` internally.**  
* **Save Event.**

**The client must not set the document's wedding ownership.**

**Response: `201 Created`.**

## **7.3 GET /events**

**Supports:**

```
GET /events?page=1&limit=10
GET /events?status=UPCOMING
GET /events?search=Haldi
GET /events?eventDate=2027-02-13
```

**Results are scoped to the authenticated user's wedding.**

## **7.4 GET /events/**

**Returns event details after checking wedding ownership.**

**Includes:**

* **Event details.**  
* **Food menu.**  
* **Venue and Maps URL.**  
* **Video metadata when available.**  
* **Publication and status information.**

## **7.5 PATCH /events/**

**Updates permitted event details.**

**Example:**

```
{
  "name": "Updated Haldi Ceremony",
  "venueName": "Updated Wedding Garden",
  "foodMenu": [
    {
      "category": "Breakfast",
      "items": ["Aloo Paratha", "Tea"]
    }
  ]
}
```

**The service must verify event ownership and referenced data.**

## **7.6 Event Video Management**

**Video functionality is part of the Event API.**

### **Add a recorded video**

```
{
  "video": {
    "videoType": "RECORDED",
    "provider": "YOUTUBE",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID"
  }
}
```

### **Add a livestream**

```
{
  "video": {
    "videoType": "LIVE",
    "provider": "YOUTUBE",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID"
  }
}
```

### **Remove video**

```
{
  "video": null
}
```

**Backend responsibilities:**

1. **Validate video type.**  
2. **Accept only supported YouTube URLs.**  
3. **Extract video ID on the backend.**  
4. **Store video type, provider, URL and extracted video ID.**  
5. **Reject malformed or unsupported URLs.**

**The backend must never trust a client-supplied video ID.**

**Public APIs provide the video ID needed by React to construct the embedded player.**

**The actual video is hosted by YouTube.**

**A video that is private, unavailable or does not allow embedding may not play. The application must not falsely claim that every submitted video is playable.**

## **7.7 PATCH /events//status**

**Request:**

```
{
  "status": "CANCELLED"
}
```

**Allowed:**

* **UPCOMING.**  
* **COMPLETED.**  
* **CANCELLED.**

**Cancelled events cannot accept new RSVPs.**

**Existing RSVP records and financial references must remain intact.**

**Any transition between `UPCOMING`, `COMPLETED`, and `CANCELLED` is allowed, including restoring a cancelled event. Values outside this enum are rejected.**

## **7.8 DELETE /events/**

**Deletion is restricted.**

**Backend checks:**

* **RSVP records.**  
* **Expenses.**  
* **Tasks.**  
* **Invitation references.**  
* **Photo references.**

**When important dependent records exist, the service rejects deletion and recommends cancellation.**

**Where deletion is safe, it uses logical deletion through `deletedAt`.**

---

# **8\. Task Management APIs**

| Method | Endpoint | Access |
| ----- | ----- | ----- |
| **POST** | **`/tasks`** | **Admin / Manager** |
| **GET** | **`/tasks`** | **Admin / Manager** |
| **GET** | **`/tasks/:taskId`** | **Admin / Manager** |
| **PATCH** | **`/tasks/:taskId`** | **Admin / Manager** |
| **DELETE** | **`/tasks/:taskId`** | **Admin / Manager** |

### **POST /tasks**

```
{
  "title": "Confirm Photographer",
  "description": "Finalize photography booking.",
  "eventId": "EVENT_ID",
  "deadline": "2027-01-20T12:30:00.000Z",
  "priority": "HIGH",
  "status": "TODO"
}
```

**The event ID is optional and must belong to the same wedding.**

**Allowed priority:**

* **LOW.**  
* **MEDIUM.**  
* **HIGH.**

**Allowed status:**

* **TODO.**  
* **IN\_PROGRESS.**  
* **COMPLETED.**

### **GET /tasks**

**Supports filters:**

```
GET /tasks?status=TODO
GET /tasks?priority=HIGH
GET /tasks?eventId=EVENT_ID
GET /tasks?page=1&limit=10
```

### **PATCH /tasks/**

**Updates permitted task fields.**

### **DELETE /tasks/**

**Deletes the task after verifying wedding ownership.**

**There is no task assignment API.**

---

# **9\. Expense Management APIs**

| Method | Endpoint | Access |
| ----- | ----- | ----- |
| **POST** | **`/expenses`** | **Admin / Manager** |
| **GET** | **`/expenses`** | **Admin / Manager** |
| **GET** | **`/expenses/:expenseId`** | **Admin / Manager** |
| **PATCH** | **`/expenses/:expenseId`** | **Admin / Manager** |
| **DELETE** | **`/expenses/:expenseId`** | **Admin / Manager** |

### **POST /expenses**

```
{
  "title": "Catering Payment",
  "category": "CATERING",
  "amountPaise": 8000000,
  "paymentDate": "2027-01-10T10:00:00.000Z",
  "paymentMethod": "UPI",
  "eventId": "EVENT_ID",
  "notes": "Advance payment"
}
```

**Amount is a positive integer in paise.**

**Supported categories:**

* **CATERING.**  
* **DECORATION.**  
* **PHOTOGRAPHY.**  
* **VENUE.**  
* **CLOTHING.**  
* **TRANSPORTATION.**  
* **ENTERTAINMENT.**  
* **MISCELLANEOUS.**

### **GET /expenses**

**Supports:**

```
GET /expenses?category=CATERING
GET /expenses?eventId=EVENT_ID
GET /expenses?dateFrom=2027-01-01&dateTo=2027-01-31
GET /expenses?page=1&limit=10
```

### **PATCH /expenses/**

**Updates permitted expense fields.**

### **DELETE /expenses/**

**Deletes the selected expense after verifying wedding ownership.**

---

# **10\. Guest Management APIs**

## **10.1 Endpoint Summary**

| Method | Endpoint | Access |
| ----- | ----- | ----- |
| **POST** | **`/guests`** | **Admin / Manager** |
| **GET** | **`/guests`** | **Admin / Manager** |
| **GET** | **`/guests/:guestId`** | **Admin / Manager** |
| **PATCH** | **`/guests/:guestId`** | **Admin / Manager** |
| **DELETE** | **`/guests/:guestId`** | **Admin / Manager** |
| **POST** | **`/guests/import`** | **Admin / Manager** |
| **POST** | **`/guests/:guestId/rsvp-link`** | **Admin / Manager** |
| **PATCH** | **`/guests/:guestId/invitation-sharing/common`** | **Admin / Manager** |
| **PATCH** | **`/guests/:guestId/invited-events/:eventId/invitation-sharing`** | **Admin / Manager** |

## **10.2 POST /guests**

**Request:**

```
{
  "familyName": "Sharma Family",
  "primaryContactName": "Amit Sharma",
  "mobile": "+919876543210",
  "email": "amit@example.com",
  "familyGroupInfo": "Groom's relatives",
  "notes": "Close family",
  "invitedEvents": [
    {
      "eventId": "HALDI_EVENT_ID"
    },
    {
      "eventId": "WEDDING_EVENT_ID"
    }
  ]
}
```

**Backend validates event references and creates a family record.**

## **10.3 GET /guests**

**Supports:**

```
GET /guests?page=1&limit=10
GET /guests?search=Sharma
GET /guests?eventId=EVENT_ID
GET /guests?invitationStatus=SHARED
```

**Only active family records are returned by default.**

## **10.4 PATCH /guests/**

**Updates family information and invited events.**

**The service verifies that all event references belong to the same wedding.**

**Removing an event from an invitation list must not silently delete historical RSVP records.**

## **10.5 DELETE /guests/**

**Backend:**

1. **Finds the family record.**  
2. **Revokes RSVP access.**  
3. **If RSVP history exists, marks the Guest as deleted.**  
4. **Preserves existing RSVP records.**  
5. **Excludes the family from normal guest queries.**

**Permanent deletion may be allowed only when safe.**

## **10.6 POST /guests/import**

**Content type: multipart/form-data.**

**Field:**

```
file: guests.csv
```

**Supported columns:**

```
familyName,
primaryContactName,
mobile,
email,
familyGroupInfo,
notes
```

**The importer validates rows, identifies likely duplicates and returns an import summary.**

## **10.7 POST /guests//rsvp-link**

**Generates or regenerates a unique family RSVP link.**

**Backend generates a secure random token and stores only its hash.**

**Response:**

```
{
  "success": true,
  "message": "RSVP link generated",
  "data": {
    "rsvpUrl": "https://example.com/wedding/rahul-weds-priya/rsvp/RAW_TOKEN",
    "expiresAt": "2027-02-20T18:30:00.000Z"
  }
}
```

**The raw link is returned once. Ordinary Guest GET APIs must never return the token.**

**Regenerating a link revokes the previous token.**

**The frontend can use the URL in a prefilled WhatsApp message.**

**The backend does not send WhatsApp messages.**

## **10.8 Invitation Sharing Status**

**Common card:**

```
PATCH /guests/:guestId/invitation-sharing/common
```

**Event card:**

```
PATCH /guests/:guestId/invited-events/:eventId/invitation-sharing
```

**Request:**

```
{
  "status": "SHARED"
}
```

**Allowed statuses:**

* **NOT\_SENT.**  
* **SHARED.**

**Backend records `sharedAt` and `sharedBy`.**

**This is an organizer-managed status, not proof of WhatsApp delivery.**

---

# **11\. Invitation Management APIs**

| Method | Endpoint | Access | Purpose |
| ----- | ----- | ----- | ----- |
| **GET** | **`/invitations`** | **Admin / Manager** | **List cards** |
| **POST** | **`/invitations`** | **Admin / Manager** | **Upload or replace card** |
| **DELETE** | **`/invitations/:invitationId`** | **Admin / Manager** | **Remove card** |

### **POST /invitations**

**Content type:**

```
multipart/form-data
```

**Fields:**

```
image: <file>
type: COMMON or EVENT
eventId: <required for EVENT>
```

**For a common invitation, `eventId` must be omitted or null.**

**For an event invitation, `eventId` is required.**

**Backend:**

1. **Authenticate organizer.**  
2. **Validate role and wedding.**  
3. **Validate invitation type.**  
4. **Validate event ownership when EVENT.**  
5. **Validate the image.**  
6. **Upload to Cloudinary.**  
7. **Create or update the corresponding Invitation document.**  
8. **Delete the old Cloudinary asset only after successful database update.**

**One common card per wedding and one event card per event are enforced through unique indexes.**

### **DELETE /invitations/**

**Removes the card and coordinates Cloudinary cleanup.**

**Guest and RSVP documents remain unchanged.**

---

# **12\. Family RSVP APIs**

**These APIs are public but require the unique family RSVP token.**

| Method | Endpoint | Access |
| ----- | ----- | ----- |
| **GET** | **`/public/rsvp/:token`** | **Family token** |
| **PUT** | **`/public/rsvp/:token/events/:eventId`** | **Family token** |

## **12.1 GET /public/rsvp/**

**Backend:**

1. **Hashes and validates token.**  
2. **Checks expiry and revocation.**  
3. **Finds the active family.**  
4. **Retrieves invited events.**  
5. **Retrieves that family's existing responses.**

**Example response:**

```
{
  "success": true,
  "data": {
    "familyName": "Sharma Family",
    "wedding": {
      "title": "Rahul Weds Priya",
      "slug": "rahul-weds-priya"
    },
    "events": [
      {
        "eventId": "HALDI_EVENT_ID",
        "name": "Haldi Ceremony",
        "eventDate": "2027-02-13",
        "status": "UPCOMING",
        "existingResponse": "YES",
        "canRespond": true
      },
      {
        "eventId": "WEDDING_EVENT_ID",
        "name": "Wedding Ceremony",
        "eventDate": "2027-02-15",
        "status": "UPCOMING",
        "existingResponse": null,
        "canRespond": true
      }
    ]
  }
}
```

**Never return family mobile numbers, emails or other families' information.**

## **12.2 PUT /public/rsvp//events/**

**Request:**

```
{
  "response": "YES"
}
```

**Allowed values:**

* **YES.**  
* **NO.**

**Backend:**

1. **Validate family token.**  
2. **Check expiry and revocation.**  
3. **Find active Guest.**  
4. **Verify invited event.**  
5. **Verify event belongs to same wedding.**  
6. **Verify event is not cancelled or deleted.**  
7. **Create or update the existing RSVP.**  
8. **Return the response.**

**Response:**

```
{
  "success": true,
  "message": "RSVP response saved",
  "data": {
    "eventId": "HALDI_EVENT_ID",
    "response": "YES",
    "respondedAt": "2027-01-15T10:00:00.000Z"
  }
}
```

**The unique compound index prevents duplicate RSVP documents.**

**A family can update its existing YES/NO response.**

---

# **13\. Photo Gallery APIs**

| Method | Endpoint | Access |
| ----- | ----- | ----- |
| **GET** | **`/photos`** | **Admin / Manager** |
| **GET** | **`/photos/:photoId`** | **Admin / Manager** |
| **POST** | **`/photos`** | **Admin / Manager** |
| **PATCH** | **`/photos/:photoId/review`** | **Admin only** |
| **DELETE** | **`/photos/:photoId`** | **Admin / Manager** |
| **POST** | **`/public/weddings/:slug/photos`** | **Public** |

## **13.1 POST /photos**

**Organizer uploads an image through multipart form data.**

**Backend validates, uploads to Cloudinary, and creates a Photo document with APPROVED status.**

## **13.2 GET /photos**

**Supports:**

```
GET /photos?status=PENDING
GET /photos?status=APPROVED
GET /photos?eventId=EVENT_ID
GET /photos?page=1&limit=10
```

**Manager can view pending submissions but cannot approve or reject them.**

## **13.3 PATCH /photos//review**

**Access: Admin only.**

**Request:**

```
{
  "status": "APPROVED"
}
```

**Allowed statuses:**

* **APPROVED.**  
* **REJECTED.**

**Backend sets `reviewedBy` and `reviewedAt`.**

## **13.4 POST /public/weddings//photos**

**Guest submission through multipart form data.**

**Backend verifies the published wedding, applies rate limits, validates the file and optional event, uploads it to Cloudinary and creates a Photo document with PENDING status.**

**Guests cannot choose the approval status.**

## **13.5 DELETE /photos/**

**Coordinates MongoDB and Cloudinary deletion.**

---

# **14\. Announcement APIs**

| Method | Endpoint | Access |
| ----- | ----- | ----- |
| **POST** | **`/announcements`** | **Admin / Manager** |
| **GET** | **`/announcements`** | **Admin / Manager** |
| **GET** | **`/announcements/:announcementId`** | **Admin / Manager** |
| **PATCH** | **`/announcements/:announcementId`** | **Admin / Manager** |
| **DELETE** | **`/announcements/:announcementId`** | **Admin / Manager** |

### **POST /announcements**

```
{
  "title": "Venue Update",
  "description": "The wedding venue entrance has changed.",
  "status": "DRAFT"
}
```

**Allowed statuses:**

* **DRAFT.**  
* **PUBLISHED.**

**`createdBy` is determined by the authenticated user.**

### **GET /announcements**

**Supports status filtering and pagination.**

### **PATCH /announcements/**

**Updates permitted fields and maintains `publishedAt`.**

### **DELETE /announcements/**

**Deletes the announcement after checking wedding ownership.**

**Only published announcements are returned publicly.**

---

# **15\. Public Wedding Website APIs**

**Guests do not need accounts.**

**These APIs return only permitted public content.**

| Method | Endpoint | Access | Purpose |
| ----- | ----- | ----- | ----- |
| **GET** | **`/public/weddings/:slug`** | **Public** | **Retrieve wedding homepage** |
| **GET** | **`/public/weddings/:slug/events`** | **Public** | **Retrieve published events** |
| **GET** | **`/public/weddings/:slug/announcements`** | **Public** | **Retrieve announcements** |
| **GET** | **`/public/weddings/:slug/photos`** | **Public** | **Retrieve approved photographs** |
| **GET** | **`/public/rsvp/:token`** | **Family token** | **Retrieve family RSVP page** |

## **15.1 GET /public/weddings/**

**This API supplies the public homepage.**

**It returns:**

* **Couple names.**  
* **Wedding date and timezone.**  
* **Introduction.**  
* **Cover image.**  
* **Our Story description.**  
* **Up to two Our Story supporting images.**  
* **Common invitation card information where available.**

### **Example Response**

```
{
  "success": true,
  "data": {
    "title": "Rahul Weds Priya",
    "slug": "rahul-weds-priya",

    "partnerOneName": "Rahul",
    "partnerTwoName": "Priya",

    "weddingDate": "2027-02-15",
    "timeZone": "Asia/Kolkata",

    "introduction": "Together with our families, we invite you to celebrate our wedding.",

    "coverImage": {
      "url": "https://res.cloudinary.com/example/hero.jpg"
    },

    "ourStory": {
      "description": "Our journey began with a friendship that slowly grew into something beautiful.",

      "images": [
        {
          "id": "STORY_IMAGE_ID_1",
          "url": "https://res.cloudinary.com/example/story1.jpg",
          "altText": "Rahul and Priya together"
        },
        {
          "id": "STORY_IMAGE_ID_2",
          "url": "https://res.cloudinary.com/example/story2.jpg",
          "altText": "A favourite memory of the couple"
        }
      ]
    },

    "commonInvitation": {
      "imageUrl": "https://res.cloudinary.com/example/wedding.png"
    }
  }
}
```

### **Our Story Public Rules**

* **The endpoint returns story description and supporting image URLs.**  
* **It omits Cloudinary management public IDs.**  
* **It does not return other private wedding information.**  
* **If Our Story is empty, return `null` or an empty object according to the agreed response convention.**  
* **The frontend hides the section when no story content is available.**  
* **The endpoint returns public content only when the wedding is published.**

## **15.2 GET /public/weddings//events**

**Returns only published events belonging to a published wedding.**

**Example:**

```
{
  "success": true,
  "data": [
    {
      "id": "EVENT_ID",
      "name": "Cocktail Party",
      "eventDate": "2027-02-12",
      "startTime": "19:00",

      "venueName": "The Wedding Garden",
      "venueAddress": "Delhi, India",
      "googleMapsUrl": "https://maps.google.com/?q=example",

      "foodMenu": [],

      "invitation": {
        "imageUrl": "https://res.cloudinary.com/example/cocktail.png"
      },

      "video": {
        "videoType": "RECORDED",
        "provider": "YOUTUBE",
        "videoId": "VIDEO_ID"
      }
    }
  ]
}
```

**React uses the video ID to display an embedded YouTube player.**

**The public response does not need to provide Cloudinary public IDs.**

## **15.3 GET /public/weddings//announcements**

**Returns only PUBLISHED announcements.**

## **15.4 GET /public/weddings//photos**

**Returns only APPROVED photographs.**

**It must never return PENDING or REJECTED images.**

## **15.5 Website Publication Rule**

**When the wedding website is unpublished:**

* **Public wedding details are not returned.**  
* **Public events are not returned.**  
* **Public announcements are not returned.**  
* **Public gallery is unavailable.**  
* **Public guest photo submissions are disabled.**

**Family RSVP links are governed separately and can remain active.**

---

# **16\. API Permission Matrix**

| Operation | Admin | Manager | Guest |
| ----- | ----- | ----- | ----- |
| **Register** | **Yes** | **No** | **No** |
| **Login** | **Yes** | **Yes** | **No** |
| **Create wedding** | **Yes** | **No** | **No** |
| **Update wedding settings** | **Yes** | **No** | **No** |
| **Update Our Story** | **Yes** | **No** | **No** |
| **Upload Our Story photos** | **Yes** | **No** | **No** |
| **Remove Our Story photos** | **Yes** | **No** | **No** |
| **Invite manager** | **Yes** | **No** | **No** |
| **Publish website** | **Yes** | **No** | **No** |
| **Manage events** | **Yes** | **Yes** | **No** |
| **Manage tasks** | **Yes** | **Yes** | **No** |
| **Manage expenses** | **Yes** | **Yes** | **No** |
| **Manage guests** | **Yes** | **Yes** | **No** |
| **Manage invitation cards** | **Yes** | **Yes** | **No** |
| **View RSVP responses** | **Yes** | **Yes** | **No** |
| **Submit family RSVP** | **No account required** | **No account required** | **Valid family token** |
| **Manage announcements** | **Yes** | **Yes** | **No** |
| **Upload organiser photos** | **Yes** | **Yes** | **No** |
| **Submit guest photos** | **No account required** | **No account required** | **Yes** |
| **Approve guest photos** | **Yes** | **No** | **No** |
| **View published wedding site** | **Yes** | **Yes** | **Yes** |

**The backend enforces every permission. Frontend button visibility is not a security control.**

---

# **17\. File Upload Rules**

**Images are uploaded to Express, validated and sent to Cloudinary.**

## **Supported Types**

* **JPEG.**  
* **PNG.**  
* **WebP.**

## **Initial Proposed Limits**

| Upload Type | Maximum File Size |
| ----- | ----- |
| **Invitation card** | **10 MB** |
| **Wedding cover** | **10 MB** |
| **Our Story photograph** | **10 MB** |
| **Gallery photograph** | **10 MB** |

## **Our Story Specific Rules**

* **Admin only.**  
* **Maximum two supporting images.**  
* **Image must include an alt description.**  
* **Upload through multipart form data.**  
* **Cloudinary metadata saved inside Wedding.ourStory.images.**  
* **A third image is rejected with a validation error.**

**The backend must validate actual file content, not only the supplied filename or MIME type.**

**Cloudinary credentials must never be exposed to React.**

---

# **18\. Error Handling**

**All errors pass through centralised Express error handling.**

| Code | Meaning | HTTP |
| ----- | ----- | ----- |
| **VALIDATION\_ERROR** | **Invalid request data** | **400** |
| **UNAUTHORIZED** | **Authentication required** | **401** |
| **FORBIDDEN** | **Insufficient permission** | **403** |
| **NOT\_FOUND** | **Resource not found** | **404** |
| **CONFLICT** | **Duplicate or conflicting operation** | **409** |
| **TOKEN\_INVALID** | **Invalid token** | **400 or 404** |
| **TOKEN\_EXPIRED** | **Expired token** | **410** |
| **TOKEN\_REVOKED** | **Revoked token** | **410** |
| **EVENT\_NOT\_INVITED** | **Family is not invited** | **403** |
| **EVENT\_CANCELLED** | **Cannot accept new RSVP** | **409** |
| **STORY\_IMAGE\_LIMIT\_REACHED** | **Two images already exist** | **409** |
| **FILE\_TOO\_LARGE** | **File exceeds configured limit** | **413** |
| **UNSUPPORTED\_MEDIA\_TYPE** | **Unsupported file** | **415** |
| **RATE\_LIMITED** | **Too many requests** | **429** |
| **EXTERNAL\_SERVICE\_ERROR** | **Cloudinary or email failure** | **502** |
| **INTERNAL\_SERVER\_ERROR** | **Unexpected error** | **500** |

**Example:**

```
{
  "success": false,
  "message": "You can upload a maximum of two Our Story photographs",
  "error": {
    "code": "STORY_IMAGE_LIMIT_REACHED"
  }
}
```

**Internal stack traces and sensitive database details must not be returned.**

---

# **19\. API Security Requirements**

## **Authentication**

* **Secure password hashing.**  
* **HTTP-only session cookies.**  
* **Session regeneration on login.**  
* **Session destruction on logout.**  
* **Secure activation and reset tokens.**  
* **CSRF protection for cookie-authenticated mutations.**

## **Authorization**

* **Role-based permission checks.**  
* **Wedding-level isolation.**  
* **Resource ownership validation.**  
* **Admin-only Our Story editing.**  
* **Admin-only website publication.**  
* **Admin-only photo approval.**

## **Public API Security**

* **No guest contact information in public responses.**  
* **Family RSVP token validation.**  
* **Public upload rate limiting.**  
* **Explicit field projections.**  
* **No pending or rejected photos in public gallery.**  
* **No raw tokens in logs.**

## **RSVP Link Security**

**Because the link contains a bearer token:**

* **Use cryptographically random tokens.**  
* **Store only hashes.**  
* **Set expiry.**  
* **Support revocation.**  
* **Avoid logging raw tokens.**  
* **Apply a strict referrer policy on RSVP pages.**  
* **Return only the relevant family's information.**

---

# **20\. API Testing Strategy**

**Every endpoint must have automated tests.**

## **Authentication**

* **Admin registration.**  
* **Duplicate email rejection.**  
* **Login.**  
* **Invalid credentials.**  
* **Logout.**  
* **Manager activation.**  
* **Expired activation token.**  
* **Reused activation token.**  
* **Password reset.**  
* **Invalidated session behaviour.**

## **Wedding**

* **Admin creates wedding.**  
* **Second wedding creation is rejected.**  
* **Manager cannot update ownership.**  
* **Website publication works.**  
* **Hero image upload and replacement work.**

## **Our Story**

* **Admin can create and update description.**  
* **Manager cannot edit Our Story.**  
* **First supporting image uploads successfully.**  
* **Second supporting image uploads successfully.**  
* **Third supporting image is rejected.**  
* **Invalid image type is rejected.**  
* **Oversized image is rejected.**  
* **Image is removed by embedded ID.**  
* **Public response contains allowed Our Story fields.**  
* **Public response omits Cloudinary management IDs.**  
* **Unpublished wedding content is not returned.**  
* **Image cleanup handles Cloudinary failures correctly.**

## **Events**

* **Event creation.**  
* **Event ownership validation.**  
* **Event updates.**  
* **Menu validation.**  
* **Maps URL validation.**  
* **Event cancellation.**  
* **Unsafe deletion prevention.**  
* **YouTube URL validation.**  
* **YouTube video ID extraction.**  
* **LIVE and RECORDED video types.**  
* **Video removal.**

## **Guests and RSVP**

* **Create family record.**  
* **Invite family to multiple events.**  
* **Generate RSVP link.**  
* **Regenerate token.**  
* **Reject expired token.**  
* **Reject revoked token.**  
* **Reject uninvited event.**  
* **Create and update response.**  
* **Prevent duplicate RSVP documents.**  
* **Hide contact information.**

## **Invitations and Photos**

* **Common card upload.**  
* **Event card upload.**  
* **Duplicate card prevention.**  
* **Image replacement.**  
* **Manager upload permissions.**  
* **Guest photo submissions.**  
* **Admin approval.**  
* **Manager approval prohibition.**  
* **Rejected photos excluded from public API.**

## **Public Website**

* **Published wedding retrieval.**  
* **Unpublished wedding rejection.**  
* **Our Story retrieval.**  
* **Conditional Our Story data.**  
* **Published events only.**  
* **Published announcements only.**  
* **Approved photos only.**  
* **Video information returned for embedding.**  
* **No private guest data exposed.**

---

# **21\. Module-to-API Mapping**

| Backend Module | API Group | PRD |
| ----- | ----- | ----- |
| **Auth** | **`/auth`** | **FR-01** |
| **Wedding** | **`/weddings`** | **FR-01** |
| **Dashboard** | **`/dashboard`** | **FR-02** |
| **Events** | **`/events`** | **FR-03, FR-10** |
| **Tasks** | **`/tasks`** | **FR-03** |
| **Expenses** | **`/expenses`** | **FR-04** |
| **Guests** | **`/guests`** | **FR-05** |
| **Invitations** | **`/invitations`** | **FR-06** |
| **RSVP** | **`/public/rsvp`** | **FR-06** |
| **Public Website** | **`/public/weddings`** | **FR-07** |
| **Announcements** | **`/announcements`** | **FR-08** |
| **Photos** | **`/photos`** | **FR-09** |

**Our Story endpoints are part of the Wedding API and Public Website API.**

---

# **22\. Implementation Order**

**We will implement APIs in the following order:**

| Phase | Module | Deliverable |
| ----- | ----- | ----- |
| **1** | **Auth** | **Admin registration, login and sessions** |
| **2** | **Wedding** | **Wedding creation and manager onboarding** |
| **3** | **Wedding** | **Our Story description and image APIs** |
| **4** | **Dashboard** | **Statistics** |
| **5** | **Events** | **Event CRUD, menus, directions and videos** |
| **6** | **Tasks** | **Shared task management** |
| **7** | **Expenses** | **Actual expenses** |
| **8** | **Guests** | **Family records and CSV import** |
| **9** | **Invitations** | **Canva card uploads** |
| **10** | **RSVP** | **Secure family RSVP** |
| **11** | **Announcements** | **Wedding updates** |
| **12** | **Photos** | **Gallery and approval** |
| **13** | **Public Website** | **Published wedding experience** |
| **14** | **Testing and CI/CD** | **Automated checks and deployment** |

**Testing must be written alongside each module rather than postponed to the end.**

---

# **23\. Final API Decisions**

| Area | Final Decision |
| ----- | ----- |
| **API architecture** | **REST** |
| **API version** | **v1** |
| **Authentication** | **Server-side sessions** |
| **Browser authentication** | **HTTP-only cookies** |
| **CSRF protection** | **Required** |
| **Authorization** | **Role-based and wedding-level** |
| **Request format** | **JSON** |
| **File uploads** | **Multipart form data** |
| **Image storage** | **Cloudinary** |
| **Video provider** | **YouTube** |
| **Video types** | **LIVE / RECORDED** |
| **Video playback** | **Embedded player** |
| **Our Story update** | **PATCH endpoint** |
| **Our Story image upload** | **POST endpoint** |
| **Our Story image removal** | **DELETE endpoint** |
| **Our Story public retrieval** | **Existing public wedding endpoint** |
| **Our Story image limit** | **Two** |
| **RSVP access** | **Secure family token** |
| **WhatsApp sharing** | **Manual prefilled link** |
| **API responses** | **Standard JSON** |
| **Pagination** | **Page and limit** |
| **Error handling** | **Centralized middleware** |

---

# **24\. Final API Architecture Principle**

**Every endpoint must have:**

1. **A clearly defined responsibility.**  
2. **A specific HTTP method and route.**  
3. **A documented request structure.**  
4. **A documented response structure.**  
5. **Explicit authentication and authorization requirements.**  
6. **Input and business-rule validation.**  
7. **Defined error handling.**  
8. **Automated tests.**

**The API architecture must implement the approved PRD and database design without introducing features outside the MVP.**

**Final principle: The API is the contract between our React application, Express backend, database and external services. All implementations must follow this contract or update it deliberately before changing behaviour.**

