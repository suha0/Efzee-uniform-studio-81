# Uniform Studio 81

## Uniform Manufacturing & Order Management System

Uniform Studio 81 is a full-stack web application developed to digitally manage the complete workflow of a uniform manufacturing business.

The system centralizes customer management, order processing, production tracking, quality control, alteration management, delivery tracking, team management, notifications, reports, and professional PDF order-sheet generation into one platform.

The application is designed to reduce manual paperwork, improve order visibility, simplify production tracking, and provide a structured workflow from customer order creation to final delivery.

---

## 🌐 Live Application

**Live Website:**  
https://uniformstudio-81.vercel.app

---

## 📋 Project Overview

Uniform Studio 81 provides a centralized digital workspace for managing uniform manufacturing operations.

Instead of maintaining separate records for customers, orders, production, quality checks, alterations, and deliveries, the application connects these processes into a single workflow.

### Complete Workflow

```text
Customer
    ↓
Order Creation
    ↓
Production
    ↓
Quality Check
    ↓
Alteration
    ↓
Delivery
    ↓
Completion
```

Each stage can be monitored through the application, allowing authorized users to understand the current status of every order.

---

# ✨ Features

## 🔐 Authentication & Security

- Secure user authentication
- Google Sign-In
- Supabase Authentication
- Protected application routes
- Role-based access control
- User session management
- Secure database access
- Row Level Security
- Password reset functionality
- Authorized team member access

---

## 📊 Dashboard

The dashboard provides a centralized overview of the business workflow.

### Dashboard capabilities

- View overall order statistics
- Monitor active orders
- Track production progress
- View pending quality checks
- Monitor deliveries
- View completed orders
- Quickly access important modules
- Display important business information in one place

---

## 👥 Customer Management

The customer management module allows authorized users to maintain customer information in one centralized location.

### Features

- Add customers
- View customer records
- Update customer information
- Manage customer contact details
- View customer-related orders
- Maintain organized customer records
- Quickly access customer information while creating orders

---

## 📦 Order Management

The order management system is the core module of Uniform Studio 81.

### Features

- Create new orders
- Assign orders to customers
- View all orders
- View individual order details
- Update order information
- Track order status
- Manage order quantities
- Manage uniform sizes
- Track order progress
- Add order remarks
- Monitor production status
- Track quality status
- Track alteration requirements
- Track delivery status

---

## 🧾 Professional Order Sheet PDF

Uniform Studio 81 provides professional PDF order-sheet generation for individual orders.

Generated order sheets can contain:

- Customer information
- Order information
- Product information
- Size-wise quantities
- Additional empty size field
- Total quantity
- Order remarks
- Structured table layout
- Proper borders and alignment
- Print-friendly formatting

The PDF layout is designed to provide a clean physical order sheet that can be used during manufacturing and order processing.

---

## 🏭 Production Management

The production module helps track the manufacturing stage of orders.

### Features

- View orders in production
- Monitor production progress
- Track production status
- Organize manufacturing workflow
- Identify pending production work
- Move orders through the manufacturing process

---

## ✅ Quality Management

The quality module helps ensure that completed production passes the required quality checks before moving forward.

### Features

- Track quality-check status
- Monitor pending quality checks
- Identify orders requiring attention
- Update quality status
- Support quality-control workflow

---

## ✂️ Alteration Management

The alteration workflow allows the business to track orders that require modifications after quality checking.

### Features

- Identify orders requiring alteration
- Track alteration progress
- Monitor alteration status
- Move completed alterations toward delivery

---

## 🚚 Delivery Management

The delivery module manages the final stage of the order lifecycle.

### Features

- Track pending deliveries
- Monitor delivery status
- Manage completed deliveries
- Track orders through final completion
- Maintain visibility of delivered orders

---

## 👨‍💼 Team Member Management

Authorized users can manage members of the organization through the team management system.

### Features

- Add team members
- Manage user accounts
- Assign roles
- Control access
- Remove team members when required
- Maintain organization-level user management

---

## 🔔 Notifications

The notification system provides users with important application and workflow updates.

### Features

- View notifications
- Track important order updates
- Receive workflow-related information
- Centralized notification management

---

## 📈 Reports

The reports module provides useful information about the organization's order workflow.

### Features

- Order reporting
- Production reporting
- Status-based information
- Workflow monitoring
- Business overview
- Management-oriented insights

---

## ⚙️ Settings

The settings module provides access to application-level configuration and user-related settings.

---

# 🖥️ Application Modules

