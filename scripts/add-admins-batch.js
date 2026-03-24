#!/usr/bin/env node

/**
 * Batch Admin Setup Script
 * Adds one or more users as admins by email (non-interactive).
 *
 * Usage:
 *   node scripts/add-admins-batch.js email1@example.com email2@example.com
 *   npm run add-admins -- email1@example.com email2@example.com
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY in .env
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Load .env manually
const envVars = {};
try {
  readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    const value = rest.join('=');
    if (key && value) envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
  });
} catch {
  console.error('❌ Could not read .env file. Make sure you run this from the project root.');
  process.exit(1);
}

const emails = process.argv.slice(2);
if (emails.length === 0) {
  console.error('❌ No emails provided.\n   Usage: node scripts/add-admins-batch.js email1@example.com email2@example.com');
  process.exit(1);
}

const serviceAccountJson = envVars.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not found in .env');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch {
  console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: envVars.VITE_FIREBASE_DATABASE_URL || `https://${envVars.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`,
});

const adminAuth = admin.auth();
const adminFirestore = admin.firestore();
const adminDb = admin.database();

async function addAdmin(email) {
  console.log(`\n📧 Processing: ${email}`);

  let uid;
  try {
    const userRecord = await adminAuth.getUserByEmail(email);
    uid = userRecord.uid;
    console.log(`   ✅ Found user UID: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`   ❌ User not found in Firebase Auth. They must sign in at least once before being granted admin.`);
    } else {
      console.error(`   ❌ Error looking up user: ${err.message}`);
    }
    return false;
  }

  const payload = { role: 'admin', email, createdAt: Date.now() };

  try {
    await adminFirestore.doc(`admins/${uid}`).set(payload);
    console.log(`   ✅ Added to Firestore admins/${uid}`);
  } catch (err) {
    console.error(`   ❌ Firestore write failed: ${err.message}`);
    return false;
  }

  try {
    await adminDb.ref(`admins/${uid}`).set(payload);
    console.log(`   ✅ Added to Realtime Database admins/${uid}`);
  } catch (err) {
    console.warn(`   ⚠️  Realtime Database write failed (non-fatal): ${err.message}`);
  }

  try {
    await adminAuth.setCustomUserClaims(uid, { admin: true });
    console.log(`   ✅ Custom claim { admin: true } set`);
  } catch (err) {
    console.warn(`   ⚠️  Custom claims update failed (non-fatal): ${err.message}`);
  }

  return true;
}

async function main() {
  console.log('🔧 SimplySip Batch Admin Setup');
  console.log('================================');

  const results = [];
  for (const email of emails) {
    const ok = await addAdmin(email);
    results.push({ email, ok });
  }

  console.log('\n📋 Summary');
  console.log('----------');
  for (const { email, ok } of results) {
    console.log(`  ${ok ? '✅' : '❌'} ${email}`);
  }

  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} email(s) failed. Ensure those users have signed in at least once.`);
    process.exit(1);
  } else {
    console.log('\n✅ All admins added successfully!');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
