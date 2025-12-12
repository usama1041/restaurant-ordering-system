# Restaurant AI Phone Ordering System

A complete multi-tenant restaurant ordering system with AI phone integration using Vapi.ai.

## Features

- 🤖 AI Phone Ordering via Vapi.ai
- 🏪 Multi-tenant restaurant management
- 📊 Sales analytics and reporting
- 📱 Order management system
- 🍕 Menu management
- 👨‍💼 Super admin dashboard

## Tech Stack

- Next.js 14
- MongoDB
- Tailwind CSS
- Vapi.ai (AI Phone Agent)

## Getting Started

### Deploy to Railway

1. Click "Deploy on Railway" or import this repository
2. Add MongoDB database
3. Set environment variables (see below)
4. Deploy!

### Environment Variables

MONGO_URL=<your_mongodb_connection_string> NEXT_PUBLIC_BASE_URL=https://your-domain.com VAPI_PRIVATE_KEY=your_vapi_key VAPI_PHONE_NUMBER=+12075075278 VAPI_PHONE_NUMBER_ID=your_phone_id


### Seed Database

After deployment, run:
```bash
node scripts/seed-data.js