| Module | Purpose |
|---|---|
| Dashboard | Overall business and order overview |
| Customers | Customer information and records |
| Orders | Create and manage orders |
| Order Details | View complete individual order information |
| Production | Track manufacturing progress |
| Quality | Manage quality-control workflow |
| Alteration | Track required alterations |
| Delivery | Manage deliveries |
| Reports | View business and order reports |
| Notifications | View application notifications |
| Team Members | Manage users and roles |
| Settings | Application configuration |

---

# 🔄 Order Lifecycle

The application follows a structured order lifecycle:

```text
┌──────────────┐
│   Customer   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Order Created│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Production  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Quality Check │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Alteration  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Delivery   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Completed   │
└──────────────┘
```

This workflow provides clear visibility into the current stage of every order.

---

# 🛠️ Technology Stack

## Frontend

- React
- TypeScript
- TanStack Router
- TanStack Query
- Vite
- CSS
- Responsive UI components

## Backend & Database

- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase Edge Functions
- Row Level Security

## Authentication

- Supabase Auth
- Google OAuth
- Protected routes
- Role-based access control

## PDF Generation

- Browser-based PDF generation
- Custom PDF layouts
- Structured order tables
- Print-friendly formatting

## Development Tools

- Visual Studio Code
- Git
- GitHub
- npm

## Deployment

- Vercel

---

# 🏗️ Application Architecture

```text
Uniform Studio 81
│
├── Authentication
│   ├── Login
│   ├── Google Authentication
│   ├── Password Reset
│   └── Protected Routes
│
├── Dashboard
│
├── Customer Management
│
├── Order Management
│   ├── Order List
│   ├── New Order
│   └── Order Details
│
├── Production Management
│
├── Quality Management
│
├── Alteration Management
│
├── Delivery Management
│
├── Reports
│
├── Notifications
│
├── Team Management
│
└── Settings
```

---

# 📁 Project Structure

```text
Efzee-uniform-studio-81/
│
├── public/
│   ├── favicon.ico
│   └── other public assets
│
├── src/
│   │
│   ├── components/
│   │
│   ├── hooks/
│   │
│   ├── integrations/
│   │   └── supabase/
│   │
│   ├── lib/
│   │
│   ├── routes/
│   │   ├── _authenticated/
│   │   │   ├── customers.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── delivery.tsx
│   │   │   ├── notifications.tsx
│   │   │   ├── orders.$orderId.tsx
│   │   │   ├── orders.index.tsx
│   │   │   ├── orders.new.tsx
│   │   │   ├── production.tsx
│   │   │   ├── quality.tsx
│   │   │   ├── reports.tsx
│   │   │   ├── settings.tsx
│   │   │   ├── users.tsx
│   │   │   └── route.tsx
│   │   │
│   │   ├── __root.tsx
│   │   ├── auth.tsx
│   │   ├── index.tsx
│   │   └── reset-password.tsx
│   │
│   ├── styles.css
│   └── main.tsx
│
├── supabase/
│   ├── functions/
│   │   ├── create-team-member/
│   │   └── delete-team-member/
│   │
│   └── migrations/
│
├── .env
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

# 🔑 Environment Variables

The application uses environment variables for Supabase configuration.

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY"
VITE_SUPABASE_PROJECT_ID="YOUR_SUPABASE_PROJECT_ID"
```

For server-side functionality, configure the required Supabase environment variables in the deployment environment.

### Important

Never commit actual credentials, private keys, service-role keys, or secret environment variables to GitHub.

The `.env` file should remain excluded from version control.

---

# 🚀 Local Development

## Prerequisites

Before running the project locally, make sure you have:

- Node.js installed
- npm installed
- Git installed
- A configured Supabase project
- Required environment variables

---

## 1. Clone the Repository

```bash
git clone https://github.com/suha0/Efzee-uniform-studio-81.git
```

---

## 2. Navigate to the Project

```bash
cd Efzee-uniform-studio-81
```

---

## 3. Install Dependencies

```bash
npm install
```

---

## 4. Configure Environment Variables

Create a `.env` file in the project root and add the required Supabase configuration:

```env
VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY"
VITE_SUPABASE_PROJECT_ID="YOUR_SUPABASE_PROJECT_ID"
```

---

