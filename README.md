# SIMPLYSIP - Cold-Pressed Juice Delivery

A modern, responsive juice delivery application built with React, TypeScript, and Firebase. Features real-time ordering, secure payments via Razorpay, and an intuitive admin dashboard.

![SIMPLYSIP](https://img.shields.io/badge/SIMPLYSIP-Juice%20Delivery-1D1C1A?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTMgN3YxMGEyIDIgMCAwIDAgMiAyaDE0YTIgMiAwIDAgMCAyLTJWOWEyIDIgMCAwIDAtMi0ySDVhMiAyIDAgMCAwLTItMnoiIGZpbGw9IiMxRDFDMUEiLz4KPHBhdGggZD0iTTggNWEyIDIgMCAwIDEgMi0yaDRhMiAyIDAgMCAxIDIgMnYySDB2LTJ6IiBmaWxsPSIjMUQxQzFBIi8+CjxwYXRoIGQ9Ik0xMiAxMnYzIiBzdHJva2U9IiMxRDFDMUEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxwYXRoIGQ9Ik05IDEydjMiIHN0cm9rZT0iIzFEMSNFQSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTTE1IDEydjMiIHN0cm9rZT0iIzFEMSNFQSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+)

## ✨ Features

- **🍹 Cold-Pressed Juices**: Signature blends and single fruit series
- **🔐 Secure Authentication**: Firebase Auth with email/password and Google sign-in
- **💳 Payment Integration**: Razorpay for secure payments
- **📱 Responsive Design**: Mobile-first design with Tailwind CSS
- **👨‍💼 Admin Dashboard**: Real-time order management
- **📍 Location Services**: Delivery area validation
- **🛒 Smart Cart**: Real-time cart updates with Firebase
- **📊 Order Tracking**: Complete order lifecycle management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project
- Razorpay account (for payments)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd SIMPLYSIP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

   Fill in your environment variables:
   ```env
   # Firebase Configuration (Required)
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
   VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

   # App Configuration (Required)
   VITE_APP_URL=https://your-app.vercel.app
   VITE_ADMIN_EMAIL=admin@yourdomain.com

   # Payment Configuration (Production)
   RAZORPAY_KEY_ID=rzp_live_your_live_key
   RAZORPAY_KEY_SECRET=your_live_secret_key
   ```

4. **Firebase Setup**
   - Create a Firebase project at https://console.firebase.google.com/
   - Enable Authentication (Email/Password, Google)
   - Enable Realtime Database
   - Copy the security rules from `.rules.json` to your Firebase Database rules

5. **Run locally**
   ```bash
   npm run dev
   ```
   VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456

   # App Configuration
   VITE_APP_URL=https://your-app.vercel.app
   VITE_ADMIN_EMAIL=admin@yourdomain.com

   # Payment (Optional - for production)
   RAZORPAY_KEY_ID=rzp_test_your_key
   RAZORPAY_KEY_SECRET=your_secret_key
   ```

4. **Firebase Setup**
   - Create a Firebase project
   - Enable Authentication (Email/Password, Google)
   - Enable Realtime Database
   - Copy the security rules from `.rules.json` to your Firebase Database rules

5. **Run locally**
   ```bash
   npm run dev
   ```

## 📦 Build & Deploy

### Local Build
```bash
npm run build
npm run preview
```

### Production Deployment to Vercel

#### 1. **Firebase Configuration**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (select Database and Hosting if needed)
firebase init

# Deploy security rules
firebase deploy --only database
```

#### 2. **Vercel Deployment**
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Or link existing project
vercel link
```

#### 3. **Environment Variables in Vercel**
Set these in your Vercel dashboard (Project Settings > Environment Variables):

**Production Environment Variables:**
```
VITE_FIREBASE_API_KEY=your_production_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_APP_URL=https://your-app.vercel.app
VITE_ADMIN_EMAIL=admin@yourdomain.com
RAZORPAY_KEY_ID=rzp_live_your_live_key
RAZORPAY_KEY_SECRET=your_live_secret_key
```

#### 4. **CDN Setup for Images (Recommended)**
For better performance, host images on a CDN:

1. **Upload images to a CDN** (Cloudinary, AWS S3, or Vercel Blob)
2. **Update image paths** in `src/data/seedMenu.ts`:
   ```typescript
   // Before
   image: "/images/hulk-greens.png"
   
   // After
   image: "https://cdn.yourdomain.com/images/hulk-greens.png"
   ```

3. **Environment variable for CDN**:
   ```
   VITE_CDN_URL=https://cdn.yourdomain.com
   ```

#### 5. **Admin Setup**
After deployment, manually add admin users to Firebase:

```javascript
// In Firebase Console > Realtime Database
// Add under /admins/
{
  "admins": {
    "ADMIN_UID_HERE": true
  }
}
```

Or use Firebase Admin SDK to add admins programmatically.

#### 6. **Domain Configuration**
- Update `VITE_APP_URL` with your production domain
- Configure custom domain in Vercel if needed
- Update Firebase authorized domains

### Deployment Checklist

- [ ] Firebase project created and configured
- [ ] Security rules deployed (`firebase deploy --only database`)
- [ ] Environment variables set in Vercel
- [ ] Razorpay keys configured for production
- [ ] Admin user added to Firebase
- [ ] Domain configured and `VITE_APP_URL` updated
- [ ] Images optimized and CDN configured (optional)
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Monitoring and analytics configured

## 🏗️ Project Structure

```
SIMPLYSIP/
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── AdminDashboard.tsx
│   │   ├── AuthModal.tsx
│   │   ├── Checkout.tsx
│   │   ├── Header.tsx
│   │   ├── Hero.tsx
│   │   ├── Menu.tsx
│   │   └── ...
│   ├── data/              # Seed data
│   ├── types.ts           # TypeScript types
│   ├── firebaseConfig.ts  # Firebase configuration
│   ├── App.tsx            # Main app component
│   └── main.tsx           # App entry point
├── api/                   # API routes (for Vercel serverless)
├── .rules.json            # Firebase security rules
├── vercel.json            # Vercel deployment config
└── package.json
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run TypeScript type checking

## 🔒 Security

- Firebase Authentication for user management
- Row-level security with Firebase Rules
- Environment variables for sensitive data
- TypeScript for type safety

## 📱 Features Overview

### User Features
- Browse cold-pressed juice menu
- Add items to cart with real-time updates
- Secure checkout with Razorpay
- Order history and tracking
- Profile management with delivery addresses

### Admin Features
- Real-time order dashboard
- Menu management
- User management
- Order status updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@simplysip.com or create an issue in this repository.

---

**Made with ❤️ for healthy living**
