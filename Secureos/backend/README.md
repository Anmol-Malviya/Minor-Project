# REALITY DREAMS — Backend Documentation

## 1. Project Overview

REALITY DREAMS is a high-performance, enterprise-grade real estate backend service designed to power luxury property discovery, enquiries, saved wishlists, administrative portfolio management, and dynamic website configurations.

The backend strictly conforms to the approved `REALITY_DREAMS_SRS_v1.0.docx` specification, enforcing strict data isolation, role-based authorization, rate limiting, and cryptographic asset verification.

---

## 2. Technology Stack

- **Runtime & Language**: Node.js (v20+ recommended), TypeScript (v7.x)
- **Web Framework**: Express.js (v5.x)
- **Database**: MongoDB with Mongoose (v9.x) ODM
- **Authentication**: Clerk Express SDK (`@clerk/express`)
- **Validation**: Zod (v4.x)
- **Media Storage**: Cloudinary SDK (v2.x) with server-side signature signing and asset verification
- **Security & Infrastructure**: Helmet, CORS, Express Rate Limit (`express-rate-limit`)
- **Development Tooling**: Nodemon, tsx, Node Test Runner (`node:test`)

---

## 3. Backend Folder Structure

```
backend/
├── src/
│   ├── config/               # Database and Cloudinary client configurations
│   │   ├── database.ts
│   │   └── cloudinary.ts
│   ├── controllers/          # Express route controllers
│   │   ├── adminEnquiry.controller.ts
│   │   ├── adminOverview.controller.ts
│   │   ├── adminPartner.controller.ts
│   │   ├── adminProperty.controller.ts
│   │   ├── adminSettings.controller.ts
│   │   ├── adminUser.controller.ts
│   │   ├── enquiry.controller.ts
│   │   ├── me.controller.ts
│   │   ├── partner.controller.ts
│   │   ├── property.controller.ts
│   │   ├── settings.controller.ts
│   │   └── upload.controller.ts
│   ├── middleware/           # Centralized security, rate limiting, and error handlers
│   │   ├── auth.ts           # requireAuth, optionalAuth, requireAdmin, extractRole
│   │   ├── errorHandler.ts   # Centralized error mapping & sanitization
│   │   └── rateLimiter.ts    # enquiryLimiter, uploadSignatureLimiter, generalLimiter
│   ├── models/               # Mongoose schemas, types, and compound indexes
│   │   ├── AuditLog.ts
│   │   ├── Enquiry.ts
│   │   ├── Partner.ts
│   │   ├── Property.ts
│   │   ├── SiteSettings.ts
│   │   ├── UserProfile.ts
│   │   ├── Wishlist.ts
│   │   └── index.ts
│   ├── routes/               # Express routers grouped by access domain
│   │   ├── admin.routes.ts
│   │   ├── enquiry.routes.ts
│   │   ├── health.routes.ts
│   │   ├── me.routes.ts
│   │   ├── partner.routes.ts
│   │   ├── property.routes.ts
│   │   └── settings.routes.ts
│   ├── scripts/              # Idempotent database seed utilities
│   │   └── seed.ts
│   ├── services/             # Core business logic services
│   │   └── image.service.ts  # Cloudinary verification & cleanup
│   ├── types/                # Ambient and authentication type declarations
│   │   ├── auth.ts
│   │   └── express.d.ts
│   ├── utils/                # API response helpers
│   │   └── apiResponse.ts
│   ├── validators/           # Zod input schemas for query params and payloads
│   │   ├── admin.validator.ts
│   │   ├── enquiry.validator.ts
│   │   ├── me.validator.ts
│   │   └── property.validator.ts
│   ├── app.ts                # Express application configuration & route mounting
│   └── server.ts             # Server entrypoint with graceful shutdown handling
├── dist/                     # Compiled JavaScript output
├── .env                      # Local environment configuration (git-ignored)
├── .env.example              # Template environment configuration
├── package.json              # Dependencies and npm scripts
├── tsconfig.json             # TypeScript compiler settings
└── README.md                 # Complete backend system documentation
```

