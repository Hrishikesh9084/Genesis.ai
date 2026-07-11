# Genesis AI

Genesis AI is a full-stack AI product platform for building, managing, previewing, and deploying web applications from one workspace. It combines a React frontend, a Node.js/Express backend, PostgreSQL, and multiple AI integrations to support the full product lifecycle from project creation to live deployment.

The application is designed for developers, founders, and job seekers. On the product side it provides AI-assisted project generation, live previews, deployment orchestration, custom domain management, support and contact flows, careers and mock interview features, and admin tooling. On the engineering side it emphasizes secure authentication, structured APIs, deployment readiness, and production-oriented workflows.

## What This Application Does

Genesis AI turns an idea into a working application workspace. Users can sign in, create projects, generate and edit project files, preview output, deploy applications, and manage project settings in a single flow. The platform also includes additional business workflows such as newsletters, contact forms, careers applications, payments, and admin review screens.

## Core Features

### AI Project Workflow

- Create new projects from a guided interface.
- Generate project structure and files with AI assistance.
- Persist generation in phases so file updates appear during the build process.
- Edit project files inside a code-focused workspace.
- View project details, status, and generated output.
- Refresh project details while a project is generating for near live updates.

### Preview and Development Experience

- Preview generated applications before deployment.
- Use an embedded code editor for project changes.
- Browse files through a project tree interface.
- Monitor application state and preview rendering from the dashboard.
- Access a help bot and onboarding tour for guidance inside the app.

### Deployment and Hosting

- Deploy projects from the platform.
- Support managed deployment flows with runtime orchestration.
- Support custom domain and subdomain routing.
- Proxy wildcard deployment domains to the correct runtime instance.
- Validate deployment health before marking projects as live.
- Track deployment state, logs, and runtime metadata.

### Authentication and Account Management

- Register, log in, reset passwords, and manage session-based access.
- Support GitHub and Google OAuth callback flows.
- Protect dashboard and project routes behind authentication.
- Manage user settings and profile data.
- Store and render avatar uploads safely in serverless environments.

### Domains and Infrastructure

- Register and manage domains for deployed projects.
- Map subdomains to project deployments.
- Handle wildcard routing for Genesis-managed hosts.
- Keep deployment records and domain mappings in sync.

### Careers and Hiring Flows

- Browse live careers listings.
- Apply with resume and form-based submissions.
- Track application status.
- Run AI mock interviews and display interview results.
- Send applicant confirmations and admin notifications separately.

### Contact and Support

- Submit contact requests through the website.
- Support optional callback requests with phone and preferred callback time.
- Route support and callback emails through the existing contact flow.
- Provide support pages and structured user communication entry points.

### Newsletters and Admin Tools

- Subscribe users to newsletter workflows.
- Provide an admin newsletter dashboard.
- Review admin applications.
- Support internal administration screens for platform operations.

### Payments and Business Logic

- Integrate payment gateway support for platform purchases or billing flows.
- Keep payment-related endpoints separated from product-generation logic.

## Application Areas

The app is organized around these major user experiences:

- Public marketing pages: home, about, pricing, documentation, legal pages, and contact.
- Auth pages: login, registration, password reset, and OAuth callbacks.
- Workspace pages: dashboard, new project, project detail, edit, deploy, domains, and settings.
- Career pages: careers listing, application, status tracking, mock interview, and interview results.
- Admin pages: applications review and newsletter management.

## Frontend Stack

- React 19
- Vite
- React Router
- Redux Toolkit and React Redux
- Tailwind CSS
- Monaco Editor
- Framer Motion and GSAP
- Lucide React and React Icons
- Axios
- React Hot Toast
- Lenis for smooth scrolling

### Frontend Highlights

- Lazy-loaded routes for faster startup.
- Route guards for authenticated and guest-only pages.
- Boot loading screen and animated background treatment.
- Help bot and onboarding tour for product guidance.
- Responsive pages for desktop and mobile.

## Backend Stack

- Node.js with Express
- PostgreSQL
- CORS, Helmet, rate limiting, and compression for server hardening
- JWT-based authentication
- bcryptjs for password hashing
- multer for file uploads
- nodemailer for email delivery
- Razorpay for payment integration
- Cloudinary for media storage
- Octokit and GitHub integrations
- AI provider support through OpenAI, Anthropic, Google Gemini, and Mistral-compatible services

### Backend Highlights

- Health endpoint for service verification.
- Route separation by domain: auth, projects, deploy, domains, payments, contact, careers, support, newsletter, and admin newsletter.
- Wildcard subdomain proxying for managed deployment hosting.
- Production static serving when the server is deployed with a built frontend.
- Graceful shutdown with database cleanup.

## High-Level Feature Map

- Project generation: create and persist project files with staged AI output.
- Project management: inspect, edit, and track project state.
- Live preview: render generated apps before deployment.
- Deployment orchestration: launch apps and expose them on hosted URLs.
- Domain management: connect custom or wildcard domains.
- Auth and accounts: secure sign-in and user profile flows.
- Careers: post jobs, accept applications, and run mock interviews.
- Communication: contact forms, callback requests, newsletters, and support.
- Admin operations: internal review and management screens.

## Folder Structure Summary

- `client/` contains the React application.
- `server/` contains the Express API, deployment logic, controllers, routes, and services.
- `packages/` contains shared package modules for auth, config, db, and environment helpers.
- `Structure/` contains product documentation.
- `previews/` and `test-app/` support preview and testing flows.

## Run Scripts

From the root project:

- `npm run dev` starts the client and server together.
- `npm run client` starts the frontend only.
- `npm run server` starts the backend only.
- `npm run build` builds the frontend for production.
- `npm run start` starts the server in production mode.

## Environment Setup

The app expects a configured `.env` file for database, OAuth, AI providers, email delivery, domain routing, and deployment settings. Secrets should never be committed to source control.

Common categories include:

- Database connection
- OAuth credentials
- AI provider keys
- Email transport configuration
- CORS and client URL settings
- Deployment and domain routing settings
- JWT and server runtime settings

## Developer Info

![Hrishikesh Chaudhari](./client/public/assets/IMG_20250929_140502_465.jpg)

**Hrishikesh Chaudhari**  
Nashik, Maharashtra, India

Genesis AI was built as a practical full-stack product focused on reducing the gap between an idea, a working workspace, and a live deployment. The goal is developer productivity through clear system design, scalable API structure, maintainable UI components, and production-oriented workflows.

## Developer Social Links

- GitHub: https://github.com/hrishikesh_9084
- LinkedIn: https://www.linkedin.com/in/hrishikesh-chaudhari-146b1126a/
- Instagram: https://www.instagram.com/iamhrishikeshchaudhari
- Email: hrisikeshc.dev@gmail.com
