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

// Firebase configuration
const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  databaseURL: `https://${envVars.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`,
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

    const adminEmail = await askQuestion('Enter admin email: ');
    const adminPassword = await askQuestion('Enter admin password: ');

    console.log('\n🔐 Signing in admin user...');
    const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    const uid = userCredential.user.uid;

    console.log('📝 Adding admin privileges...');
    await set(ref(db, `admins/${uid}`), true);
    await setDoc(doc(firestore, "admins", uid), { admin: true });

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