---

## 4. Prerequisites

- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher
- **MongoDB**: Local MongoDB instance (v6.0+) or MongoDB Atlas connection string
- **Clerk Account**: For user authentication and role assignment
- **Cloudinary Account**: For property image and partner logo hosting

---

## 5. Installation Instructions

1. Clone or navigate to the repository directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

---

## 6. Environment Variable Configuration

Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=4000
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/reality_dreams

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
INITIAL_ADMIN_CLERK_ID=user_2... # Optional: auto-assigns ADMIN role to this Clerk user ID

# Cloudinary Media Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 7. MongoDB Local Setup

Ensure MongoDB is running locally:

- **Windows**: Start via Windows Services (`MongoDB Server`) or run:
  ```powershell
  net start MongoDB
  ```
- **macOS / Linux**:
  ```bash
  brew services start mongodb-community
  # or
  sudo systemctl start mongod
  ```

---

## 8. Clerk Configuration

1. In the [Clerk Dashboard](https://dashboard.clerk.com), create an application.
2. Under **API Keys**, copy `Publishable key` and `Secret key` into `.env`.
3. To configure an administrator:
   - Option A: Set `INITIAL_ADMIN_CLERK_ID` in `.env` to the admin user's Clerk User ID (`user_...`).
   - Option B: In the Clerk Dashboard under **User > Metadata > Public Metadata**, set:
     ```json
     {
       "role": "ADMIN"
     }
     ```

---

## 9. Cloudinary Configuration

1. In the [Cloudinary Console](https://cloudinary.com/console), note your **Cloud Name**, **API Key**, and **API Secret**.
2. Add these to your `.env` file.
3. Media uploads are strictly routed through signed parameters targeting the `reality-dreams/properties` folder.

---

## 10. Running the Development Server

Start the local server with hot reload:

```bash
npm run dev
```

The server will listen at `http://localhost:4000`.

---

## 11. Building and Running Production Code

Compile TypeScript to JavaScript and run:

```bash
npm run build
npm start
```

---

## 12. Running Tests

Run the complete test suite (compiles TypeScript and executes 100+ automated unit and integration tests):

```bash
npm test
```

---

## 13. Running the Seed Script

To populate the development database with realistic properties, partners, and default site settings:

```bash
npm run seed
```

### Safety Features of the Seed Script:
- **Production Guard**: Aborts immediately if `NODE_ENV=production`.
- **Idempotency**: Checks existing records by slug/name before creating; never creates duplicates.
- **Data Integrity**: Creates Published properties with compliant image structures and exactly one primary image.

---

## 14. API Endpoint Catalogue

### 14.1 Public APIs

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Healthcheck and server readiness probe |
| `GET` | `/api/v1/properties` | List published properties with filtering, search, sorting, and pagination |
| `GET` | `/api/v1/properties/:slug` | View single published property details (safe public projection) |
| `POST` | `/api/v1/enquiries` | Submit enquiry as a guest or authenticated user (rate-limited) |
| `GET` | `/api/v1/settings` | Public website configuration and hero/about content |
| `GET` | `/api/v1/partners` | List active homepage partners sorted by sortOrder |

### 14.2 User Protected APIs (`requireAuth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/me/enquiries` | View current user's submitted enquiry history (strips internal notes) |
| `GET` | `/api/v1/me/wishlist` | View current user's saved wishlist properties |
| `POST` | `/api/v1/me/wishlist/:propertyId` | Add a published property to current user's wishlist |
| `DELETE` | `/api/v1/me/wishlist/:propertyId` | Remove a property from current user's wishlist |

### 14.3 Admin APIs (`requireAuth` + `requireAdmin`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/overview` | Real-time counts across all statuses and recent business activity |
| `GET` | `/api/v1/admin/properties` | List all properties (Draft, Published, Sold, Archived) with filters |
| `GET` | `/api/v1/admin/properties/:id` | Full administrative property inspection (including Drafts) |
| `POST` | `/api/v1/admin/properties` | Create property draft/listing with Cloudinary asset validation |
| `PATCH` | `/api/v1/admin/properties/:id` | Update property details, images, and status; tracks lastUpdatedBy |
| `DELETE` | `/api/v1/admin/properties/:id` | Soft-archive property (`status: "Archived"`) |
| `POST` | `/api/v1/admin/uploads/signature`| Generate time-limited, folder-restricted Cloudinary upload signature |
| `GET` | `/api/v1/admin/enquiries` | Enquiry inbox with status filtering, keyword search, and pagination |
| `GET` | `/api/v1/admin/enquiries/:id` | Detailed enquiry inspection with internal notes & property info |
| `PATCH` | `/api/v1/admin/enquiries/:id` | Update status & internal notes; records admin audit log |
| `GET` | `/api/v1/admin/users` | Overview of registered user profiles (safe projection) |
| `GET` | `/api/v1/admin/settings` | Retrieve full administrative website configuration |
| `PATCH` | `/api/v1/admin/settings` | Update site content, contact, section order, visibility & logo |
| `GET` | `/api/v1/admin/partners` | List all partners (active & inactive) |
| `POST` | `/api/v1/admin/partners` | Create partner with verified logo asset and audit log |
| `PATCH` | `/api/v1/admin/partners/:id` | Update partner details, logo, or ordering with audit log |
| `DELETE` | `/api/v1/admin/partners/:id` | Soft-deactivate partner (`isActive: false`) with audit log |

---

## 15. Authentication & Authorization Explanation

1. **Token Verification**: live Clerk JWT tokens are extracted and verified server-side using `@clerk/express`.
2. **Identity Derivation**: `clerkUserId` is derived strictly from the verified session claims (`res.locals.auth.clerkUserId`). Client-supplied user IDs in request bodies or query strings are ignored.
3. **Role-Based Access Control**:
   - `requireAuth`: Enforces that a valid user is signed in (returns `401 Unauthorized` if unauthenticated).
   - `requireAdmin`: Enforces that the verified user possesses `ADMIN` privileges (returns `403 Forbidden` for standard users).
   - Role extraction checks Clerk public metadata `role === "ADMIN"` or match with `INITIAL_ADMIN_CLERK_ID`.

---

## 16. Important Security Considerations

- **Private Address Protection**: `location.streetAddress` is omitted from all public property responses.
- **Unpublished Property Concealment**: Public property endpoints strictly query `{ status: "Published" }`. Draft, Sold, and Archived properties return `404 Not Found` to public users.
- **Internal Note Isolation**: `internalNotes` on enquiries are exclusively accessible through `/api/v1/admin/enquiries/*`.
- **Cloudinary Security**:
  - The API secret is never returned to the frontend.
  - Signatures are restricted to the `reality-dreams/properties` folder.
  - Saved images are verified against Cloudinary server-side metadata (format, size <= 10MB, secure URL match).
  - Unreferenced images removed during property updates are automatically pruned from Cloudinary unless shared by another property.
- **Rate Limiting**:
  - Public enquiry submissions: 10 requests per 15-minute window per IP (`enquiryLimiter`).
  - Upload signatures: 50 requests per 15-minute window per admin IP (`uploadSignatureLimiter`).
  - General API: 300 requests per 15-minute window per IP (`generalLimiter`).
- **Audit Logging**: Sensitive administrative actions (`UPDATE_ENQUIRY`, `UPDATE_SITE_SETTINGS`, `CREATE_PARTNER`, `UPDATE_PARTNER`, `DEACTIVATE_PARTNER`) create immutable audit records in the `AuditLog` collection.

