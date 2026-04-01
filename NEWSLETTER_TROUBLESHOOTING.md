# 🛠️ Newsletter System - Troubleshooting Guide

## ⚠️ Common Issues & Solutions

### Issue 1: "404 - Not Found" when accessing `/admin/newsletter`

**Cause:** Admin newsletter route not mounted or page not imported

**Check:**
```bash
# Verify ADMIN_EMAILS is set
echo $ADMIN_EMAILS

# Should output: your-email@example.com
```

**Fix:**
```bash
# 1. Set admin email (add to .env)
ADMIN_EMAILS=your-email@example.com

# 2. Restart server
npm run dev  # or npm start
```

---

### Issue 2: "403 - Forbidden" when accessing admin panel

**Cause:** User not logged in or email not in ADMIN_EMAILS

**Check:**
```bash
# 1. Are you logged in? 
# Go to /dashboard - if redirected to /login, you're not logged in

# 2. Check your email
# Profile settings → your email address

# 3. Verify ADMIN_EMAILS env var
grep ADMIN_EMAILS .env
```

**Fix:**
```bash
# Add your email to ADMIN_EMAILS (comma-separated for multiple)
ADMIN_EMAILS=user1@example.com,user2@example.com

# Restart server
npm run dev
```

---

### Issue 3: "Failed to load newsletter issues" in admin panel

**Cause:** Backend not responding or database tables missing

**Check:**

```bash
# 1. Is server running?
curl http://localhost:5000/api/health
# Should return: {"status":"ok","message":"Genesis.ai API is healthy"}

# 2. Check database tables exist
psql -d genesis_ai -c "\dt newsletter_*"
# Should show: newsletter_issues and newsletter_articles tables

# 3. Check API endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/admin/newsletter/issues
# Check response (200 = success, 500 = server error)
```

**Fix:**

```bash
# Option A: Restart server (may auto-migrate tables)
npm run dev

# Option B: Manually run database migration
psql -d genesis_ai -f server/config/init.sql

# Option C: Check server logs
# Look for errors in terminal where server is running
```

---

### Issue 4: Articles don't display in admin panel

**Cause:** Articles table missing or not linked properly

**Check:**
```bash
# Verify tables exist and have data
psql -d genesis_ai -c "SELECT COUNT(*) FROM newsletter_articles;"
psql -d genesis_ai -c "SELECT * FROM newsletter_issues LIMIT 1;"
```

**Fix:**
```bash
# Re-run database init
psql -d genesis_ai -f server/config/init.sql

# Re-seed example data
node server/scripts/seedNewsletters.js
```

---

### Issue 5: Newsletter send fails silently

**Cause:** SMTP not configured or no active subscribers

**Check:**
```bash
# 1. Verify SMTP config
echo $SMTP_HOST
echo $SMTP_PORT
echo $SMTP_USER
echo $SMTP_FROM

# 2. Check if subscribers exist
psql -d genesis_ai -c "SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = TRUE;"

# 3. Check server logs for email errors
# Look for: "Newsletter send failed" or "Email service not configured"
```

**Fix:**
```bash
# 1. Add SMTP config to .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Genesis.ai <noreply@genesis.ai>

# 2. Get test subscribers
# Go to frontend → Footer → subscribe yourself to newsletter

# 3. Restart server
npm run dev

# 4. Try sending again
```

---

### Issue 6: "Cannot POST /api/admin/newsletter/articles"

**Cause:** Article creation endpoint issue

**Check:**
```bash
# Verify request format
curl -X POST http://localhost:5000/api/admin/newsletter/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "issueId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Test Article",
    "description": "Test description",
    "category": "Feature"
  }'
```

**Fix:**
```bash
# Check error response details
# API should return 201 on success or error details

# Verify all required fields:
# - issueId (must exist in newsletter_issues)
# - title (required, string)
# - description (required, string)
# - category (optional, string)
# - link (optional, URL)
```

---

### Issue 7: Tailwind CSS warnings in console

**Symptom:** "bg-gradient-to-br can be written as bg-linear-to-br"

**This is just a warning.** The newsletter still works. To fix:

```bash
# In client/src/pages/AdminNewsletter.jsx:
# Line 216: Change bg-gradient-to-br to bg-linear-to-br
# Line 557: Change flex-shrink-0 to shrink-0
```

---

## 🔧 Step-by-Step Debugging Process

### Step 1: Check Environment
```bash
# In terminal where server is running:
echo "ADMIN_EMAILS=$ADMIN_EMAILS"
echo "SMTP_HOST=$SMTP_HOST"
echo "DATABASE_URL=$DATABASE_URL"
```

### Step 2: Verify Database
```bash
# Connect to database
psql -d genesis_ai

# Inside psql:
\dt newsletter_*          # List newsletter tables
SELECT COUNT(*) FROM newsletter_issues;
SELECT COUNT(*) FROM newsletter_articles;
SELECT COUNT(*) FROM newsletter_subscribers;
\q                        # Exit
```