## 5. Start the Development Server

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:8080
```

---

# 🏭 Production Build

To create a production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

# ☁️ Deployment

The application is deployed using Vercel.

### Production URL

```text
https://uniformstudio-81.vercel.app
```

The deployment process can be connected directly to the GitHub repository so that updates can be deployed whenever changes are pushed to the configured branch.

---

# 🔐 Security

Security is an important part of the application architecture.

The application uses:

- Supabase Authentication
- Google OAuth
- Protected routes
- Role-based access control
- PostgreSQL
- Row Level Security
- Secure environment variables
- Server-side functions where required
- Authentication state management
- Restricted database access

Sensitive credentials are not stored directly in the source code.

---

# 📱 Responsive Design

Uniform Studio 81 is designed to provide a consistent user experience across different screen sizes.

Supported environments include:

- Desktop
- Laptop
- Tablet
- Modern web browsers

---

# 🎯 Project Goals

The main goals of Uniform Studio 81 are to:

- Digitize uniform manufacturing operations
- Reduce manual paperwork
- Centralize customer information
- Simplify order management
- Improve production visibility
- Track quality-control stages
- Manage alterations efficiently
- Monitor deliveries
- Improve team coordination
- Generate professional order documents
- Provide useful business reports
- Maintain secure access to business information

---

# 📊 Benefits

The system helps provide:

### Better Organization

All important customer and order information is maintained in one centralized application.

### Improved Visibility

Users can quickly determine the current stage of an order.

### Reduced Manual Work

Digital order management reduces dependence on manually maintained records.

### Faster Order Processing

Orders can be created, updated, tracked, and reviewed from a single platform.

### Better Production Tracking

Production teams can monitor orders throughout the manufacturing process.

### Improved Delivery Management

Completed orders can be tracked through the final delivery stage.

### Professional Documentation

Order-sheet PDFs provide a structured and printable format for manufacturing workflows.

---

# 🔮 Future Enhancements

Potential future improvements include:

- Advanced analytics dashboards
- Inventory management
- Stock tracking
- Fabric inventory management
- Payment tracking
- Invoice generation
- WhatsApp notifications
- Automated email notifications
- Customer notification system
- Barcode-based order tracking
- QR-code order tracking
- Advanced production scheduling
- Improved business intelligence
- Custom domain integration
- Automated backups
- Enhanced reporting and analytics

---

# 🧪 Testing

Before deploying updates, the application should be tested across the major workflows:

```text
Authentication
      ↓
Dashboard
      ↓
Customer Management
      ↓
Order Creation
      ↓
Order Details
      ↓
Production
      ↓
Quality
      ↓
Alteration
      ↓
Delivery
      ↓
Reports
```

Important functionality to verify includes:

- Login
- Google authentication
- Logout
- Protected routes
- Customer creation
- Order creation
- Order editing
- Order details
- PDF generation
- Production updates
- Quality updates
- Alteration tracking
- Delivery tracking
- Team member management
- Notifications
- Reports
- Settings

---

# 🗃️ Database

The application uses PostgreSQL through Supabase.

The database is responsible for storing and managing application data such as:

- Users
- Customers
- Orders
- Order items
- Production information
- Quality information
- Alteration information
- Delivery information
- Notifications
- Team member information

Database access is protected using authentication and Row Level Security policies.

---

# 🔄 Git Workflow

Recommended workflow for future development:

```bash
git status
```

Create or switch to a feature branch:

```bash
git checkout -b feature/your-feature-name
```

After making changes:

```bash
git add .
```

Commit the changes:

```bash
git commit -m "feat: describe your changes"
```

Push the branch:

```bash
git push origin feature/your-feature-name
```

After testing, merge the changes into the production branch.

---

# 📝 Version Control

The project source code is maintained using Git and GitHub.

Repository:

https://github.com/suha0/Efzee-uniform-studio-81

Version control helps maintain:

- Development history
- Feature branches
- Bug fixes
- Production releases
- Collaboration
- Backup of source code

---

# 👩‍💻 Developer

## Suu

Computer Science & Engineering

Uniform Studio 81 was developed as a complete digital management solution for uniform manufacturing operations.

---

# 📄 License

This project is developed for **Uniform Studio 81**.

All rights reserved.

The source code, application design, database structure, business logic, and associated assets are proprietary.

Unauthorized copying, redistribution, modification, or commercial use of this project is not permitted without prior permission from the project owner.

---

# ⭐ Uniform Studio 81

**A centralized digital platform for managing uniform manufacturing from order to delivery.**

```text
Customer → Order → Production → Quality → Alteration → Delivery → Completion
```

---

## 🌐 Links

**Live Application:**  
https://uniformstudio-81.vercel.app

**GitHub Repository:**  
https://github.com/suha0/Efzee-uniform-studio-81
