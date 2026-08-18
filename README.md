# Uniform Flow

Build Uniform Studio 81 — Production-Ready Uniform Manufacturing Order Management System

1. PROJECT OVERVIEW

Build a complete, modern, production-ready web application called Uniform Studio 81.

Uniform Studio 81 is an Order Management and Production Tracking System for a uniform manufacturing business. The application must manage the complete order lifecycle:

Customer → Sales Order → Production → Quality Inspection → Alteration → Delivery → Completion

The application should replace manual registers, spreadsheets, WhatsApp-based updates, and disconnected production tracking with a centralized digital system.

This is NOT a landing page or prototype.

Build it as a real-world business management application with:

Authentication

Role-based authorization

Persistent database

Order management

Customer management

Production workflow

Quality control

Alteration tracking

Notifications

Dashboard analytics

Search and filtering

Image/document uploads

PDF order-sheet generation

Audit/history tracking

Responsive UI

Secure database access

Production-ready deployment

2. CORE TECHNOLOGY REQUIREMENTS

Use a modern production-ready architecture.

Preferred stack:

React

TypeScript

Vite

Tailwind CSS or a clean equivalent utility-based styling system

Supabase

PostgreSQL database

Authentication

Storage

Row Level Security

Realtime subscriptions where useful

Do NOT use browser localStorage as the primary database.

All important business data must be stored in Supabase/PostgreSQL.

Use environment variables for all secrets and configuration.

Never expose private API keys, service-role keys, database passwords, or secrets in frontend code.

3. BRANDING

Application name:

Uniform Studio 81

Create a professional identity suitable for a real uniform manufacturing company.

Design direction:

Modern

Professional

Clean

Premium

Industrial/manufacturing feel

Minimal but visually attractive

Easy to use for employees who are not highly technical

Use a consistent design system throughout the application.

Include:

Application logo/wordmark

Professional sidebar

Top navigation

Cards

Tables

Status badges

Forms

Modals

Toast notifications

Empty states

Loading states

Error states

Confirmation dialogs

Avoid excessive gradients, unnecessary animations, and overly decorative UI.

Prioritize usability.

4. USER ROLES

Implement three roles:

Sales

Sales users can:

Create customers

Create orders

Edit their orders

View order status

Search orders

View production progress

View delivery information

Receive notifications

Sales users should NOT be able to modify production stages unless explicitly permitted.

Production

Production users can:

View assigned/current orders

View complete order specifications

Update production stages

Add production notes

Upload production progress images

Mark production stages as completed

Report production issues

View deadlines

Receive production-related notifications

Production users should NOT be able to modify sensitive sales/customer information unless explicitly allowed.

Admin

Admin users have full access.

Admins can:

Manage users

Manage customers

Manage orders

Manage production

Manage quality control

Manage alterations

Manage notifications

View analytics

Configure system settings

View audit logs

Delete/archive records where appropriate

5. AUTHENTICATION

Implement secure authentication using Supabase Auth.

Provide:

Login

Registration

Logout

Forgot password

Password reset

Session persistence

Protected routes

Role-based route protection

Registration fields:

Full Name

Organization

Email

Password

Role

Do NOT allow users to freely assign themselves Admin in production.

Admin creation/role assignment must be controlled securely.

After login, redirect users to the appropriate dashboard.

Display:

User name

Organization

Role

Profile menu

Logout

6. DATABASE ARCHITECTURE

Create a proper relational PostgreSQL schema.

At minimum create:

users/profiles

Fields:

id

auth_user_id

full_name

organization

email

role

avatar_url

is_active

created_at

updated_at

customers

Fields:

id

customer_code

customer_name

organization

phone

email

address

city

state

notes

created_at

updated_at

orders

Fields:

id

order_number

batch_number

customer_id

created_by

order_date

expected_delivery_date

status

priority

product_name

product_category

total_quantity

fabric_details

accessory_details

customization_details

special_instructions

remarks

created_at

updated_at

Order statuses should include appropriate lifecycle states such as:

Draft

Confirmed

In Production

Quality Check

Alteration Required

Ready for Delivery

Delivered

Completed

Cancelled

order_items

Each order can contain multiple products.

Fields:

id

order_id

product_name

product_type

description

quantity

unit_price

total_price

fabric

color

customization

created_at

size_quantities

Store size-specific quantities.

Support sizes such as:

XS

S

M

L

XL

XXL

3XL

Custom

