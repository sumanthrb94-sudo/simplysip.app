#!/usr/bin/env node

/**
 * Firebase Admin Setup Script
 * Run this script to add admin users to your Firebase Realtime Database
 *
 * Usage:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Run: node scripts/setup-admin.js
 */

import admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';

// Load environment variables
const envContent = readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  const value = rest.join('=');
  if (key && value) {
    envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
  }
});

// Attempt to initialize Admin SDK (preferred for setup)
let adminAuth;
let adminDb;
let adminFirestore;
try {
  const serviceAccountJson = envVars.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: envVars.VITE_FIREBASE_DATABASE_URL || `https://${envVars.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`,
    });
    adminAuth = admin.auth();
    adminDb = admin.database();
    adminFirestore = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized.');
  }
} catch (err) {
  console.warn('⚠️  Firebase Admin SDK initialization failed. Falling back to client SDK.');
  console.warn('   Reason:', err.message);
}

// Firebase configuration (for client SDK fallback)
const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  databaseURL: envVars.VITE_FIREBASE_DATABASE_URL || `https://${envVars.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const firestore = getFirestore(app);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupAdmin() {
  try {
    console.log('🔧 SIMPLYSIP Admin Setup');
    console.log('========================\n');

    const adminEmail = (await askQuestion('Enter admin email: ')).trim();
    if (!adminEmail) {
      throw new Error('Email is required');
    }

    let uid;
    if (adminAuth) {
      console.log('\n🔐 Looking up admin user via Admin SDK...');
      const userRecord = await adminAuth.getUserByEmail(adminEmail);
      uid = userRecord.uid;
    } else {
      const adminPassword = await askQuestion('Enter admin password: ');
      console.log('\n🔐 Signing in admin user...');
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      uid = userCredential.user.uid;
    }

    console.log('📝 Adding admin privileges...');
    const payload = { role: 'admin', email: adminEmail, createdAt: Date.now() };
    if (adminDb) {
      await adminDb.ref(`admins/${uid}`).set(payload);
    } else {
      await set(ref(db, `admins/${uid}`), payload);
    }

    if (adminFirestore) {
      await adminFirestore.doc(`admins/${uid}`).set(payload);
    } else {
      await setDoc(doc(firestore, 'admins', uid), payload);
    }

    if (adminAuth) {
      await adminAuth.setCustomUserClaims(uid, { admin: true });
    }

    console.log('✅ Admin setup complete!');
    console.log(`📧 Admin Email: ${adminEmail}`);
    console.log(`🆔 Admin UID: ${uid}`);
    console.log('\n⚠️  Important: Keep this UID secure for admin access.');

  } catch (error) {
    console.error('❌ Error setting up admin:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setupAdmin();