# Newsletter API Testing Guide

## ✅ Test Each Component

### 1️⃣ Test Server Health

```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Genesis.ai API is healthy"
}
```

**If you see:** Connection refused → Server not running (`npm run dev`)

---

### 2️⃣ Test Admin Authentication

```bash
# You need an auth token from logging in first
TOKEN="YOUR_JWT_TOKEN_FROM_BROWSER_LOCALSTORAGE"

# Try to list newsletter issues
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/admin/newsletter/issues
```

**Expected Response (200 OK):**
```json
{
  "issues": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "pageSize": 10,
    "totalPages": 0
  }
}
```

**If you see:** 
- `403 Forbidden` → Not admin (check ADMIN_EMAILS)
- `401 Unauthorized` → Bad token (logout & login again)
- `404 Not Found` → Route not mounted (restart server)
- `500 Internal Error` → Database issue (check database)

---

### 3️⃣ Test Creating a Newsletter

```bash
TOKEN="YOUR_JWT_TOKEN"

curl -X POST http://localhost:5000/api/admin/newsletter/issues \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Newsletter",
    "subject": "Test Subject"
  }'
```

**Expected Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Test Newsletter",
  "subject": "Test Subject",
  "status": "draft",
  "created_at": "2026-04-01T10:30:00Z",
  "updated_at": "2026-04-01T10:30:00Z"
}
```

**If you see 400 Bad Request:** Missing required fields (title)

---

### 4️⃣ Test Getting Issue Details

```bash
TOKEN="YOUR_JWT_TOKEN"
ISSUE_ID="550e8400-e29b-41d4-a716-446655440000"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/admin/newsletter/issues/$ISSUE_ID
```

**Expected Response (200 OK):**
```json
{
  "issue": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Test Newsletter",
    "subject": "Test Subject",
    "status": "draft",
    "sent_at": null,
    "subscriber_count": null,
    "created_at": "2026-04-01T10:30:00Z",
    "updated_at": "2026-04-01T10:30:00Z"
  },
  "articles": [],
  "subscriberCount": 0
}
```

---

### 5️⃣ Test Creating an Article

```bash
TOKEN="YOUR_JWT_TOKEN"
ISSUE_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X POST http://localhost:5000/api/admin/newsletter/articles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "issueId": "'$ISSUE_ID'",
    "title": "Test Article",
    "description": "This is a test article",
    "category": "Feature",
    "link": "https://example.com"
  }'
```

**Expected Response (201 Created):**
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "issue_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Test Article",
  "description": "This is a test article",
  "content": null,
  "category": "Feature",
  "link": "https://example.com",
  "order_index": 0,
  "created_at": "2026-04-01T10:35:00Z",
  "updated_at": "2026-04-01T10:35:00Z"
}
```

---

### 6️⃣ Test Database Tables

```bash
# Check if tables exist
psql -c "\dt newsletter_*"

# Expected output:
# newsletter_articles  | table
# newsletter_issues    | table
# newsletter_subscribers | table
```

```bash
# Count entries
psql -c "SELECT COUNT(*) as issues FROM newsletter_issues;"
psql -c "SELECT COUNT(*) as articles FROM newsletter_articles;"
psql -c "SELECT COUNT(*) as subscribers FROM newsletter_subscribers WHERE is_active = TRUE;"
```

---

## 🔧 Quick Test Scripts

### Test Everything in One Command

```bash
#!/bin/bash

echo "Testing Newsletter System..."
echo ""

# 1. Server health
echo "1️⃣  Server Status:"
curl -s http://localhost:5000/api/health | jq . || echo "Failed"

# 2. Admin issues endpoint (requires auth)
echo ""
echo "2️⃣  Admin Issues (requires token):"
echo "   Paste your JWT token and run:"
echo "   curl -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:5000/api/admin/newsletter/issues | jq ."

# 3. Database
echo ""
echo "3️⃣  Database Tables:"
psql -c "\dt newsletter_*" || echo "Not connected"

# 4. Environment
echo ""
echo "4️⃣  Environment:"
echo "   ADMIN_EMAILS: $ADMIN_EMAILS"
echo "   SMTP_HOST: $SMTP_HOST"
```

---

## 📊 Successful Response Examples

### List Issues (Empty)
```json
{
  "issues": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "pageSize": 10,
    "totalPages": 0
  }
}
```

### List Issues (With Data)
```json
{
  "issues": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Weekly Update - April 1",
      "subject": "New Features Released",
      "status": "draft",
      "scheduled_at": null,
      "sent_at": null,
      "subscriber_count": 0,
      "created_at": "2026-04-01T10:30:00Z",
      "updated_at": "2026-04-01T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

### Issue with Articles
```json
{
  "issue": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Weekly Update - April 1",
    "subject": "New Features Released",
    "status": "draft",
    "sent_at": null,
    "subscriber_count": null,
    "created_at": "2026-04-01T10:30:00Z",
    "updated_at": "2026-04-01T10:30:00Z"
  },
  "articles": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "issue_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "New Feature Released",
      "description": "We've released a new feature",
      "content": null,
      "category": "Feature",
      "link": "https://example.com",
      "order_index": 0,
      "created_at": "2026-04-01T10:35:00Z",
      "updated_at": "2026-04-01T10:35:00Z"
    }
  ],
  "subscriberCount": 0
}
```

---

## 🚨 Common Error Responses

### 403 Forbidden
```json
{
  "error": "Admin access required."
}
```
**Fix:** Add your email to ADMIN_EMAILS

---

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```
**Fix:** Pass valid JWT token in Authorization header

---

### 404 Not Found
```json
{
  "error": "Newsletter issue not found"
}
```
**Fix:** Check issue ID exists

---

### 500 Internal Server Error
```json
{
  "error": "Failed to list newsletter issues"
}
```
**Fix:** Check database connection, check server logs

---

## 📝 How to Get Your JWT Token

1. **Login to your account**
2. **Open browser DevTools** (F12)
3. **Go to Console tab**
4. **Paste this:**
   ```javascript
   localStorage.getItem('token')
   ```
5. **Copy the token** (everything between quotes)
6. **Use in API calls:**
   ```bash
   curl -H "Authorization: Bearer YOUR_COPIED_TOKEN" \
     http://localhost:5000/api/admin/newsletter/issues
   ```

---

## 🧪 Postman Collection

Import this into Postman for easier testing:

```json
{
  "info": {
    "name": "Newsletter API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "List Issues",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/admin/newsletter/issues?page=1&pageSize=10",
          "host": ["{{baseUrl}}"],
          "path": ["api", "admin", "newsletter", "issues"],
          "query": [
            { "key": "page", "value": "1" },
            { "key": "pageSize", "value": "10" }
          ]
        }
      }
    },
    {
      "name": "Create Issue",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"title\":\"Test Newsletter\",\"subject\":\"Test Subject\"}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/admin/newsletter/issues",
          "host": ["{{baseUrl}}"],
          "path": ["api", "admin", "newsletter", "issues"]
        }
      }
    }
  ]
}
```

---

## ✅ Full Test Checklist

- [ ] Server responds to `/api/health`
- [ ] You can get JWT token from browser localStorage
- [ ] Admin endpoint returns 200 (or expected error)
- [ ] Can create a newsletter issue
- [ ] Can retrieve issue details
- [ ] Can add articles to issue
- [ ] Database tables exist
- [ ] ADMIN_EMAILS is configured

If any step fails, check [NEWSLETTER_TROUBLESHOOTING.md](./NEWSLETTER_TROUBLESHOOTING.md)