Allow additional/custom sizes.

Example:

XS: 10
S: 25
M: 40
L: 35
XL: 20

Automatically calculate total quantity.

7. PRODUCTION WORKFLOW

Create a production pipeline with these stages:

Fabric Procurement

Cutting

Stitching

Embroidery / Printing

Packing

Each production stage should have:

Stage name

Status

Started date

Completed date

Assigned employee

Notes

Progress percentage

Images

Issues

Updated timestamp

Statuses:

Not Started

In Progress

Completed

Blocked

Show production visually using:

Timeline

Progress indicators

Status badges

Completion percentage

Calculate overall production progress automatically.

8. PRODUCTION IMAGES

Allow production users to upload images for each production stage.

Examples:

Fabric inspection

Cutting progress

Stitching progress

Embroidery

Finished garments

Packing

Use Supabase Storage.

Store:

Image URL

Stage

Order ID

Uploaded by

Timestamp

Optional description

Create an attractive image gallery.

Allow:

Upload

Preview

Delete if authorized

Full-screen viewing

9. QUALITY CONTROL

Create a dedicated Quality / Delivery module.

For each order, provide:

Inspection date

Inspector

Quantity inspected

Quantity passed

Quantity failed

Defect count

Client feedback

Quality notes

Delivery status

Quality statuses:

Pending Inspection

Passed

Failed

Alteration Required

Ready for Delivery

Delivered

Completed

10. ALTERATION MANAGEMENT

If quality inspection identifies an issue, create an alteration record.

Fields:

alteration_id

order_id

issue_description

affected_quantity

correction_required

assigned_to

priority

status

created_at

completed_at

notes

Statuses:

Open

In Progress

Completed

Verified

Automatically notify relevant users when an alteration is created.

11. NOTIFICATION SYSTEM

Implement a proper notification center.

Notifications should be generated for events such as:

New order created

Order confirmed

Production started

Production stage completed

Production blocked

Delivery deadline approaching

Quality failure

Alteration required

Alteration completed

Order delivered

Each notification should contain:

Title

Message

Type

Related order

Recipient

Read/unread status

Timestamp

Provide:

Notification bell

Unread count

Notification dropdown

Mark as read

Mark all as read

Navigate to related order

Use Supabase Realtime where appropriate.

12. DASHBOARD

Create a role-aware dashboard.

Admin Dashboard

Show:

Total Orders

Active Orders

Orders in Production

Quality Pending

Alterations

Ready for Delivery

Completed Orders

Overdue Orders

Charts:

Orders by status

Orders over time

Production progress

Delivery performance

Product/category distribution

Add a recent orders table.

Add alerts for:

Overdue orders

Production delays

Quality failures

Pending alterations

Upcoming deliveries

Sales Dashboard

Focus on:

My Orders

New Orders

Pending Orders

Orders in Production

Upcoming Deliveries

Recently Completed Orders

Production Dashboard

Focus on:

Active Production Orders

Assigned Tasks

Blocked Stages

Today's Work

Upcoming Deadlines

Production Progress

13. SALES / ORDER CREATION

Create a professional multi-step order creation form.

Step 1 — Customer

Existing customer search

Create new customer

Step 2 — Order Information

Order number

Batch number

Order date

Expected delivery date

Priority

Step 3 — Product

Product name

Product category

Quantity

Fabric

Color

Customization

Accessories

Step 4 — Size Breakdown

Provide a clean editable size/quantity table.

Example:

SizeQuantityXS10S20M40L30XL15XXL5

Automatically calculate total quantity.

Step 5 — Additional Information

Special instructions

Remarks

Attachments

Step 6 — Review

Display the complete order before submission.

Buttons:

Save Draft

Create Order

Cancel

Validate all required fields.

14. ORDER DETAILS PAGE

Create a comprehensive order details page.

Header should show:

Order number

Batch number

Customer

Current status

Priority

Delivery date

Tabs:

Overview

Customer and order information.

Products

Product specifications and size quantities.

Production

Production timeline and progress.

Quality

Inspection information.

Alterations

Alteration history.

Files

Uploaded images/documents.

Activity

Complete order history.

15. ORDER ACTIVITY / AUDIT LOG

Track important actions.

Examples:

"Order created by John"

"Fabric Procurement marked In Progress"

"Cutting completed"

"Quality inspection failed"

"Alteration created"

"Order marked Delivered"

Each activity should store:

User

Action

Timestamp

