# Newsletter Examples & Seeding Guide

## Quick Start with Sample Data

### Run the Seed Script

To populate your database with 5 example newsletters:

```bash
cd server
node scripts/seedNewsletters.js
```

This will create:
- **5 Weekly Newsletter Issues** with professional content
- **20+ Articles & News Items** across various categories
- **Sample Categories**: Features, Updates, Beta Releases, Tips, Resources, Guides, Tools

---

## Newsletter Template Structure

### Example Newsletter #1: "New AI Features & Performance Improvements"

**Issue Details:**
- **Subject Line:** New AI Features & Performance Improvements
- **Week:** April 1, 2026
- **Subscribers:** All active subscribers receive this

**Articles:**

1. **Faster Code Generation Engine**
   - Category: Feature
   - Description: We've optimized our AI model for 40% faster code generation. Your projects will be ready even quicker.
   - Link: https://genesis.ai/docs/features/fast-generation

2. **Full-Stack Template Library**
   - Category: Update
   - Description: New pre-built templates for MERN, Next.js, and Django stacks. Pre-configured with best practices.
   - Link: https://genesis.ai/templates

3. **GitHub Integration Enhanced**
   - Category: Feature
   - Description: Automatic GitHub repo creation now includes CI/CD pipelines. Deploy straight to production.
   - Link: https://genesis.ai/docs/github

4. **API Reference Docs Updated**
   - Category: Resource
   - Description: Complete REST API documentation with interactive examples for all deployment endpoints.
   - Link: https://genesis.ai/docs/api

---

## How to Create Your Own Newsletter

### Step 1: Access Admin Dashboard
- Go to `/admin/newsletter` in your Genesis.ai instance
- Ensure you're logged in as an admin user

### Step 2: Create New Issue
![Create Issue Flow]
1. Click **"New Issue"** button
2. Fill in:
   - **Title**: "Weekly Update - [Date]"
   - **Email Subject**: "Your catchy newsletter subject"
3. Click **"Create"**

### Step 3: Add Articles
1. Click the issue from the left sidebar
2. Click **"Add Article"**
3. Fill in required fields:
   - **Article Title**: Main headline
   - **Description**: 1-2 sentence summary (shows in email)
   - **Category**: Feature, Update, Tip, Guide, Beta, Resource, etc.
   - **Link**: URL for "Read More" (optional)
4. **Full Content**: Longer article text (optional, for your records)

### Step 4: Preview & Send
1. Click **"Preview"** to see how it looks
2. Verify all articles display correctly
3. Click **"Send Now"** to dispatch to subscribers
4. Newsletter status changes from "draft" to "sent"

---

## Newsletter Article Best Practices

### Article Categories

| Category | Purpose | Example |
|----------|---------|---------|
| **Feature** | New product capability | AI Code Generation, API Endpoints |
| **Update** | Improvements to existing features | Performance Boost, UI Redesign |
| **Beta** | Early access features | Collaboration Tools, Mobile Apps |
| **Tip** | Usage advice & best practices | Security Tips, Performance Tuning |
| **Guide** | Tutorials & how-tos | Getting Started, Deployment Guide |
| **Resource** | Documentation & tools | API Docs, Code Examples |
| **Tool** | New utilities & dashboards | Monitoring Dashboard, Code Analyzer |

### Writing Tips

✅ **Do:**
- Keep descriptions to 1-2 sentences
- Use action verbs: "Discover", "Enable", "Launch", "Explore"
- Include a link to learn more or take action
- Focus on user benefits, not technical details
- Use consistent tone (friendly, informative, professional)

❌ **Don't:**
- Write overly long descriptions (they get truncated in email)
- Include company jargon or acronyms without explanation
- Link to broken or internal-only URLs
- Create articles without a clear next action
- Mix multiple unrelated topics in one article

---

## Email Preview Examples

### How Articles Render in Email

```
Your Weekly Genesis.ai Newsletter

Hi there,

Check out this week's updates:

• Faster Code Generation Engine
  We've optimized our AI model for 40% faster code generation. Your 
  projects will be ready even quicker.
  https://genesis.ai/docs/features/fast-generation

• Full-Stack Template Library
  New pre-built templates for MERN, Next.js, and Django stacks. 
  Pre-configured with best practices.
  https://genesis.ai/templates

[More articles...]

Open Genesis.ai
Prefer not to receive these emails? Unsubscribe

- Genesis.ai Team
```

---

## Database Schema

