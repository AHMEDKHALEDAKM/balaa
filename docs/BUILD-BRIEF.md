You are the lead software engineer responsible for building an open-source civic-tech platform called **Balaa / بلاعة**.

Your job is to build a production-quality MVP architecture, while clearly separating demo functionality from integrations that require government authorization.

Do not implement fake government APIs or imply that the application has an official partnership with any Egyptian government entity.

## Product

Balaa allows citizens to photograph public-road problems such as potholes, broken manholes, damaged speed bumps, road damage, pavement damage, drainage problems, street-lighting issues, waste and road obstructions.

The application captures the user's location, determines the relevant Cairo district, creates a report and routes it to the appropriate authority.

The first release targets Cairo Governorate, Egypt.

Arabic RTL is the primary user experience.

## Repository architecture

Create a monorepo using a clean, scalable structure:

```text
apps/mobile
apps/dashboard

packages/ui
packages/types
packages/config
packages/geo

supabase/migrations
supabase/seed
supabase/functions

data
docs
```

Use TypeScript throughout.

## Mobile application

Build the citizen mobile application using:

Expo
React Native
TypeScript

The application must be Android-ready and structurally compatible with iOS.

Implement Arabic RTL correctly.

Use accessible typography and large primary actions.

## Dashboard

Build the government/district dashboard using:

Next.js
TypeScript

The dashboard must be responsive and usable on desktop, tablet and mobile.

## Backend

Use:

Supabase
PostgreSQL
PostGIS
Supabase Storage
Supabase Edge Functions

Use Row Level Security.

Never expose service-role credentials to mobile or frontend applications.

## Authentication architecture

Create an IdentityProvider abstraction.

Implement:

```text
MockDigitalEgyptProvider
```

and define the interface required for:

```text
DigitalEgyptProvider
```

Do NOT implement a real Digital Egypt integration.

The mock flow should simulate:

```text
Continue with Digital Egypt
→ Verifying identity
→ Identity verified
```

Display clearly in development/demo builds that this is a prototype authentication flow.

Use:

```env
AUTH_PROVIDER=digital_egypt_mock
```

The rest of the application's business logic must not depend directly on the mock provider.

A future authorized provider must be replaceable without redesigning the user experience.

Do not store national ID numbers.

## Citizen flow

Implement:

```text
Splash
→ Onboarding
→ Home
→ Public map

Report Problem
→ Mock Digital Egypt verification
→ Camera
→ Location detection
→ District detection
→ Category
→ Severity
→ Optional description
→ Review
→ Submit
→ Confirmation
→ Track report
```

## Camera

For MVP, reports should use photos captured directly using the application camera.

Store:

latitude
longitude
GPS accuracy
capture timestamp

Do not trust image EXIF as the only location source.

## Geographic routing

Use PostGIS.

Create geographic models for:

```text
governorates
administrative_areas
districts
district_boundaries
```

Do NOT create a Cairo-specific architecture.

Cairo should only be the first dataset.

Use Point-in-Polygon queries to determine which district contains a report location.

Create the required geospatial indexes.

District boundaries must be loadable from GeoJSON.

## Problem categories

Seed initial categories:

Broken/open manhole
Pothole
Damaged speed bump
Road surface damage
Pavement damage
Water/sewage issue
Road obstruction
Street-lighting issue
Waste
Other

Store Arabic and English labels.

Categories must be administratively configurable.

## Reports

Every submitted report must receive a human-readable public ID.

Example:

```text
BLAA-000124
```

The report model should support:

```text
id
public_id
user_id
category_id
description
severity

latitude
longitude
gps_accuracy
captured_at

governorate_id
administrative_area_id
district_id

status
moderation_status

duplicate_of
confirmation_count

assigned_authority_id

created_at
updated_at
acknowledged_at
resolved_at
```

## Status workflow

Support:

submitted
delivered
acknowledged
in_progress
resolved
rejected
duplicate
under_review

Every status transition must create a status-history record.

## Duplicate reports

Before creating a new report, search for open reports:

within approximately 30 meters
with the same category.

If one exists, inform the citizen that the issue may already have been reported.

Allow:

```text
The issue still exists
```

This increments `confirmation_count`.

Do not automatically merge reports where confidence is insufficient.

## Public privacy

Public reports may display:

report ID
category
approximate/public location
district
date
status
image
confirmation count
resolution image

Never expose:

citizen name
national ID
identity-provider identifiers
phone
email
private account details

