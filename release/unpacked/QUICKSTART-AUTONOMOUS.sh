#!/bin/bash

###############################################################################
# AUTONOMOUS UNICORN - QUICK START
# Copy and paste these commands to get started in 2 minutes!
###############################################################################

echo "🦄 AUTONOMOUS UNICORN - QUICK START"
echo "===================================="
echo ""

# Step 1: Navigate to UNICORN_FINAL
cd UNICORN_FINAL || exit

# Step 2: Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
  echo "📝 Creating .env file..."
  cat > .env << 'EOF'
PORT=3000
NODE_ENV=production
JWT_SECRET=unicorn-jwt-secret-2026
ADMIN_SECRET=UnicornAutoSecret2026!
ADMIN_MASTER_PASSWORD=UnicornAdmin2026!
ADMIN_2FA_CODE=123456

DEPLOYMENT_INTERVAL=300
INNOVATION_INTERVAL=60
REVENUE_INTERVAL=30
AUTO_COMMIT_ENABLED=true
AUTO_PUSH_ENABLED=false
AUTONOMY_LEVEL=10
EOF
  echo "✅ .env created with defaults"
fi

# Step 3: Install dependencies
echo ""
echo "📦 Installing dependencies (this may take a minute)..."
npm install --silent 2>/dev/null

if [ -d "client" ]; then
  echo "📦 Installing frontend dependencies..."
  cd client
  npm install --silent 2>/dev/null
  echo "🏗️  Building frontend..."
  npm run build 2>/dev/null || echo "⚠️  Frontend build skipped"
  cd ..
fi

# Step 4: Show ready message
echo ""
echo "✨ Setup complete!"
echo ""
echo "🚀 To start the autonomous Unicorn:"
echo "   bash start-autonomous-unicorn.sh"
echo ""
echo "📊 To check status:"
echo "   curl http://localhost:3000/api/autonomous/platform/status"
echo ""
echo "🛑 To stop the system:"
echo "   bash stop-autonomous-unicorn.sh"
echo ""
echo "📖 For full documentation:"
echo "   cat AUTONOMOUS-UNICORN.md"
echo ""