### Step 3: Test API Endpoints
```bash
# Get auth token (login first, check localStorage)
TOKEN="your-jwt-token-from-browser"

# List issues
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/admin/newsletter/issues

# Should return:
# {"issues":[],"pagination":{...}}
```

### Step 4: Check Browser Console
```
Press F12 in browser → Console tab
Look for:
- Network errors (red X)
- JavaScript errors
- CORS issues
```

### Step 5: Check Server Logs
```
Look in terminal where server is running for:
- "Error listing newsletter issues: ..."
- "POST /api/admin/newsletter/issues 500"
- Database connection errors
```

---

## 🚨 Error Messages & Meanings

| Error | Cause | Solution |
|-------|-------|----------|
| `403 Forbidden` | Not admin user | Add email to ADMIN_EMAILS |
| `404 Not Found` | Route not mounted or page missing | Restart server, check imports |
| `500 Internal Error` | Database/code error | Check server logs |
| `Failed to load issues` | API not responding | Check `/api/health` endpoint |
| `Newsletter not sent` | SMTP config or no subscribers | Configure SMTP, add subscribers |
| `Cannot create article` | Invalid issueId | Verify issue exists first |

---

## 🆘 Still Not Working?

### Collect Information Needed:

1. **Error message from browser console** (F12 → Console)
2. **Error in server terminal**
3. **Output of environment check:**
   ```bash
   echo "Admin Email: $ADMIN_EMAILS"
   echo "Database: $DATABASE_URL"
   echo "SMTP: $SMTP_HOST:$SMTP_PORT"
   ```
4. **Database table check:**
   ```bash
   psql -d genesis_ai -c "\dt newsletter_*"
   ```
5. **Which action fails?**
   - Viewing /admin/newsletter page?
   - Creating a newsletter?
   - Adding articles?
   - Sending newsletter?

---

## 🔄 Complete Reset Procedure

If nothing works, do a complete reset:

```bash
# 1. Stop server
Ctrl+C

# 2. Reset database tables (caution: deletes newsletter data)
psql -d genesis_ai -c "DROP TABLE IF EXISTS newsletter_articles CASCADE;"
psql -d genesis_ai -c "DROP TABLE IF EXISTS newsletter_issues CASCADE;"
psql -d genesis_ai -c "DROP TABLE IF EXISTS newsletter_subscribers CASCADE;"

# 3. Reinitialize schema
psql -d genesis_ai -f server/config/init.sql

# 4. Verify tables created
psql -d genesis_ai -c "\dt newsletter_*"

# 5. Seed examples
node server/scripts/seedNewsletters.js

# 6. Restart server
npm run dev

# 7. Test in browser
# Visit http://localhost:5173/admin/newsletter
```

---

## 📋 Pre-Flight Checklist

Before using newsletter system:

- [ ] ADMIN_EMAILS is set
- [ ] Logged in as admin user
- [ ] Server running (`npm run dev`)
- [ ] Database connected (`psql -d genesis_ai` works)
- [ ] Newsletter tables exist (`\dt newsletter_*`)
- [ ] Example data seeded (optional: `node server/scripts/seedNewsletters.js`)
- [ ] Can access `/admin/newsletter` page without 403/404

---

## 📞 Quick Help Commands

```bash
# Restart everything
npm run dev

# Check server health
curl http://localhost:5000/api/health

# View newsletter issues
curl http://localhost:5000/api/admin/newsletter/issues \
  -H "Authorization: Bearer YOUR_TOKEN"

# Seed example data
node server/scripts/seedNewsletters.js

# Check database
psql -d genesis_ai -c "SELECT COUNT(*) FROM newsletter_issues;"

# View server logs (in running terminal)
# Look for any errors printed
```

---

## 💡 Pro Tips

1. **Enable detailed logging:**
   ```bash
   export DEBUG=*
   npm run dev
   ```

2. **Test newsletter without external SMTP:**
   - Use `mailhog` or `ethereal` (fake SMTP)
   - Set: `SMTP_HOST=localhost SMTP_PORT=1025`

3. **Monitor database changes:**
   ```bash
   watch -n 1 'psql -d genesis_ai -c "SELECT COUNT(*) as issues FROM newsletter_issues;"'
   ```

4. **Check authentication in browser:**
   ```javascript
   // In browser console:
   localStorage.getItem('token')
   localStorage.getItem('user')
   ```

---

**Need more help?** Check:
- [NEWSLETTER_DOCS_INDEX.md](../NEWSLETTER_DOCS_INDEX.md)
- [server/NEWSLETTER_EXAMPLES.md](../server/NEWSLETTER_EXAMPLES.md)
- Server logs in running terminal
