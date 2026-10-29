    # DamiRent — Architecture & Planning Document



> Version 1.0 · 2026-10-29 · Awaiting approval before implementation begins.

---

## Table of Contents

- [A. Product Requirements Document](#a-product-requirements-document)
- [B. User Personas and Primary User Journeys](#b-user-personas-and-primary-user-journeys)
- [C. Feature List — MVP, Phase 2, Phase 3](#c-feature-list--mvp-phase-2-phase-3)
- [D. Screen-by-Screen Mobile Application Structure](#d-screen-by-screen-mobile-application-structure)
- [E. User Navigation Flow](#e-user-navigation-flow)
- [F. Backend Application and Module Architecture](#f-backend-application-and-module-architecture)
- [G. Database Entity Relationships](#g-database-entity-relationships)
- [H. API Endpoint Plan](#h-api-endpoint-plan)
- [I. Booking Lifecycle and State Transitions](#i-booking-lifecycle-and-state-transitions)
- [J. Payment and Refund Lifecycle](#j-payment-and-refund-lifecycle)
- [K. Security and Authorization Requirements](#k-security-and-authorization-requirements)
- [L. UI/UX Design System](#l-uiux-design-system)
- [M. Testing Strategy](#m-testing-strategy)
- [N. Deployment Architecture](#n-deployment-architecture)
- [O. Risks, Assumptions, and Unresolved Business Decisions](#o-risks-assumptions-and-unresolved-business-decisions)

---

## A. Product Requirements Document

### Problem Statement

People in Nepal own valuable items — cameras, power tools, sports equipment, musical instruments, camping
gear — that sit idle most of the time. Meanwhile, others need those same items temporarily but cannot
justify the purchase cost. No trusted, easy-to-use digital marketplace currently exists to connect these two
groups locally.

### Product Vision

DamiRent is a peer-to-peer rental marketplace that empowers everyday Nepali users to earn income from
their belongings while giving renters affordable, flexible access to the things they need without buying
them. Every registered user can simultaneously act as a product owner and a renter.

### Goals

| # | Goal                          | Success Indicator                                   |
|---|-------------------------------|-----------------------------------------------------|
| 1 | Build trust between strangers | Verified profiles, ratings, condition reports       |
| 2 | Minimize transaction friction | Booking request to confirmation under 5 minutes     |
| 3 | Reliable owner payouts        | Owner receives funds within 48 h of rental start    |
| 4 | Grow active catalogue         | 500 active listings within 3 months of launch       |
| 5 | Low dispute rate              | Fewer than 5% of completed rentals escalate         |

### Target Users

- **Primary market:** Kathmandu Valley residents aged 18–45 with smartphones
- **Secondary markets:** Pokhara, Lalitpur, Bhaktapur
- **Language:** English UI at launch; Nepali UI in Phase 2
- **Currency:** NPR (Nepali Rupee), no decimals in display
- **Timezone:** Asia/Kathmandu (UTC+5:45)

### Core Business Rules

1. Every registered user may both list products and rent products — no separate account types.
2. An owner cannot rent their own product.
3. Confirmed bookings for the same product cannot overlap — enforced at the database level using
   row-level locking in a transaction.
4. Rental totals, platform fees, and security deposits are computed server-side. Client-submitted
   amounts are rejected.
5. The platform collects a service fee per completed transaction (percentage TBD — see Section O).
6. Security deposits are held in escrow until the owner confirms the return.
7. Physical product handoff is arranged directly between users. The platform does not provide
   logistics.
8. The platform does not store raw payment card details under any circumstances.

### Success Metrics — MVP

- Time from registration to first booking request: under 10 minutes
- Owner response rate (approve or reject) above 80% within 24 hours
- Zero overlapping confirmed bookings (hard database constraint)
- Payment callbacks processed idempotently — no duplicate charges
- App store rating at or above 4.0 within the first 90 days

### Constraints

- Budget and team size require a focused MVP with no feature creep.
- Payment processing limited to gateways available in Nepal (Khalti, eSewa).
- No cross-border payments or foreign currency support.
- Platform does not provide insurance or logistics.

### Out of Scope for MVP

- Real-time GPS tracking
- In-app video calls or video condition reports
- Subscription or membership tiers
- Automated damage assessment or AI-based pricing
- Third-party logistics integration
- Nepali language UI (Phase 2)
- Web application
- Multi-currency support

---

## B. User Personas and Primary User Journeys

### Persona 1 — Sita, the Occasional Owner

- **Age:** 31 | **Occupation:** Graphic designer, Kathmandu
- **Tech comfort:** High — uses Instagram, Daraz, uses UPI payments daily
- **Device:** Android mid-range smartphone
- **Owns:** A DSLR camera used on weekends, a tent, a portable projector
- **Goal:** Earn side income from her camera when she is not using it
- **Pain points:** Worried about damage, does not know how to price, fears unreliable renters
- **What she needs:** Simple listing flow, damage protection via deposit, renter ratings, clear payout timing

**Primary Journey — List a Product:**
1. Downloads app, registers with phone number, verifies OTP
2. Taps "List a Product", selects category (Photography)
3. Uploads 4 photos, writes description, sets NPR 800/day, NPR 3,000 deposit, min 1 day
4. Sets availability (blocks off personal use dates on the calendar)
5. Publishes listing — it appears in Discover
6. Receives booking request notification, reviews renter profile and rating
7. Approves booking, arranges handoff location via in-app message
8. Marks item as returned after renter brings it back, leaves review

---

### Persona 2 — Rohan, the Budget Renter

- **Age:** 24 | **Occupation:** University student, Lalitpur
- **Tech comfort:** High — heavy smartphone user
- **Device:** iPhone SE
- **Goal:** Rent camping gear for a 3-day trek in Langtang without buying it
- **Pain points:** Does not know who to trust, afraid of hidden costs, unsure about deposit refund
- **What he needs:** Clear pricing, transparent deposit policy, owner trust indicators, easy booking

**Primary Journey — Rent a Product:**
1. Opens app, searches "camping tent"
2. Filters by location (Lalitpur), price (under NPR 500/day), availability (this weekend)
3. Views product detail — photos, description, owner rating, 12 successful rentals badge
4. Checks availability calendar, selects 3 days
5. Reviews price breakdown: rental NPR 1,200 + deposit NPR 2,000 + platform fee NPR 120 = NPR 3,320
6. Submits booking request, waits for owner approval notification (arrives in 2 hours)
7. Completes payment via Khalti
8. Receives pickup confirmation, collects gear, goes trekking
9. Returns gear, owner confirms return, deposit refunded within 24 hours
10. Leaves a 5-star review

---

### Persona 3 — Bikash, the Power User (Dual Role)

- **Age:** 38 | **Occupation:** Electrical contractor, Bhaktapur
- **Tech comfort:** Medium — comfortable with apps but prefers simplicity
- **Device:** Android budget phone
- **Owns:** Professional power tools, scaffolding equipment
- **Also rents:** A van or pickup truck when needed for large jobs
- **Goal:** Maximise equipment utilisation — rent his idle tools out, rent vehicles when needed
- **Pain points:** Needs clear booking calendar per item, wants fast owner approval notifications,
  worried about booking conflicts

**Primary Journey — Manage Multiple Listings:**
1. Logs in, goes to Profile → My Listings
2. Reviews booking requests across 3 active listings
3. Approves one, rejects another (dates conflict with his own job), marks third as unavailable
4. Switches to "My Bookings as Renter" tab to check a truck rental he booked for tomorrow
5. Messages the truck owner to confirm pickup time

---

### Persona 4 — Anita, the Cautious First-Timer

- **Age:** 45 | **Occupation:** School teacher, Pokhara
- **Tech comfort:** Low — basic smartphone user, mostly calls and WhatsApp
- **Device:** Android entry-level phone
- **Goal:** Rent a projector for a school event (one day only)
- **Pain points:** Confused by apps, nervous about online payments, needs reassurance
- **What she needs:** Large text, minimal steps, clear confirmation screens, phone number login

---

## C. Feature List — MVP, Phase 2, Phase 3

### MVP (Build First — Core Rental Loop)

**Authentication and Profiles**
- Phone number registration with OTP verification
- JWT-based login and session management
- User profile: full name, profile photo, bio, location (city)
- View other users' public profiles

**Product Listing**
- Create listing: title, description, category, condition, photos (up to 8)
- Set price per day in NPR, security deposit amount, minimum rental days
- Set pickup/meetup location (text field + optional map pin)
- Activate, deactivate, and edit listings
- Upload images to cloud storage (AWS S3)

**Product Discovery and Search**
- Browsable category tiles on home screen
- Keyword search with basic filtering (category, min/max price)
- Sort by: newest, price low–high, price high–low
- Product detail screen with photo gallery, description, pricing, owner info

**Availability Calendar**
- Owner can block specific dates on a per-product calendar
- Renter can view product availability before requesting
- System auto-blocks dates when a booking is confirmed

**Booking**
- Renter submits booking request (dates, message to owner)
- Owner receives push notification, approves or rejects within a configurable window
- Server computes and locks total (rental + deposit + platform fee)
- Renter proceeds to payment after approval
- Booking status visible to both parties with clear labels

**Payments**
- Integration with one gateway (Khalti recommended — see Section O for decision)
- Initiate payment on server, redirect to gateway, handle callback
- Idempotent callback processing — duplicate webhooks are ignored
- Security deposit collected at same time as rental payment
- Owner payout on rental completion (net of platform fee)
- Security deposit refunded to renter on confirmed return

**Notifications**
- Push notifications via Expo Notifications / FCM
- Trigger on: booking request, approval, rejection, payment confirmation, return confirmed,
  new review, deposit refunded
- In-app notification centre (read/unread)

**Reviews and Ratings**
- Both renter and owner can leave one review per completed booking
- Rating 1–5 stars + optional written comment
- Reviews visible on user profile and product listing
- Aggregate rating shown on product cards and profiles

**Owner-Facing**
- "My Listings" tab in profile
- Booking requests panel (incoming requests to approve/reject)
- Booking history as owner

**Renter-Facing**
- "My Bookings" tab showing active, upcoming, and past bookings
- Booking detail with status timeline

---

### Phase 2 (Deepen Trust and Control)

- In-app messaging per booking (conversation between owner and renter)
- Condition reports with photos — before and after the rental
- Enhanced search: location radius, availability date range filter, rating filter
- Cancellation policies (flexible / moderate / strict) per listing
- Refund engine tied to cancellation policy and timing
- Identity verification (government ID photo upload + manual review or third-party)
- Owner earnings dashboard (total earned, pending payouts, history)
- Favourites / saved listings
- Report a listing or user
- Dispute filing and admin review workflow
- Availability calendar: recurring blocked days (e.g., every Sunday)
- eSewa payment gateway as second option
- Automated booking expiry (pending requests auto-cancel after X hours)

---

### Phase 3 (Scale and Differentiation)

- Nepali language (i18n)
- AI-based pricing suggestions based on category and market data
- Recommendation engine ("People also rented")
- Subscription plan for power listers (reduced platform fee, featured placement)
- Analytics dashboard for admins (GMV, booking volume, active users, churn)
- Multi-city geo filtering with map view
- Referral program
- Social proof: "X people viewed this today"
- Bulk listing import (CSV)
- Public API for partner integrations

---

## D. Screen-by-Screen Mobile Application Structure

### Auth Stack (unauthenticated)

| Screen              | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| Splash              | Brand logo; redirects to onboarding or home based on auth state |
| Onboarding (3 slides) | Value proposition — earn, rent, trust                        |
| Register            | Phone number input → OTP → name, optional email, password      |
| Login               | Phone + password; link to forgot password                      |
| OTP Verification    | 6-digit code entry with resend timer                           |
| Forgot Password     | Phone number input → OTP → new password                        |

### Main App — 5 Tabs

#### Tab 1: Discover (Home)
| Screen              | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| Discover            | Search bar shortcut, category tiles, featured listings, recently viewed |
| Category Browse     | Grid of products in a selected category                        |

#### Tab 2: Search
| Screen              | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| Search              | Full-text search input, filter chips, sort control, results list |
| Filter Sheet (modal) | Price range slider, category picker, condition, min days      |

#### Tab 3: Bookings
| Screen              | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| My Bookings         | Toggle: "As Renter" / "As Owner"; segmented list by status     |
| Booking Detail      | Full booking info, status timeline, actions (cancel, confirm return, review) |
| Incoming Requests   | Owner view of pending approval requests                        |

#### Tab 4: Inbox (Phase 2)
| Screen              | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| Conversations List  | List of booking-linked conversations                           |
| Chat Detail         | Message thread between owner and renter                        |

#### Tab 5: Profile
| Screen              | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| My Profile          | Photo, name, stats (ratings, rentals), edit button             |
| My Listings         | Cards for each active/inactive listing; link to create         |
| Notifications       | Chronological list of notifications                            |
| Settings            | Phone, password, push notification preferences, logout         |

### Stack Screens (pushed from any tab)

| Screen                   | Purpose                                                   |
|--------------------------|-----------------------------------------------------------|
| Product Detail           | Photo gallery, title, price, deposit, owner card, availability calendar, "Request to Rent" CTA |
| Create / Edit Listing    | Multi-step: 1 Photos → 2 Details → 3 Pricing → 4 Availability → 5 Review & Publish |
| Booking Request          | Date picker, message to owner, price breakdown preview, submit |
| Booking Checkout         | Full price breakdown, payment method selector, "Pay Now"  |
| Payment (WebView)        | Gateway redirect (Khalti/eSewa hosted page)               |
| Payment Result           | Success or failure confirmation with next steps            |
| Owner Public Profile     | Profile photo, bio, listings, reviews about them as owner |
| Write Review             | Star rating, text comment, submit                         |
| Condition Report         | Photo upload + notes (before/after handoff) — Phase 2     |
| Dispute Report           | Form to file a dispute — Phase 2                          |
| Notifications List       | All notifications, mark read                              |

---

## E. User Navigation Flow

```
App Launch
    │
    ├─ Not authenticated ──→ Splash → Onboarding → Login / Register
    │                                               │
    └─ Authenticated ──────────────────────────────▼
                                            (tabs) layout
                              ┌──────┬──────┬──────┬──────┬──────┐
                           Discover Search Bookings Inbox Profile
                              │       │       │              │
                              │       │       │              ├─ My Listings
                              │       │       │              │      └─ Create / Edit Listing
                              │       │       │              ├─ Notifications
                              │       │       │              └─ Settings
                              │       │       │
                              └───────┴───────┴──── Product Detail
                                                        └─ Booking Request
                                                               └─ Checkout → Payment → Result
                                                    Booking Detail
                                                        ├─ Write Review
                                                        └─ Confirm Return
```

### Expo Router File Structure

```
app/
├── _layout.tsx                   # Root layout, auth gate
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── register.tsx
│   ├── otp.tsx
│   └── forgot-password.tsx
├── (tabs)/
│   ├── _layout.tsx               # Tab bar configuration
│   ├── discover.tsx
│   ├── search.tsx
│   ├── bookings/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   ├── inbox/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   └── profile/
│       ├── index.tsx
│       ├── listings.tsx
│       └── notifications.tsx
├── product/
│   ├── [id].tsx                  # Product detail
│   └── [id]/edit.tsx
├── listing/
│   └── create.tsx
├── checkout/
│   ├── [bookingId].tsx
│   └── result.tsx
└── user/
    └── [id].tsx                  # Public profile
```

---

## F. Backend Application and Module Architecture

### Django Project Structure

```
damirent_backend/
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   ├── staging.py
│   │   └── production.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── accounts/         # User auth, registration, profiles
│   ├── products/         # Listings, categories, images, availability
│   ├── bookings/         # Booking lifecycle management
│   ├── payments/         # Payment processing, payouts, refunds
│   ├── reviews/          # Ratings and reviews
│   ├── notifications/    # Push and in-app notifications
│   ├── messaging/        # Booking-linked conversations (Phase 2)
│   ├── disputes/         # Dispute filing and resolution (Phase 2)
│   └── condition_reports/ # Before/after photos (Phase 2)
├── services/
│   ├── booking_service.py    # Booking business logic, state transitions
│   ├── payment_service.py    # Gateway abstraction, payout calculation
│   ├── notification_service.py
│   └── availability_service.py
├── tasks/
│   ├── booking_tasks.py  # Celery tasks: expiry, reminders
│   └── payment_tasks.py  # Celery tasks: payouts, deposit release
└── manage.py
```

### App Responsibilities

| App              | Owns                                                                 |
|------------------|----------------------------------------------------------------------|
| `accounts`       | User, UserProfile models; registration, OTP, JWT auth; profile CRUD |
| `products`       | Category, Product, ProductImage, AvailabilityBlock models; listing CRUD; image upload |
| `bookings`       | Booking, BookingStatusHistory models; state machine enforcement       |
| `payments`       | Payment, Refund, GatewayLog models; gateway integration; idempotency  |
| `reviews`        | Review model; one-review-per-booking enforcement                      |
| `notifications`  | Notification, PushToken models; FCM dispatch                          |
| `messaging`      | Conversation, Message models; booking-linked chat (Phase 2)           |
| `disputes`       | Dispute, DisputeEvidence models; admin workflow (Phase 2)             |
| `condition_reports` | ConditionReport, ConditionPhoto models (Phase 2)                  |

### Service Layer Pattern

Business logic that crosses model boundaries lives in `services/`, not in views or models.

- `BookingService.create_booking()` — validates dates, checks availability, locks row, creates booking
- `BookingService.transition(booking, new_status, actor)` — enforces allowed transitions, writes history
- `PaymentService.initiate()` — builds gateway payload, stores pending payment record
- `PaymentService.handle_callback(payload)` — verifies signature, idempotently updates payment status
- `AvailabilityService.check_availability(product, start, end)` — queries availability blocks and confirmed bookings

### Third-Party Integrations

| Integration     | Purpose                          | Notes                              |
|-----------------|----------------------------------|------------------------------------|
| Khalti (primary) | Payment processing              | REST API; webhook callback         |
| eSewa (Phase 2) | Second payment option            | Form-based + webhook               |
| AWS S3          | Product image storage            | Via django-storages; pre-signed URLs |
| FCM / APNs      | Push notifications               | Via Expo push notification service  |
| Redis           | Celery broker, rate limiting     |                                    |
| Celery          | Async tasks (expiry, payouts)    | Beat scheduler for time-based jobs  |

---

## G. Database Entity Relationships

### Entity Overview

```
User ─────────────────────── owns ──────────────────── Product
  │                                                       │
  │ rents                                                 │ has many
  │                                                       │
Booking ──────────────────────────────────────── ProductImage
  │                                           AvailabilityBlock
  │
  ├── Payment (rental amount)
  ├── Payment (security deposit)
  ├── Refund
  ├── BookingStatusHistory
  ├── Review (by renter, about owner + product)
  ├── Review (by owner, about renter)
  └── ConditionReport (before + after)

User
  ├── UserProfile
  ├── PushToken
  └── Notification

Conversation ── linked to ── Booking
  └── Message (many)
```

### Table Definitions

#### `users`
| Column           | Type         | Notes                                   |
|------------------|--------------|-----------------------------------------|
| id               | UUID PK      |                                         |
| phone            | VARCHAR(20)  | Unique, primary identifier              |
| email            | VARCHAR(255) | Unique, optional                        |
| full_name        | VARCHAR(255) |                                         |
| password_hash    | VARCHAR      | bcrypt via Django                       |
| is_active        | BOOLEAN      | Account status                          |
| is_verified      | BOOLEAN      | ID verification flag                    |
| is_staff         | BOOLEAN      | Admin access                            |
| date_joined      | TIMESTAMPTZ  |                                         |
| last_login       | TIMESTAMPTZ  |                                         |

#### `user_profiles`
| Column                 | Type         | Notes                             |
|------------------------|--------------|-----------------------------------|
| id                     | UUID PK      |                                   |
| user_id                | UUID FK      | OneToOne → users                  |
| profile_photo_url      | VARCHAR      | S3 URL                            |
| bio                    | TEXT         |                                   |
| city                   | VARCHAR(100) |                                   |
| avg_rating_as_owner    | DECIMAL(3,2) | Cached, recomputed on new review  |
| avg_rating_as_renter   | DECIMAL(3,2) | Cached, recomputed on new review  |
| total_rentals_as_owner | INT          | Cached count                      |
| total_rentals_as_renter| INT          | Cached count                      |

#### `categories`
| Column     | Type         | Notes                             |
|------------|--------------|-----------------------------------|
| id         | UUID PK      |                                   |
| name       | VARCHAR(100) |                                   |
| slug       | VARCHAR(100) | Unique                            |
| icon_name  | VARCHAR(100) | Icon identifier for mobile        |
| parent_id  | UUID FK      | Self-ref for subcategories        |
| sort_order | INT          |                                   |

#### `products`
| Column            | Type         | Notes                                 |
|-------------------|--------------|---------------------------------------|
| id                | UUID PK      |                                       |
| owner_id          | UUID FK      | → users                               |
| category_id       | UUID FK      | → categories                          |
| title             | VARCHAR(255) |                                       |
| description       | TEXT         |                                       |
| condition         | VARCHAR(20)  | excellent / good / fair               |
| price_per_day     | INT          | NPR, no decimals                      |
| security_deposit  | INT          | NPR                                   |
| min_rental_days   | SMALLINT     | Default 1                             |
| max_rental_days   | SMALLINT     | NULL = no limit                       |
| pickup_location   | VARCHAR(255) | Text description of handoff location  |
| latitude          | DECIMAL(9,6) | Optional                              |
| longitude         | DECIMAL(9,6) | Optional                              |
| is_active         | BOOLEAN      | Visible in discovery                  |
| created_at        | TIMESTAMPTZ  |                                       |
| updated_at        | TIMESTAMPTZ  |                                       |

#### `product_images`
| Column      | Type        | Notes                             |
|-------------|-------------|-----------------------------------|
| id          | UUID PK     |                                   |
| product_id  | UUID FK     | → products                        |
| image_url   | VARCHAR     | S3 URL                            |
| is_primary  | BOOLEAN     | One primary per product           |
| sort_order  | SMALLINT    |                                   |

#### `availability_blocks`
| Column     | Type        | Notes                             |
|------------|-------------|-----------------------------------|
| id         | UUID PK     |                                   |
| product_id | UUID FK     | → products                        |
| start_date | DATE        |                                   |
| end_date   | DATE        | Inclusive                         |
| block_type | VARCHAR(20) | owner_blocked / booking_hold      |
| booking_id | UUID FK     | NULL unless block_type=booking_hold |

#### `bookings`
| Column            | Type         | Notes                                 |
|-------------------|--------------|---------------------------------------|
| id                | UUID PK      |                                       |
| product_id        | UUID FK      | → products                            |
| renter_id         | UUID FK      | → users                               |
| owner_id          | UUID FK      | → users (denormalized for query speed)|
| start_date        | DATE         |                                       |
| end_date          | DATE         | Inclusive                             |
| total_days        | SMALLINT     | Computed on server                    |
| rental_total      | INT          | price_per_day × total_days            |
| security_deposit  | INT          | Snapshot from product at booking time |
| platform_fee      | INT          | Computed on server                    |
| total_charged     | INT          | rental_total + security_deposit + platform_fee |
| status            | VARCHAR(30)  | See booking lifecycle                 |
| renter_message    | TEXT         | Message sent with booking request     |
| created_at        | TIMESTAMPTZ  |                                       |
| updated_at        | TIMESTAMPTZ  |                                       |

#### `booking_status_history`
| Column     | Type        | Notes                             |
|------------|-------------|-----------------------------------|
| id         | UUID PK     |                                   |
| booking_id | UUID FK     | → bookings                        |
| status     | VARCHAR(30) |                                   |
| changed_by | UUID FK     | → users (NULL for system changes) |
| note       | TEXT        |                                   |
| created_at | TIMESTAMPTZ |                                   |

#### `payments`
| Column            | Type         | Notes                                 |
|-------------------|--------------|---------------------------------------|
| id                | UUID PK      |                                       |
| booking_id        | UUID FK      | → bookings                            |
| payment_type      | VARCHAR(20)  | rental / security_deposit             |
| amount            | INT          | NPR                                   |
| status            | VARCHAR(20)  | pending / processing / completed / failed / refunded |
| gateway           | VARCHAR(20)  | khalti / esewa                        |
| gateway_txn_id    | VARCHAR(255) | Unique, from gateway; used for idempotency |
| gateway_ref       | VARCHAR(255) | Our internal reference sent to gateway|
| initiated_at      | TIMESTAMPTZ  |                                       |
| completed_at      | TIMESTAMPTZ  |                                       |
| raw_callback      | JSONB        | Full callback payload stored for audit|

#### `refunds`
| Column        | Type         | Notes                             |
|---------------|--------------|-----------------------------------|
| id            | UUID PK      |                                   |
| payment_id    | UUID FK      | → payments                        |
| amount        | INT          | NPR                               |
| reason        | VARCHAR(50)  | deposit_return / cancellation / partial_damage |
| status        | VARCHAR(20)  | pending / completed / failed      |
| initiated_by  | UUID FK      | → users (NULL for system)         |
| initiated_at  | TIMESTAMPTZ  |                                   |
| completed_at  | TIMESTAMPTZ  |                                   |

#### `reviews`
| Column       | Type         | Notes                                 |
|--------------|--------------|---------------------------------------|
| id           | UUID PK      |                                       |
| booking_id   | UUID FK      | → bookings                            |
| reviewer_id  | UUID FK      | → users                               |
| reviewee_id  | UUID FK      | → users                               |
| product_id   | UUID FK      | → products (for product aggregate)    |
| rating       | SMALLINT     | 1–5                                   |
| comment      | TEXT         |                                       |
| review_type  | VARCHAR(20)  | renter_reviewing_owner / owner_reviewing_renter |
| created_at   | TIMESTAMPTZ  |                                       |

**Unique constraint:** (booking_id, reviewer_id) — one review per party per booking.

#### `notifications`
| Column     | Type        | Notes                             |
|------------|-------------|-----------------------------------|
| id         | UUID PK     |                                   |
| user_id    | UUID FK     | → users                           |
| type       | VARCHAR(50) | booking_request, payment_confirmed, etc. |
| title      | VARCHAR(255)|                                   |
| body       | TEXT        |                                   |
| data       | JSONB       | Deep link payload                 |
| is_read    | BOOLEAN     |                                   |
| created_at | TIMESTAMPTZ |                                   |

#### `push_tokens`
| Column     | Type        | Notes                             |
|------------|-------------|-----------------------------------|
| id         | UUID PK     |                                   |
| user_id    | UUID FK     | → users                           |
| token      | VARCHAR(255)| Expo push token; unique           |
| platform   | VARCHAR(10) | ios / android                     |
| created_at | TIMESTAMPTZ |                                   |

#### Key Indexes

```sql
-- Fast product discovery
CREATE INDEX idx_products_category_active ON products(category_id, is_active);
CREATE INDEX idx_products_owner ON products(owner_id);

-- Availability check (critical path)
CREATE INDEX idx_availability_product_dates ON availability_blocks(product_id, start_date, end_date);

-- Booking queries
CREATE INDEX idx_bookings_renter ON bookings(renter_id, status);
CREATE INDEX idx_bookings_owner ON bookings(owner_id, status);
CREATE INDEX idx_bookings_product ON bookings(product_id, status);

-- Payment idempotency
CREATE UNIQUE INDEX idx_payments_gateway_txn ON payments(gateway_txn_id) WHERE gateway_txn_id IS NOT NULL;
```

---

## H. API Endpoint Plan

All endpoints are prefixed with `/api/v1/`. All authenticated endpoints require `Authorization: Bearer <token>`.
Server returns `application/json`. Errors follow the format `{"error": "...", "field_errors": {...}}`.

### Authentication

| Method | Endpoint                        | Auth | Description                         |
|--------|---------------------------------|------|-------------------------------------|
| POST   | /auth/register/                 | No   | Register with phone + name + password |
| POST   | /auth/otp/send/                 | No   | Send OTP to phone number            |
| POST   | /auth/otp/verify/               | No   | Verify OTP code                     |
| POST   | /auth/login/                    | No   | Return access + refresh tokens      |
| POST   | /auth/token/refresh/            | No   | Refresh access token                |
| POST   | /auth/logout/                   | Yes  | Invalidate refresh token            |
| POST   | /auth/password/reset/initiate/  | No   | Send reset OTP                      |
| POST   | /auth/password/reset/confirm/   | No   | Set new password                    |

### Users

| Method | Endpoint              | Auth | Description                    |
|--------|-----------------------|------|--------------------------------|
| GET    | /users/me/            | Yes  | My profile                     |
| PATCH  | /users/me/            | Yes  | Update profile fields          |
| POST   | /users/me/photo/      | Yes  | Upload profile photo           |
| POST   | /users/push-token/    | Yes  | Register Expo push token       |
| DELETE | /users/push-token/    | Yes  | Remove push token on logout    |
| GET    | /users/{id}/          | Yes  | Public profile of another user |

### Categories

| Method | Endpoint         | Auth | Description           |
|--------|------------------|------|-----------------------|
| GET    | /categories/     | No   | All categories (tree) |

### Products

| Method | Endpoint                          | Auth | Description                                |
|--------|-----------------------------------|------|--------------------------------------------|
| GET    | /products/                        | No   | List products (search, filter, sort, paginate) |
| POST   | /products/                        | Yes  | Create listing                             |
| GET    | /products/{id}/                   | No   | Product detail                             |
| PATCH  | /products/{id}/                   | Yes  | Update listing (owner only)                |
| DELETE | /products/{id}/                   | Yes  | Soft-delete listing (owner only)           |
| POST   | /products/{id}/images/            | Yes  | Upload image(s) to listing                 |
| DELETE | /products/{id}/images/{img_id}/   | Yes  | Remove image (owner only)                  |
| GET    | /products/{id}/availability/      | No   | Blocked and booked dates for calendar      |
| POST   | /products/{id}/availability/      | Yes  | Add owner-blocked date range               |
| DELETE | /products/{id}/availability/{block_id}/ | Yes | Remove owner-blocked dates           |

**Query parameters for GET /products/:**
`q` (search), `category`, `min_price`, `max_price`, `condition`, `min_days`, `available_from`, `available_to`,
`ordering` (price, -price, created_at, -created_at, rating), `page`, `page_size`

### Bookings

| Method | Endpoint                            | Auth | Description                              |
|--------|-------------------------------------|------|------------------------------------------|
| POST   | /bookings/                          | Yes  | Submit booking request                   |
| GET    | /bookings/                          | Yes  | My bookings (as renter or owner via ?role=) |
| GET    | /bookings/{id}/                     | Yes  | Booking detail (owner or renter)         |
| POST   | /bookings/{id}/approve/             | Yes  | Owner approves request                   |
| POST   | /bookings/{id}/reject/              | Yes  | Owner rejects request                    |
| POST   | /bookings/{id}/cancel/              | Yes  | Renter or owner cancels                  |
| POST   | /bookings/{id}/confirm-return/      | Yes  | Owner confirms product returned          |

### Payments

| Method | Endpoint                     | Auth | Description                              |
|--------|------------------------------|------|------------------------------------------|
| POST   | /payments/initiate/          | Yes  | Initiate payment for approved booking    |
| POST   | /payments/callback/khalti/   | No   | Khalti webhook (IP whitelisted)          |
| POST   | /payments/verify/            | Yes  | Client-side payment verification trigger |
| GET    | /payments/{id}/              | Yes  | Payment record                           |

### Reviews

| Method | Endpoint       | Auth | Description                              |
|--------|----------------|------|------------------------------------------|
| POST   | /reviews/      | Yes  | Submit review (after booking completes)  |
| GET    | /reviews/      | Yes  | List reviews (?user_id= or ?product_id=) |

### Notifications

| Method | Endpoint                           | Auth | Description              |
|--------|------------------------------------|------|--------------------------|
| GET    | /notifications/                    | Yes  | My notifications         |
| PATCH  | /notifications/{id}/               | Yes  | Mark single as read      |
| POST   | /notifications/mark-all-read/      | Yes  | Mark all as read         |

### Admin (Django Admin + Custom Views)

- Standard Django admin panel at `/admin/`
- Custom admin actions: manual booking status override, refund processing, user suspension

---

## I. Booking Lifecycle and State Transitions

### States

| State                  | Visible Label       | Who Sees It                      |
|------------------------|---------------------|----------------------------------|
| `pending_approval`     | Awaiting Approval   | Both                             |
| `approved`             | Approved — Pay Now  | Both                             |
| `payment_pending`      | Payment in Progress | Both                             |
| `confirmed`            | Booking Confirmed   | Both                             |
| `active`               | In Progress         | Both                             |
| `completed`            | Completed           | Both                             |
| `cancelled_by_renter`  | Cancelled           | Both                             |
| `cancelled_by_owner`   | Cancelled by Owner  | Both                             |
| `expired`              | Expired             | Both                             |
| `disputed`             | Under Review        | Both                             |

### Transition Table

| From                 | To                    | Actor         | Trigger / Condition                          |
|----------------------|-----------------------|---------------|----------------------------------------------|
| `pending_approval`   | `approved`            | Owner         | Owner taps Approve                           |
| `pending_approval`   | `cancelled_by_owner`  | Owner         | Owner taps Reject                            |
| `pending_approval`   | `expired`             | System        | No response within owner_response_window     |
| `approved`           | `payment_pending`     | Renter        | Renter initiates payment                     |
| `approved`           | `cancelled_by_renter` | Renter        | Renter cancels before payment                |
| `approved`           | `expired`             | System        | Payment not initiated within payment_window  |
| `payment_pending`    | `confirmed`           | System        | Gateway callback signals success             |
| `payment_pending`    | `approved`            | System        | Payment fails — renter may retry             |
| `confirmed`          | `active`              | System        | Rental start_date reached (Celery Beat)      |
| `confirmed`          | `cancelled_by_renter` | Renter        | Within cancellation window; refund triggered |
| `confirmed`          | `cancelled_by_owner`  | Owner         | Owner cancels; full refund triggered         |
| `active`             | `completed`           | Owner         | Owner confirms product returned              |
| `active`             | `disputed`            | Renter/Owner  | Party files a dispute                        |
| `completed`          | `disputed`            | Renter/Owner  | Within dispute_window after completion       |

### Business Logic Notes

- **Overlap prevention:** When creating a booking, use a database transaction with `SELECT FOR UPDATE`
  on the product's availability rows. A unique constraint on `(product_id, date)` in the booking calendar
  ensures no two confirmed bookings share a date.
- **Timeouts:** Celery Beat checks for expired pending/approved bookings every 15 minutes.
- **Status history:** Every transition writes a record to `booking_status_history` with actor and timestamp.
- **Cancellation refund logic** depends on policy (open decision — see Section O). In MVP, use a simple
  rule: cancel before rental starts → full refund of rental; deposit always refunded on cancellation.

### State Machine Diagram

```
                    [owner response window expires]
PENDING_APPROVAL ─────────────────────────────────→ EXPIRED
     │  │
     │  └─[owner rejects]──────────────────────────→ CANCELLED_BY_OWNER
     │
     └─[owner approves]──→ APPROVED
                              │  │
                              │  └─[renter cancels]─────────────────→ CANCELLED_BY_RENTER
                              │
                              └─[renter pays]──→ PAYMENT_PENDING
                                                    │  │
                                                    │  └─[payment fails]──→ APPROVED (retry)
                                                    │
                                                    └─[payment succeeds]──→ CONFIRMED
                                                                              │  │
                                                                              │  └─[owner cancels]──→ CANCELLED_BY_OWNER
                                                                              │
                                                                              └─[start_date reached]──→ ACTIVE
                                                                                                          │  │
                                                                                                          │  └─[dispute filed]──→ DISPUTED
                                                                                                          │
                                                                                                          └─[owner confirms return]──→ COMPLETED
```

---

## J. Payment and Refund Lifecycle

### Supported Gateways

**MVP:** Khalti (most widely used in Nepal for online payments, developer-friendly REST API)
**Phase 2:** eSewa as second option

### Payment Flow

```
1. Booking reaches APPROVED
2. Renter taps "Pay Now"
3. POST /payments/initiate/ → server creates Payment record (status: pending)
    server builds Khalti payload, returns payment_url
4. App opens payment_url in WebView / browser redirect
5. User completes payment on Khalti
6. Khalti sends webhook to POST /payments/callback/khalti/
7. Server:
    a. Verifies HMAC signature of callback
    b. Checks payment_id for idempotency — if already processed, return 200 silently
    c. Verifies amount matches Payment record — reject if different
    d. Updates Payment status → completed
    e. Transitions Booking → confirmed
    f. Creates AvailabilityBlock for the booking dates
    g. Sends push notification to both parties
8. App polls GET /bookings/{id}/ or receives push notification
    → shows Confirmed screen
```

### Security Deposit Handling

- Collected as a separate `Payment` record (payment_type: `security_deposit`) at the same time as rental payment.
- Held until `COMPLETED` status.
- On completion: system creates `Refund` for deposit → initiates Khalti refund API → updates Refund status.
- On dispute: deposit held until admin resolves dispute.

### Payout to Owner

- Owner receives: `rental_total − platform_fee`
- Security deposit is returned to renter, not forwarded to owner
- Payout triggered: on booking `COMPLETED` (or X hours after `ACTIVE` — open decision, see Section O)
- In MVP: payouts are manual bank transfers or Khalti send-money (automated payout API to be confirmed)

### Payment States

```
PENDING ──→ PROCESSING ──→ COMPLETED
               │
               └──→ FAILED ──→ [renter retries, new Payment record]

COMPLETED ──→ REFUNDED (full)
COMPLETED ──→ PARTIALLY_REFUNDED (damage deduction scenario, Phase 2)
```

### Idempotency

- Each `Payment` record stores `gateway_txn_id` with a unique index.
- Callback handler: `if Payment.objects.filter(gateway_txn_id=txn_id).exists(): return 200`
- Server never double-processes a transaction.

### Failure Handling

| Scenario                          | Behavior                                              |
|-----------------------------------|-------------------------------------------------------|
| Gateway down at initiation        | Return 503 to client; no payment record created       |
| Callback not received in 30 min   | Celery task polls Khalti status API                   |
| Callback received but amount wrong| Payment rejected; booking stays APPROVED for retry    |
| Refund API fails                  | Celery retry with exponential backoff; alert admin    |

---

## K. Security and Authorization Requirements

### Authentication

- **Token type:** JWT — short-lived access token (15 min) + long-lived refresh token (7 days)
- **Library:** `djangorestframework-simplejwt`
- **Registration:** Phone number + OTP (6-digit, 5-minute expiry, max 3 attempts)
- **Login:** Phone + password (not OTP to reduce SMS cost on every login)
- **OTP storage:** Redis with TTL — never stored in the database after verification
- **Password policy:** Minimum 8 characters; hashed with Django's PBKDF2/bcrypt

### Object-Level Permissions

| Resource       | Read         | Write/Delete                             |
|----------------|--------------|------------------------------------------|
| Product        | Anyone       | Owner only                               |
| Booking        | Renter or Owner of that booking | Neither can modify status directly — via actions only |
| Payment        | Renter (their payment) | Never directly by client |
| Review         | Anyone       | Author, once per booking, after completion |
| Notification   | Owner only   | Owner only (mark read)                   |
| Profile        | Public profile: anyone | Private fields: self only      |

All permission checks are enforced in view or service layer. Django's `get_object_or_404` is combined with
explicit ownership checks. Never rely on the client to withhold a resource from the wrong user.

### Authorization Rules

- A user cannot book their own product (server rejects with 400).
- Only the product owner can approve or reject booking requests.
- Only the renter can cancel a booking in `approved` state.
- Either party may cancel a `confirmed` booking (different refund rules apply).
- Only the owner can confirm return (transition to `completed`).
- Payment amounts are never accepted from the client — the server reads from the Payment record.

### API Security

- **Rate limiting:** 5 OTP requests per phone per hour; 20 login attempts per IP per hour (via `django-ratelimit`)
- **CORS:** Configured to allow only the mobile app's origin (and `localhost` in dev)
- **HTTPS only:** HTTP requests redirect to HTTPS in production; `SECURE_SSL_REDIRECT = True`
- **HSTS:** `SECURE_HSTS_SECONDS = 31536000`
- **Input validation:** All inputs validated through DRF serializers before reaching service layer
- **SQL injection:** Prevented by Django ORM — raw queries avoided; if used, parameterised only
- **XSS:** Not applicable to JSON API; image URLs validated before storage

### Payment Security

- No card details ever touch our servers — all payment data collected by Khalti's hosted page.
- Webhook signature verification on every callback (HMAC-SHA256 with gateway secret).
- Payment amounts verified server-side against stored `Payment` record before confirming.
- Gateway secret stored in environment variable, never in code.

### Image Upload Security

- Uploads go directly to S3 via pre-signed POST URLs — files never pass through our server.
- File type and size validated by S3 bucket policy (images only, max 10 MB per file).
- Product images served via S3 public URLs or CloudFront; no private image access required in MVP.

### Secrets Management

- All secrets (Django SECRET_KEY, database URL, S3 credentials, gateway keys, JWT secret) in
  environment variables — loaded via `python-decouple` or OS environment.
- `.env` files never committed to Git — `.gitignore` entry enforced.
- Separate secret values for development, staging, and production.

### Audit and Monitoring

- All booking state transitions logged to `booking_status_history`.
- All payment callbacks stored raw in `payments.raw_callback` (JSONB).
- Django admin logs all admin actions.
- Application errors reported to Sentry (production).

---

## L. UI/UX Design System

### Design Philosophy

**Modern. Minimal. Trustworthy.**

The interface must feel clean and premium without being sterile. Prioritise product photography,
transparent pricing, and clear status indicators. Every screen should have one clear primary action.
Avoid decorative elements that add no information.

### Color Palette

| Token               | Hex       | Usage                                          |
|---------------------|-----------|------------------------------------------------|
| `primary`           | `#1A2E4A` | Navigation, headings, primary buttons          |
| `primary-light`     | `#2C4A72` | Pressed states, secondary surfaces             |
| `accent`            | `#F59E0B` | CTAs, highlights, availability indicators      |
| `success`           | `#16A34A` | Confirmed status, completed bookings           |
| `error`             | `#DC2626` | Errors, rejected status                        |
| `warning`           | `#D97706` | Pending, awaiting action                       |
| `surface`           | `#FFFFFF` | Cards, sheets, modals                          |
| `background`        | `#F4F5F7` | Screen backgrounds                             |
| `text-primary`      | `#111827` | Headings, body text                            |
| `text-secondary`    | `#6B7280` | Captions, labels, helper text                  |
| `border`            | `#E5E7EB` | Dividers, input borders                        |
| `skeleton`          | `#E9ECEF` | Loading placeholder blocks                     |

### Typography

Font: **Inter** (already available in Expo via `@expo-google-fonts/inter`)

| Token        | Size  | Weight    | Line Height | Usage                          |
|--------------|-------|-----------|-------------|--------------------------------|
| `h1`         | 28px  | Bold 700  | 34px        | Screen titles                  |
| `h2`         | 22px  | SemiBold 600 | 28px     | Section headings               |
| `h3`         | 18px  | SemiBold 600 | 24px     | Card titles, sub-sections      |
| `body`       | 15px  | Regular 400 | 22px      | Primary body text              |
| `body-medium`| 15px  | Medium 500  | 22px      | Emphasis within body           |
| `caption`    | 13px  | Regular 400 | 18px      | Labels, metadata               |
| `button`     | 15px  | SemiBold 600 | 20px     | Button labels                  |
| `overline`   | 11px  | Medium 500  | 16px      | Category labels, status tags   |

### Spacing System

Base unit: 4px (`sp = 4`)

```
sp(1) = 4px    — tight internal padding
sp(2) = 8px    — component internal padding
sp(3) = 12px   — small gaps
sp(4) = 16px   — standard padding (screen horizontal padding)
sp(5) = 20px   — card padding
sp(6) = 24px   — section gaps
sp(8) = 32px   — large section gaps
sp(12) = 48px  — screen-level vertical rhythm
```

### Radius and Elevation

| Token      | Value | Usage                          |
|------------|-------|--------------------------------|
| `radius-sm`| 6px   | Buttons, inputs, small chips   |
| `radius-md`| 12px  | Cards, bottom sheets           |
| `radius-lg`| 20px  | Modals, image containers       |
| `radius-xl`| 28px  | Full-pill elements             |

Shadows: one elevation level for cards (`shadowOpacity: 0.06, shadowRadius: 12`). Avoid deep shadows — they
feel heavy on mobile.

### Core Components

**ProductCard**
- Primary photo (aspect ratio 4:3, rounded corners)
- Title (h3, 2 lines max, truncated)
- NPR price per day (accent color, bold)
- Rating stars + review count
- Owner avatar (16px, bottom-left overlay)
- Condition badge (top-right pill: Excellent / Good / Fair)

**BookingStatusBadge**
- Pill shape, status-color background, overline text
- Colors: warning (pending), primary (confirmed), success (completed), error (cancelled)

**PriceBreakdown**
- Line items: Rental (X days × NPR Y), Security Deposit, Platform Fee
- Divider
- **Total: NPR Z** (large, bold)
- Tooltip icon on "Platform Fee" explaining the fee

**AvailabilityCalendar**
- Monthly view, tap to select range
- Blocked dates: red-tinted cells
- Selected range: accent-colored cells
- Today: underline indicator

**TrustBadge**
- Verified identity icon (Phase 2)
- "X successful rentals" count
- Average star rating

**EmptyState**
- Centered illustration (simple line art), headline, subtext, optional CTA button
- Never show a blank screen

**SkeletonLoader**
- Match the shape of the content being loaded (card skeletons, not spinners alone)

### Navigation Conventions

- Bottom tab bar: 5 icons, labels always visible
- Active tab: filled icon, accent underline
- Back navigation: system back + header back button
- Modals: bottom sheet for filters and quick actions; full-screen modal for multi-step flows
- No hamburger menus

### Interaction Principles

- Every CTA button has a loading state (spinner in button) to prevent double-tap
- Destructive actions (cancel booking) require a confirmation bottom sheet
- Price amounts always include "NPR" prefix — never ambiguous
- Date ranges displayed as "12 Nov – 15 Nov, 2026" (never ambiguous numeric format)
- All monetary values: comma-separated (NPR 1,500 not NPR 1500)

---

## M. Testing Strategy

### Guiding Principles

- Test business logic, not implementation details.
- Tests must pass on every PR before merge.
- Critical paths (booking creation, payment callback, overlap prevention) must have 100% test coverage.
- Do not test framework code or third-party library internals.

### Backend — Django

**Framework:** `pytest` + `pytest-django` + `factory_boy`

**Test Categories:**

| Category      | What to Test                                             | Coverage Target |
|---------------|----------------------------------------------------------|-----------------|
| Unit          | Model methods, service layer functions, serializer validation | All service functions |
| Integration   | API endpoints (view + serializer + DB round-trip)        | All endpoints   |
| Idempotency   | Payment callback sent twice → processed once             | Required        |
| Concurrency   | Two simultaneous booking requests for overlapping dates → only one succeeds | Required |
| State machine | All valid and invalid booking transitions                | All transitions |

**Example critical test cases:**

```python
# Overlap prevention
def test_concurrent_bookings_same_dates_only_one_confirms():
    # Send two booking requests for the same product and dates
    # Use threading or database transactions
    # Assert only one reaches CONFIRMED; other returns 409 or stays PENDING_APPROVAL

# Idempotency
def test_duplicate_payment_callback_processed_once():
    # Send the same Khalti callback payload twice
    # Assert Payment.status == 'completed' and only one status history record

# State machine
def test_renter_cannot_approve_booking():
    # Renter tries to call /bookings/{id}/approve/
    # Assert 403 Forbidden

# Server-side pricing
def test_client_cannot_override_booking_total():
    # Submit booking request with manipulated total_amount
    # Assert server ignores client value and computes its own
```

**CI Command:**
```bash
pytest --cov=apps --cov-report=term-missing -x
```

### Mobile — React Native / Expo

**Framework:** `Jest` + `React Native Testing Library`

**Test Categories:**

| Category   | What to Test                                                |
|------------|-------------------------------------------------------------|
| Unit       | Utility functions (price formatting, date calculation)      |
| Component  | Render and interaction of ProductCard, BookingStatusBadge, PriceBreakdown, AvailabilityCalendar |
| Integration| Key screen flows mocked at API boundary (auth, booking request, checkout) |

**E2E (Phase 2):** Detox — at minimum: register → list product → book product → complete rental.

### Static Analysis

| Tool          | Scope       | Run                       |
|---------------|-------------|---------------------------|
| TypeScript    | Mobile      | `tsc --noEmit` on every commit |
| ESLint        | Mobile      | `expo lint`               |
| Ruff          | Backend     | `ruff check .`            |
| mypy          | Backend     | `mypy apps/` (progressively adopted) |

### CI Pipeline (GitHub Actions)

**On every PR:**
1. Backend: install deps → run migrations → `pytest` with coverage report
2. Mobile: install deps → `tsc --noEmit` → `jest`
3. Lint both
4. Block merge if any step fails

---

## N. Deployment Architecture

### Overview

```
                    ┌─────────────────────────────────────────────┐
                    │                  Internet                    │
                    └────────────┬───────────────────────────┬────┘
                                 │                           │
                          Mobile App                  Admin Browser
                        (Expo / RN)                  (Django Admin)
                                 │                           │
                    ┌────────────▼───────────────────────────▼────┐
                    │            Nginx (reverse proxy + TLS)       │
                    └────────────────────────┬────────────────────┘
                                             │
                    ┌────────────────────────▼────────────────────┐
                    │           Gunicorn (Django WSGI)             │
                    │           3–4 workers                        │
                    └──┬─────────────────────────────────────┬────┘
                       │                                     │
          ┌────────────▼──────────────┐     ┌───────────────▼──────────────┐
          │   PostgreSQL (managed)    │     │   Redis (managed)             │
          │   Primary DB              │     │   Celery broker + cache       │
          └───────────────────────────┘     └──────────────────────────────┘
                                                          │
                    ┌─────────────────────────────────────▼────────┐
                    │              Celery Worker(s)                 │
                    │  - Booking expiry tasks                       │
                    │  - Payment status polling                     │
                    │  - Push notification dispatch                 │
                    │  - Payout scheduling                          │
                    └───────────────────────────────────────────────┘

          ┌────────────────────────────┐
          │   AWS S3                   │
          │   Product images           │
          │   Pre-signed upload URLs   │
          └────────────────────────────┘
```

### Infrastructure Provider

**Recommendation: DigitalOcean** for MVP (simpler operations, lower cost, good managed services).
Migrate to AWS if scale requires it.

| Service              | DigitalOcean Equivalent          | Spec (MVP)                      |
|----------------------|----------------------------------|---------------------------------|
| App server           | Droplet or App Platform          | 2 vCPU / 4 GB RAM               |
| PostgreSQL           | Managed Database (PostgreSQL 16) | 1 vCPU / 1 GB RAM (scalable)    |
| Redis                | Managed Redis                    | 1 GB                            |
| Object storage       | Spaces (or AWS S3)               | As needed                       |
| CDN                  | DigitalOcean CDN / CloudFront    | For static assets and images    |

### Environments

| Environment | Purpose                              | Database     |
|-------------|--------------------------------------|--------------|
| development | Local development with Docker Compose| Local Postgres |
| staging     | Pre-prod testing, mirrors production | Managed, separate instance |
| production  | Live users                           | Managed, backups enabled |

### Containerisation

**Development:** Docker Compose with services: `web`, `db`, `redis`, `celery`, `celery-beat`

**Production:** Gunicorn behind Nginx on a Droplet, or DigitalOcean App Platform. Full Kubernetes is
unnecessary for MVP scale.

### Mobile Delivery

| Task              | Tool                  |
|-------------------|-----------------------|
| Build             | Expo EAS Build        |
| Submit to stores  | Expo EAS Submit       |
| OTA updates       | Expo Updates (minor patches without app store review) |
| Environment config | Expo environment variables via `eas.json` |

### Backup and Recovery

- PostgreSQL: automated daily backups (DigitalOcean managed DB), 7-day retention
- S3 images: versioning enabled
- Recovery time objective (RTO): 4 hours for MVP

### Monitoring

| Tool     | Purpose                                  |
|----------|------------------------------------------|
| Sentry   | Error tracking (backend + mobile)        |
| UptimeRobot | Uptime monitoring, alert on downtime |
| DigitalOcean Metrics | CPU, memory, disk on Droplets |
| Django admin | Manual operational tasks           |

---

## O. Risks, Assumptions, and Unresolved Business Decisions

### Open Business Decisions — Require Your Approval Before Implementation

These decisions affect data models, pricing logic, and user experience. The team cannot make these calls.

| # | Decision                         | Options                                              | Recommendation                                      |
|---|----------------------------------|------------------------------------------------------|-----------------------------------------------------|
| 1 | **Platform fee %**               | 5%, 8%, 10% of rental total                         | Start at 8% — competitive, sustainable              |
| 2 | **Security deposit — who sets it?** | Owner sets amount freely / Platform minimum policy | Owner sets it freely; platform recommends a minimum |
| 3 | **Owner payout timing**          | On booking confirmed / on rental start / on rental completed | On rental start (reduces churn, balanced risk) |
| 4 | **Cancellation policy**          | Flat rule / tiered by notice period / per-listing policy | Start with one flat rule: full refund if cancelled 48 h before start |
| 5 | **Owner response window**        | 12 h / 24 h / 48 h before auto-rejection            | 24 hours                                            |
| 6 | **Payment window after approval** | 2 h / 6 h / 12 h before booking expires            | 6 hours                                             |
| 7 | **ID verification — mandatory?** | Required at signup / required before first listing / optional | Optional at signup; required before listing (Phase 2) |
| 8 | **Payment gateway**              | Khalti only (MVP) / both Khalti + eSewa (MVP)       | Khalti only for MVP — integrate and test one gateway thoroughly |
| 9 | **Dispute window**               | How many days after completion can a dispute be filed? | 72 hours after completion                           |
| 10 | **Product categories**          | Predefined by admin only / user can suggest new ones | Admin-defined for MVP; request mechanism in Phase 2 |
| 11 | **Geographic launch scope**      | Kathmandu Valley only / all of Nepal                | Kathmandu Valley only for MVP                       |
| 12 | **Review timing**                | Both parties review simultaneously (prevents bias) / sequential | Simultaneous — both review independently, published after both submit or after 14 days |
| 13 | **Minimum/maximum rental price** | Any price / enforce minimums per category           | No system minimum for MVP; owners set freely        |
| 14 | **Platform liability**           | Zero-liability ToS / limited liability / optional insurance | Define a zero-liability ToS at MVP; consult legal   |

### Key Risks

| Risk                              | Likelihood | Impact | Mitigation                                          |
|-----------------------------------|------------|--------|-----------------------------------------------------|
| Khalti API changes or downtime    | Medium     | High   | Abstract gateway behind a service interface; monitor API changelog |
| Cold-start: no listings at launch | High       | High   | Seed the platform with owner-recruited listings before public launch |
| Overlapping bookings due to race conditions | Low | Critical | Database-level SELECT FOR UPDATE + availability constraint |
| Owner does not respond to booking requests | Medium | Medium | Auto-expiry with notification reminders at 12 h and 22 h |
| Fraudulent listings or users      | Medium     | High   | ID verification (Phase 2); rating system; report mechanism |
| Product damage with no resolution | Medium     | High   | Condition reports + security deposit + dispute workflow |
| App Store rejection               | Low        | High   | Follow Expo managed submission guidelines; test on both platforms early |
| Nepali internet reliability       | Medium     | Medium | Optimistic UI, offline-tolerant states, retry logic |

### Assumptions

1. Users in Nepal have smartphones capable of running Expo-built React Native apps (Android 8+ / iOS 14+).
2. Khalti merchant account can be obtained and approved before development is complete.
3. AWS S3 or DigitalOcean Spaces is accessible from the server without egress restrictions.
4. Phone numbers are the right primary identifier — email is secondary and optional.
5. The platform operates under Nepali law; ToS and privacy policy will be reviewed by a local legal advisor.
6. The team can recruit at least 20–30 seed listings before the public launch.
7. NPR amounts will always be whole integers — no fractional currency.

### Smallest Realistic MVP

The following is the minimum set of features to build, test, and demonstrate a working rental loop:

1. Register with phone + OTP
2. Create a product listing with photos
3. Browse and search listings
4. Request a booking (with date selection)
5. Owner approves or rejects
6. Renter pays via Khalti
7. Both parties see booking status
8. Owner confirms return
9. Both parties leave a review
10. Deposit is refunded

Everything else in the MVP list above is secondary and can be deferred if time is short.

---

*End of Planning Document — Version 1.0*

*Awaiting your decisions on Section O items before implementation begins.*