Related order

Optional metadata

Admins should be able to view the complete history.

16. SEARCH AND FILTER

Implement global order search.

Search by:

Order number

Batch number

Customer

Product

Filters:

Status

Priority

Production stage

Delivery date

Customer

Created date

Provide sorting and pagination.

Search should be fast and user-friendly.

17. PDF ORDER SHEET

Implement professional PDF generation.

Generate an A4 landscape Order Sheet.

The PDF should contain:

Uniform Studio 81 branding/logo

Order number

Batch number

Customer information

Order date

Delivery date

Product information

Fabric details

Accessories

Customization

Size/quantity table

Product images

Special instructions

Remarks

Signature areas

Make the PDF suitable for:

Printing

Factory use

Customer records

Production documentation

Add a Download PDF button.

18. CUSTOMER MANAGEMENT

Create a dedicated customer management section.

Features:

Customer list

Search

Add customer

Edit customer

View customer

Customer order history

Customer detail page should show:

Contact information

Total orders

Active orders

Completed orders

Recent orders

19. USER MANAGEMENT

Admin-only module.

Display:

Name

Email

Organization

Role

Status

Created date

Actions:

Activate/deactivate user

Change role

Edit profile

View activity

Never expose passwords.

20. RESPONSIVE DESIGN

The application must work properly on:

Desktop

Laptop

Tablet

Mobile

Desktop should have a sidebar navigation.

Mobile should use:

Collapsible navigation

Mobile-friendly tables

Responsive cards

Touch-friendly buttons

Avoid horizontal overflow wherever possible.

21. UI/UX REQUIREMENTS

Create a polished SaaS-style dashboard.

Use:

Consistent spacing

Clear typography

Strong visual hierarchy

Professional icons

Accessible contrast

Status colors

Responsive cards

Data tables

Skeleton loaders

Use subtle animations only where they improve usability.

Every important action should provide feedback.

Examples:

"Order created successfully"

"Production stage updated"

"Image uploaded successfully"

"Quality inspection saved"

22. ERROR HANDLING

Implement proper error handling.

Handle:

Network failures

Database errors

Authentication errors

Invalid forms

Duplicate orders

Upload failures

Unauthorized access

Missing records

Never show raw technical errors to users.

Show friendly messages.

23. SECURITY

This is critical.

Implement:

Supabase Row Level Security

Role-based database access

Protected routes

Secure authentication

Input validation

File upload validation

File size restrictions

Safe database queries

No secrets in frontend

No service-role keys in browser

Proper authorization checks

Sales users must not access Admin functionality.

Production users must not modify restricted Sales data.

Admin has full access.

Do not rely only on frontend role checks. Enforce permissions at the database/backend level.

24. DATA VALIDATION

Validate:

Required fields

Email format

Phone format

Quantity values

Delivery dates

Duplicate order numbers

File types

File sizes

Prevent invalid negative quantities.

Delivery date should not accidentally be earlier than order date.

25. SEED / DEMO DATA

Create realistic demo data for development/testing.

Include:

Several users

Several customers

Multiple orders

Different production statuses

Quality failures

Alterations

Notifications

Production images placeholders if appropriate

Do not hard-code fake data into production logic.

Create a proper database seed process if possible.

26. PERFORMANCE

Optimize the application for production.

Use:

Lazy loading where appropriate

Pagination

Efficient database queries

Indexed searchable fields

Optimized images

Proper caching where appropriate

Debounced search

Avoid unnecessary re-renders

Do not load the entire order database when only one page is needed.

27. EMPTY STATES

Every list/table must have a useful empty state.

Examples:

"No orders found"

"No production tasks assigned"

"No notifications"

"No customers yet"

Provide appropriate CTA buttons.

28. LOADING STATES

Every asynchronous operation should have a loading state.

Examples:

Login loading

Dashboard loading

Order creation loading

PDF generation loading

Image upload progress

Database save loading

Disable buttons appropriately during submissions to prevent duplicate requests.

29. DATABASE INDEXING

Add indexes for frequently searched fields such as:

order_number

batch_number

customer_id

status

expected_delivery_date

created_at

production status

Optimize queries for dashboard analytics.

30. REAL-TIME UPDATES

Where appropriate, use Supabase Realtime for:

Notifications

Production status changes

Order status updates

If a production user updates an order, relevant dashboard information should update without requiring a full page refresh where practical.

31. FILE STORAGE

