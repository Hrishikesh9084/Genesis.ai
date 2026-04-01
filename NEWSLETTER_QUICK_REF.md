# Newsletter Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Seed database with examples
node server/scripts/seedNewsletters.js

# 2. Open admin panel
# Navigate to /admin/newsletter in your browser
```

---

## 📋 Creating a Newsletter in 3 Steps

### Step 1: Create Issue
```
Button: "New Issue"
Title: "Weekly Update - April 8"
Subject: "Feature Releases & Tips"
Action: Click "Create"
```

### Step 2: Add Articles
```
Click: "Add Article"

Fields:
├─ Title: "New AI Features"
├─ Description: "40% faster code generation"
├─ Category: "Feature"
├─ Link: "https://..."
└─ Click: "Add Article"

Repeat for each article (4-5 recommended)
```

### Step 3: Send
```
Click: "Preview" → Check formatting
Click: "Send Now" → Confirm subscribers count
Newsletter sent! ✓
```

---

## 📝 Article Template

```markdown
Title:       [Main Headline]
Category:    [Feature|Update|Tip|Guide|Beta|Resource]
Description: [1-2 sentences, benefit-focused]
Link:        [URL to learn more]
```

### Example:
```
Title:       Vercel Auto-Deployment
Category:    Feature
Description: Deploy React apps to Vercel with one click. 
             Automatic domain setup and SSL included.
Link:        https://genesis.ai/docs/deploy/vercel
```

---

## 🎯 Email Preview

Newsletter in subscriber's inbox:
```
Your Weekly Genesis.ai Newsletter

Hi there,

Check out this week's updates:

• New AI Features
  40% faster code generation for your projects.
  https://genesis.ai/features

• GitHub Integration
  Automatic CI/CD pipeline setup included.
  https://genesis.ai/github

Open Genesis.ai
Unsubscribe

- Genesis.ai Team
```

---

## 📊 Best Practices

| Do ✅ | Don't ❌ |
|------|---------|
| 4-5 articles per week | 10+ articles (overwhelming) |
| Clear, benefit-focused | Technical jargon |
| Include call-to-action links | Links go nowhere |
| Consistent schedule (weekly) | Irregular, sporadic sends |
| Mix of features & tips | Only product announcements |
| Short descriptions | Long paragraphs |
| Real links | Placeholder URLs |

---

## 🏷️ Recommended Categories

```
Feature   → New capabilities
Update    → Improvements to existing features
Tip       → Usage advice, best practices
Guide     → Tutorials, how-to articles
Beta      → Early access, experimental features
Resource  → Docs, API refs, code samples
Tool      → New utilities, dashboards
Report    → Performance metrics, insights
```

---

## 📈 Newsletter Metrics

After sending, track:

```
✓ Subscribers reached
✓ Sent timestamp
✓ Open rate (external email tracking)
✓ Click-through rate (external analytics)
✓ Unsubscribe rate
✓ Article engagement (via links)
```

---

## 🔧 Environment Setup

Required for sending emails:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Genesis.ai <noreply@genesis.ai>
NEWSLETTER_SUBJECT=Your Weekly Genesis.ai Newsletter
```

Optional:
```bash
NEWSLETTER_DAY_UTC=1              # Monday
NEWSLETTER_HOUR_UTC=9             # 9:00 AM UTC
NEWSLETTER_UNSUBSCRIBE_SECRET=xxx # For unsubscribe tokens
```

---

## 📱 Mobile View

Newsletters are fully responsive:
```
Desktop  → 2-column layout
Tablet   → Stacked
Mobile   → Single column, touch-friendly buttons
```

---

## 🔒 Security Features

✅ Secure unsubscribe tokens (JWT signed)  
✅ Per-recipient unique tokens  
✅ Email validation  
✅ Admin-only access  
✅ Rate limiting on API  
✅ Encrypted credentials  

---

## 🆘 Troubleshooting

### Issue: "Newsletter not sending"
- Check SMTP configuration in .env
- Ensure ADMIN_EMAILS is set
- Verify subscribers exist (is_active = true)

### Issue: "Newsletter appears in spam"
- Add SPF/DKIM records to domain
- Use descriptive From address
- Include unsubscribe link (already done ✓)

### Issue: "Link clicks not tracked"
- Use URL shortener (bit.ly, short.link)
- Or add Analytics tracking params:
  ```
  https://genesis.ai/features?utm_source=newsletter&utm_week=2
  ```

---

## 🗓️ Weekly Calendar

### Suggested Schedule

```
Monday  → Review metrics from last week
Tuesday → Collect feature updates, news
Wed     → Write newsletter draft
Thu     → Get team feedback
Fri 9am → Send to subscribers
```

### Sample Topics

```
Week 1: Features
Week 2: Performance & Security
Week 3: Community & Tips
Week 4: Roadmap & Announcements
```

---

## 💡 Writing Templates

### Feature Spotlight
```
Title: [Feature Name]
Category: Feature
Description: [What] it does, [why] it matters, [how] to use it.
Link: [Docs or feature page]
```

### Developer Tip
```
Title: [Tip Name]
Category: Tip
Description: A quick tip to [improve/speed up/secure] your [workflow/code].
Link: [Tutorial or guide]
```

### Product Update
```
Title: [Update Name]
Category: Update
Description: We've improved [X] by [Y]. See [Z% improvement/new benefits].
Link: [Blog post or docs]
```

---

## 🎨 Content Calendar Template

```markdown
# Monthly Newsletter Plan

## Week 1 (Apr 1)
- Feature: AI Code Generation (40% faster)
- Update: Template Library
- Resource: API Docs
- Tip: Code Quality

## Week 2 (Apr 8)
- Feature: Collaboration Tools
- Guide: Best Practices
- Beta: Real-time Editing
- Tip: Performance Tuning

## Week 3 (Apr 15)
- Story: Customer Spotlight
- Feature: Mobile Support
- Tip: Security Best Practices
- Resource: Video Tutorials

## Week 4 (Apr 22)
- Announcement: Roadmap Update
- Feature: Upcoming (tease)
- Stats: Monthly Metrics
- Tip: Team Workflows
```

---

## ⚡ API Cheat Sheet

```bash
# Create issue
curl -X POST http://localhost:5000/api/admin/newsletter/issues \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Weekly Update","subject":"..."}'

# Add article
curl -X POST http://localhost:5000/api/admin/newsletter/articles \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "issueId":"...",
    "title":"Feature",
    "description":"...",
    "category":"Feature",
    "link":"https://..."
  }'

# Send newsletter
curl -X POST http://localhost:5000/api/admin/newsletter/issues/:id/send \
  -H "Authorization: Bearer TOKEN"

# List issues
curl http://localhost:5000/api/admin/newsletter/issues \
  -H "Authorization: Bearer TOKEN"
```

---

## 📞 Support Resources

- Admin Newsletter: `/admin/newsletter`
- Newsletter Guide: `server/NEWSLETTER_EXAMPLES.md`
- API Docs: `server/routes/adminNewsletter.js`
- Examples: `server/scripts/seedNewsletters.js`
- Database: `server/config/init.sql`

---

**💫 Tip:** Start with the seeded examples, then customize them for your brand!
