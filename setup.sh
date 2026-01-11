#!/bin/bash

echo "🏕️  KindleTribe MVP Setup Script"
echo "================================"
echo ""

# Check for required tools
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Please install Node.js 18+ first."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "⚠️  PostgreSQL CLI not found. Make sure PostgreSQL is installed and running."; }

echo "✅ Prerequisites check passed"
echo ""

# Backend setup
echo "📦 Setting up backend..."
cd backend

# Install dependencies
echo "Installing backend dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating backend .env file..."
    cp .env.example .env
    echo "⚠️  Please edit backend/.env with your database credentials before continuing!"
    echo "   Press Enter when ready..."
    read
fi

# Generate Prisma client
echo "Generating Prisma client..."
npm run db:generate

echo "✅ Backend setup complete"
echo ""

# Frontend setup
echo "📦 Setting up frontend..."
cd ../frontend

# Install dependencies
echo "Installing frontend dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating frontend .env file..."
    cp .env.example .env
fi

echo "✅ Frontend setup complete"
echo ""

# Final instructions
cd ..

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure PostgreSQL is running"
echo "2. Create database: createdb kindletribe"
echo "3. Run migrations: cd backend && npm run db:migrate"
echo "4. Seed database: npm run db:seed"
echo "5. Start backend: npm run dev (in backend directory)"
echo "6. Start frontend: npm run dev (in frontend directory)"
echo ""
echo "📝 Test credentials:"
echo "   Email: admin@kindletribe.com"
echo "   Password: password123"
echo ""
echo "Happy camping! 🏕️"
