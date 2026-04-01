#!/bin/bash

# Quick Newsletter Diagnostic
# Run this to identify Newsletter system issues

echo "🔍 Genesis.ai Newsletter Quick Diagnostic"
echo "=========================================="
echo ""

# Check 1: Admin configured
echo "📧 Admin Email Setup:"
if [ -z "$ADMIN_EMAILS" ]; then
  echo "  ❌ ADMIN_EMAILS not set"
  echo "     Add to .env: ADMIN_EMAILS=your-email@example.com"
else
  echo "  ✅ ADMIN_EMAILS=$ADMIN_EMAILS"
fi
echo ""

# Check 2: Database
echo "🗄️  Database Status:"
DB_CONNECTION=$(psql -c "SELECT 1" 2>&1)
if [[ $DB_CONNECTION == *"refused"* ]] || [[ $DB_CONNECTION == *"not found"* ]]; then
  echo "  ❌ Cannot connect to database"
  echo "     Make sure PostgreSQL is running"
else
  TABLES=$(psql -c "\dt newsletter_*" -t 2>&1 | grep -c newsletter)
  if [ $TABLES -ge 2 ]; then
    echo "  ✅ Newsletter tables exist ($TABLES found)"
  else
    echo "  ❌ Newsletter tables missing"
    echo "     Run: psql -f server/config/init.sql"
  fi
fi
echo ""

# Check 3: Server
echo "🖥️  Server Status:"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
  echo "  ✅ Server running on port 5000"
else
  echo "  ❌ Server not responding"
  echo "     Run: npm run dev"
fi
echo ""

# Check 4: SMTP
echo "📧 Email Config:"
if [ -z "$SMTP_HOST" ]; then
  echo "  ⚠️  SMTP_HOST not set (required for sending)"
  echo "     Add to .env if you want to send newsletters"
else
  echo "  ✅ SMTP configured ($SMTP_HOST)"
fi
echo ""

# Summary
echo "=========================================="
echo "Quick Fix Checklist:"
echo ""
echo "1. Check .env contains:"
echo "   - ADMIN_EMAILS=your-email@example.com"
echo "   - DATABASE_URL=postgresql://..."
echo ""
echo "2. Start server:"
echo "   npm run dev"
echo ""
echo "3. Test in browser:"
echo "   - Login to /login or /dashboard"
echo "   - Visit /admin/newsletter"
echo "   - Check browser F12 console for errors"
echo ""
echo "For detailed troubleshooting, see:"
echo "   NEWSLETTER_TROUBLESHOOTING.md"
echo ""