District agents should normally only see that the citizen is identity-verified.

## District dashboard

A district user must only access reports assigned to districts they are authorized to manage.

Implement:

overview
new reports
open reports
in progress
resolved
high severity
report details

Agents can:

acknowledge
start work
resolve
reject
mark duplicate
add internal notes
upload resolution photo

All actions must be logged.

## Resolution

When resolving an issue require:

resolution note
resolution image

Store:

resolved_at
resolved_by
resolution_note
resolution_image

Display Before and After images on resolved public reports.

## Notification architecture

Create a notification-provider abstraction.

District configuration should support multiple endpoints:

primary email
technology center email
operations email
area email
escalation email

Do not hard-code email addresses into application logic.

## Development email protection

Default environment:

```env
EMAIL_MODE=test
```

In test mode, absolutely no messages may be delivered to real government email addresses.

Use a test inbox/provider.

Production email must require an explicit configuration change.

## Moderation

Create moderation states:

pending
safe
flagged
blocked

Reports that are flagged must not automatically be publicly published or sent to external recipients.

Create a basic moderation dashboard.

The moderation implementation may initially be rule/mock-based but must use a provider abstraction so an automated moderation API can later be added.

## Abuse controls

Create data models supporting:

reports submitted
rejected reports
flagged submissions
abuse strikes
temporary reporting suspension

Do not permanently ban automatically.

Provide administrative review capability.

## Public map

Create a map showing public reports.

Use MapLibre.

Design the map so map markers can eventually be clustered.

Do not expose exact citizen information through the map.

## Security

Implement:

Row Level Security
role-based permissions
server-side authorization
signed image access where appropriate
input validation
rate limiting strategy
audit logging

Never rely only on frontend authorization.

Never store secrets in the repository.

Create `.env.example`.

## Roles

Support:

guest
citizen
district_agent
district_manager
moderator
platform_admin

## Seed data

Create seeds for:

Egypt
Cairo Governorate
Cairo administrative regions
Cairo districts
initial problem categories
demo citizen
demo district agent
demo admin

Load district contact configuration from an external JSON seed file rather than embedding contacts in code.

## UI direction

The product should feel:

simple
modern
public-service oriented
trustworthy
Egyptian
accessible

Avoid visual clutter.

Primary UX should require minimal typing.

Arabic is primary.

English support should be architecturally possible.

The app name is:

**بلاعة**

Primary tagline:

**بلّغ. تابع. خلّي الطريق أأمن.**

Supporting message:

**وتُميطُ الأذى عن الطريق صدقة**

Do not make the religious quotation the primary functional CTA.

## Documentation

Create:

```text
README.md
docs/PRD.md
docs/ARCHITECTURE.md
docs/DATA-MODEL.md
docs/SETUP.md
docs/SECURITY.md
docs/CONTRIBUTING.md
docs/ROADMAP.md
```

README must clearly state:

This is an independent open-source civic-tech prototype.

The current Digital Egypt login is a mock demonstration.

No official government integration or endorsement should be implied unless formally established.

## Engineering quality

Use:

strict TypeScript
clear naming
small reusable components
schema validation
database migrations
clean commits
documented environment variables

Avoid unnecessary dependencies.

Do not implement features outside MVP scope unless required for the architecture.

## Build sequence

Work incrementally.

First establish repository structure and documentation.

Then database schema and migrations.

Then seed data and geographic models.

Then authentication abstraction.

Then mobile navigation and UI shell.

Then report creation.

Then district detection.

Then public report tracking.

Then district dashboard.

Then notifications.

Then moderation.

Then testing and documentation.

After each major phase:

run linting
run type checks
run tests
fix errors before continuing

Do not knowingly leave broken builds.

## Definition of done

The MVP is complete when a developer can run the project locally and demonstrate:

```text
Open Balaa
→ Browse public map
→ Tap Report Problem
→ Complete mock Digital Egypt verification
→ Capture/select development camera input
→ Obtain location
→ Resolve location to Cairo district
→ Create a report
→ Generate BLAA public ID
→ Trigger test notification
→ View report publicly
→ Open district dashboard
→ Update report to acknowledged
→ Change to in progress
→ Upload resolution evidence
→ Resolve report
→ See Before/After result as citizen
```

Before writing large amounts of implementation code, inspect the repository, create the architecture documents and propose the exact implementation plan.

Then execute the plan phase-by-phase without changing the agreed product scope.