import admin from 'firebase-admin';
import 'dotenv/config';

const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!key) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not set in .env');
  process.exit(1);
}

const serviceAccount = JSON.parse(key);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const BULLET = '\u2022';

const canonicalMenu = [
  // ── Signature Blends (Layered Flavours) ──
  { category: 'Signature Blends', name: 'Hulk Greens', desc: `Green Apple ${BULLET} Cucumber ${BULLET} Ginger ${BULLET} Spinach ${BULLET} Lime`, image: '/images/hulk-greens.png', mrp: 159, offerPrice: 119, price: 119 },
  { category: 'Signature Blends', name: 'Melon Booster', desc: `Watermelon ${BULLET} Cucumber ${BULLET} Mint`, image: '/images/melon-booster.png', mrp: 119, offerPrice: 89, price: 89 },
  { category: 'Signature Blends', name: 'ABC', desc: `Apple ${BULLET} Beetroot ${BULLET} Carrot`, image: '/images/abc.png', mrp: 149, offerPrice: 109, price: 109 },
  { category: 'Signature Blends', name: 'A-Star', desc: `Apple ${BULLET} Pomegranate`, image: '/images/a-star.png', mrp: 159, offerPrice: 119, price: 119 },
  { category: 'Signature Blends', name: 'AMG', desc: `Apple ${BULLET} Mint ${BULLET} Ginger`, image: '/images/amg.png', mrp: 159, offerPrice: 119, price: 119 },
  { category: 'Signature Blends', name: 'Ganga Jamuna', desc: `Orange ${BULLET} Mosambi`, image: '/images/ganga-jamuna.png', mrp: 149, offerPrice: 109, price: 109 },
  // ── Single Fruit Series (Pure Expression) ──
  { category: 'Single Fruit Series', name: 'Coco Fresh', desc: 'Tender Coconut Water', image: '/images/coco-fresh.png', mrp: 159, offerPrice: 119, price: 119 },
  { category: 'Single Fruit Series', name: 'Sunshine Sip', desc: 'Mosambi', image: '/images/sunshine-sip.png', mrp: 149, offerPrice: 109, price: 109 },
  { category: 'Single Fruit Series', name: 'Golden Sunrise', desc: 'Orange', image: '/images/golden-sunrise.png', mrp: 159, offerPrice: 119, price: 119 },
  { category: 'Single Fruit Series', name: 'Orchard Gold', desc: 'Apple', image: '/images/orchard-gold.png', mrp: 179, offerPrice: 129, price: 129 },
  { category: 'Single Fruit Series', name: 'Tropical Bliss', desc: 'Pineapple', image: '/images/tropical-bliss.png', mrp: 159, offerPrice: 119, price: 119 },
  { category: 'Single Fruit Series', name: 'Velvet Vine', desc: 'Pomegranate', image: '/images/velvet-vine.png', mrp: 199, offerPrice: 149, price: 149 },
  { category: 'Single Fruit Series', name: 'Purple Crush', desc: 'Black Grapes', image: '/images/purple-crush.png', mrp: 179, offerPrice: 129, price: 129 },
  { category: 'Single Fruit Series', name: 'Verjus', desc: 'Green Grapes', image: '/images/verjus.png', mrp: 179, offerPrice: 129, price: 129 },
  { category: 'Single Fruit Series', name: 'Garden Joy', desc: 'Carrot', image: '/images/garden-joy.png', mrp: 119, offerPrice: 89, price: 89 },
];

async function reseed() {
  const menuRef = db.collection('menu');

  console.log('🗑️  Clearing existing menu items from Firestore...');
  const snapshot = await menuRef.get();
  if (snapshot.docs.length > 0) {
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`✅ Deleted ${snapshot.docs.length} existing items.`);
  } else {
    console.log('   (no existing items to delete)');
  }

  console.log('🌱 Seeding canonical menu...');
  const batch2 = db.batch();
  canonicalMenu.forEach(item => {
    const ref = menuRef.doc();
    batch2.set(ref, { ...item, createdAt: Date.now() });
  });
  await batch2.commit();

  console.log(`✅ Seeded ${canonicalMenu.length} items successfully!\n`);
  console.log('📋 Items seeded:');
  canonicalMenu.forEach((item, i) =>
    console.log(`  ${i + 1}. ${item.name} (${item.category}) — ₹${item.offerPrice}`)
  );

  process.exit(0);
}

reseed().catch(err => {
  console.error('❌ Reseed failed:', err.message || err);
  process.exit(1);
});