### Newsletter Issues Table
```sql
CREATE TABLE newsletter_issues (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,           -- "Weekly Update - April 1"
  subject VARCHAR(255),                  -- Email subject line
  status VARCHAR(50),                    -- 'draft' or 'sent'
  scheduled_at TIMESTAMP,                -- When to send (future use)
  sent_at TIMESTAMP,                     -- When actually sent
  subscriber_count INTEGER,              -- How many received
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Newsletter Articles Table
```sql
CREATE TABLE newsletter_articles (
  id UUID PRIMARY KEY,
  issue_id UUID REFERENCES newsletter_issues(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,                      -- Shows in email
  content TEXT,                          -- Full article (optional)
  category VARCHAR(100),                 -- Feature, Update, Tip, etc.
  link TEXT,                             -- URL for call-to-action
  order_index INTEGER,                   -- Display order (0, 1, 2, ...)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## API Endpoints Reference

### Issues Management

```javascript
// List all issues
GET /api/admin/newsletter/issues?page=1&pageSize=10

// Get single issue with articles
GET /api/admin/newsletter/issues/:issueId

// Create new issue
POST /api/admin/newsletter/issues
{
  "title": "Weekly Update - April 1",
  "subject": "New Features Released"
}

// Update issue
PUT /api/admin/newsletter/issues/:issueId
{
  "title": "Updated Title",
  "subject": "Updated Subject",
  "status": "draft"  // or "sent"
}

// Delete issue
DELETE /api/admin/newsletter/issues/:issueId
```

### Articles Management

```javascript
// Create article
POST /api/admin/newsletter/articles
{
  "issueId": "uuid",
  "title": "New Feature",
  "description": "Short description",
  "content": "Full content (optional)",
  "category": "Feature",
  "link": "https://example.com"
}

// Update article
PUT /api/admin/newsletter/articles/:articleId
{
  "title": "Updated Title",
  "description": "Updated description",
  "category": "Update"
  // ... other fields
}

// Delete article
DELETE /api/admin/newsletter/articles/:articleId
```

### Sending

```javascript
// Send newsletter to all subscribers
POST /api/admin/newsletter/issues/:issueId/send

// Response:
{
  "message": "Newsletter is being sent",
  "issueId": "uuid"
}
```

---

## Scheduling & Automation

### Current Behavior
- Newsletters are sent **immediately** when you click "Send Now"
- All active, non-unsubscribed subscribers receive the issue
- Each subscriber gets a unique unsubscribe link

### Future Enhancement: Scheduled Sends
The schema supports `scheduled_at` timestamp for future sends:

```javascript
PUT /api/admin/newsletter/issues/:issueId
{
  "status": "scheduled",
  "scheduled_at": "2026-04-08T09:00:00Z"
}
```

---

## Sample Newsletter Prompts

Use these as starting points for your weekly newsletters:

### Week 1: Feature Spotlight
```
Subject: [Feature Name] - Now Available
Articles:
1. What's new
2. How to get started
3. Use cases & examples
4. Learn more link
```

### Week 2: Product Update
```
Subject: Performance & Security Updates
Articles:
1. Performance improvements
2. Security enhancements
3. Bug fixes
4. What's next
```

### Week 3: Community & Learning
```
Subject: Tips, Tricks & Community Wins
Articles:
1. Developer tip/tutorial
2. Community showcase
3. Best practices
4. Resources
```

### Week 4: Roadmap & Vision
```
Subject: Product Roadmap & What's Coming
Articles:
1. Currently shipping
2. In development
3. Planned features
4. Feedback request
```

---

## Troubleshooting

### Newsletter Not Sending?
- ✅ Check `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` environment variables
- ✅ Verify admin email is set in `ADMIN_EMAILS`
- ✅ Check that subscribers exist and `is_active = TRUE`

### Unsubscribe Links Not Working?
- ✅ Ensure `JWT_SECRET` or `NEWSLETTER_UNSUBSCRIBE_SECRET` is configured
- ✅ Check that `CLIENT_URL` or `API_URL` is set correctly

### Articles Not Appearing in Email?
- ✅ Verify article descriptions are not empty
- ✅ Check that `order_index` is set correctly (0, 1, 2...)
- ✅ Ensure issue is published (status = 'sent')

---

## Sample Data Included

Run `node scripts/seedNewsletters.js` to add these 5 example issues:

1. **April 1** - AI Features & Performance
   - Faster code generation, templates, GitHub integration, API docs

2. **March 25** - Language Support & Collaboration
   - Multi-language support, env management, real-time collab, best practices

3. **March 18** - Deployment & Performance
   - Vercel integration, Render backend, database schema, monitoring

4. **March 11** - Code Quality & Security
   - Automated testing, security audit, TypeScript strict mode, code review

5. **March 4** - Mobile & PWA Support
   - React Native, Flutter, PWA, mobile-first patterns

Each issue includes 4 articles with realistic content you can edit and use!

---

## Next Steps

1. ✅ Run the seed script to populate examples
2. ✅ View examples in `/admin/newsletter`
3. ✅ Customize categories and content for your brand
4. ✅ Set up your email configuration
5. ✅ Send your first newsletter!
