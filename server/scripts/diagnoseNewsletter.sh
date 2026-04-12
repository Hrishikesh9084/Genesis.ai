#!/bin/bash

# Newsletter System Diagnostic Checklist

echo "🔍 Genesis.ai Newsletter System - Diagnostic Check"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Environment variables
echo "${YELLOW}[1/6]${NC} Checking environment variables..."
if [ -z "$ADMIN_EMAILS" ]; then
  echo "${RED}✗${NC} ADMIN_EMAILS not set"
  echo "   Set: export ADMIN_EMAILS=your-email@example.com"
else
  echo "${GREEN}✓${NC} ADMIN_EMAILS = $ADMIN_EMAILS"
fi

# Check 2: Database connection
echo ""
echo "${YELLOW}[2/6]${NC} Checking database tables..."
psql -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('newsletter_issues', 'newsletter_articles');" 2>/dev/null || echo "${RED}✗${NC} Cannot connect to database"

# Check 3: SMTP configuration
echo ""
echo "${YELLOW}[3/6]${NC} Checking SMTP configuration..."
if [ -z "$SMTP_HOST" ]; then
  echo "${YELLOW}⚠${NC} SMTP_HOST not set (optional for viewing, required for sending)"
else
  echo "${GREEN}✓${NC} SMTP_HOST = $SMTP_HOST"
fi

# Check 4: Server running
echo ""
echo "${YELLOW}[4/6]${NC} Checking if server is running..."
if curl -s http://localhost:5000/api/health || curl -s https://genesis-ai-tu97.vercel.app/api/health > /dev/null; then
  echo "${GREEN}✓${NC} Server is running on port 5000"
else
  echo "${RED}✗${NC} Server not responding on port 5000"
  echo "   Start with: npm start"
fi

# Check 5: Admin newsletter route
echo ""
echo "${YELLOW}[5/6]${NC} Checking admin newsletter API..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/admin/newsletter/issues)
if [ "$RESPONSE" = "403" ]; then
  echo "${YELLOW}⚠${NC} API returned 403 (check authentication)"
elif [ "$RESPONSE" = "200" ]; then
  echo "${GREEN}✓${NC} API endpoint accessible ($RESPONSE)"
else
  echo "${RED}✗${NC} API error: HTTP $RESPONSE"
fi

# Check 6: Database schema
echo ""
echo "${YELLOW}[6/6]${NC} Checking database schema..."
psql -c "\dt newsletter_*" 2>/dev/null || echo "${RED}✗${NC} Cannot verify tables"

echo ""
echo "=================================================="
echo ""
echo "📋 Diagnostic Summary:"
echo "  1. ADMIN_EMAILS configured?"
echo "  2. Database tables exist? (newsletter_issues, newsletter_articles)"
echo "  3. Server running? (npm start)"
echo "  4. Backend route mounted? (/api/admin/newsletter)"
echo "  5. Authentication valid?"
echo ""
echo "💡 Next steps:"
echo "  - Check browser console for errors (press F12)"
echo "  - Check server terminal for error logs"
echo "  - Verify you're logged in as admin user"
echo ""