Use Supabase Storage for:

Production images

Product images

Order attachments

User avatars

Create secure storage policies.

Users should only access files they are authorized to access.

32. NAVIGATION

Create a clean sidebar:

Dashboard

Sales

Orders

Customers

Production

Quality / Delivery

Notifications

Users — Admin only

Reports

Profile

Settings

Highlight the active section.

33. REPORTS

Create a Reports section.

Allow admins to view:

Orders by date

Orders by status

Production completion

Delayed orders

Delivery performance

Customer order volume

Provide date filters.

Where practical, allow CSV/PDF export.

34. SETTINGS

Create settings for:

Organization information

Profile

Notification preferences

Application preferences

Admin settings may include:

Organization logo

Company name

Address

Phone

Email

These values should be used in generated PDF documents.

35. PRODUCTION DEPLOYMENT

The application must be prepared for actual production deployment.

Use:

Supabase for backend/database/auth/storage

Vercel or equivalent modern hosting for frontend

Provide:

Production environment variables

Database migrations

RLS policies

Storage policies

Build configuration

Production build verification

The final application should run with:

npm install
npm run build

without errors.

36. ENVIRONMENT VARIABLES

Use environment variables such as:

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

Never commit .env files containing secrets.

Create an .env.example.

37. README

Create a comprehensive README containing:

Project overview

Features

Technology stack

Architecture

Installation

Environment setup

Supabase setup

Database migration instructions

Storage setup

Running locally

Building for production

Deployment instructions

User roles

Security notes

38. PRODUCTION CHECKLIST

Before considering the project complete, verify:

Authentication

Registration works

Login works

Logout works

Password reset works

Protected routes work

Role permissions work

Orders

Create order

Edit order

View order

Search order

Filter order

Delete/archive order according to permissions

PDF generation works

Production

Stage updates work

Progress calculation works

Images upload correctly

Notes save correctly

Production status changes trigger notifications

Quality

Inspection works

Failed inspections work

Alterations work

Alteration completion works

Delivery status works

Notifications

Notifications are created

Unread count works

Read state works

Related order navigation works

Security

RLS policies work

Unauthorized users cannot access restricted records

Admin functionality is protected

Storage is protected

UI

Desktop responsive

Tablet responsive

Mobile responsive

Loading states

Empty states

Error states

Toast notifications

Production

Build succeeds

No console errors

No exposed secrets

Database migrations work

Environment variables work

Deployment works

39. IMPORTANT DEVELOPMENT INSTRUCTION

Do not create a superficial mockup.

Build the actual functional application.

Do not use localStorage for core business data.

Do not hard-code dashboard statistics.

All dashboard values must come from the database.

Do not create fake authentication.

Do not simulate database operations with static arrays.

All CRUD operations must persist to Supabase.

Implement the complete database schema and security policies.

Use reusable components and clean TypeScript architecture.

Keep the code maintainable and modular.

40. IMPLEMENTATION STRATEGY

Build the application in logical phases:

Phase 1

Project architecture + design system + authentication

Phase 2

Supabase database schema + RLS + storage

Phase 3

Dashboard

Phase 4

Customer and Sales Order Management

Phase 5

Production Tracking

Phase 6

Quality + Alteration Management

Phase 7

Notifications + Realtime

Phase 8

PDF Order Sheets + Reports

Phase 9

Admin + Settings + Audit Logs

Phase 10

Responsive optimization + security + testing

Phase 11

Production build + deployment

Do not move to the next phase while leaving the previous phase broken.

41. FINAL QUALITY STANDARD

The final result should feel like a professional commercial SaaS product rather than a student demo.

The application should be:

Reliable

Secure

Fast

Responsive

Maintainable

Visually polished

Database-driven

Role-aware

Production-ready

Use realistic business terminology throughout the application.

Make the workflow intuitive enough that a sales employee or factory production employee can use it without technical training.

Start by creating the architecture, database schema, authentication, and core application shell. Then implement the modules systematically and verify each feature before moving forward.

FINAL GOAL

Deliver a fully functional production-ready Uniform Studio 81 Order Management System that manages the complete lifecycle:

Customer → Order → Production → Quality → Alteration → Delivery → Completion

with secure authentication, role-based access, PostgreSQL persistence, realtime notifications, production image tracking, analytics, reporting, and professional PDF order sheets.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://uniform-studio-81.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e3a75980-e6b2-4607-923e-2ffdec753128).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
