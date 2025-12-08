import admin from 'firebase-admin';
import dotenv from 'dotenv';
import {DataBaseCollection} from '../src/datContainers/DataBaseIdentifiers'
dotenv.config();

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Replace this with the email of the user you want to make admin
const USER_EMAIL = 'admin@gmail.com';

async function setUserAsAdmin() {
  try {
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(USER_EMAIL);
    console.log('Found user:', userRecord.uid, userRecord.email);

    // Update or create user document in Firestore
    await db.collection(DataBaseCollection.USER).doc(userRecord.uid).set({
      email: userRecord.email,
      uid: userRecord.uid,
      role: 'admin',
      isAdmin: true,
      displayName: userRecord.displayName || userRecord.email?.split('@')[0] || 'Admin User',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('✅ Successfully set user as admin!');
    console.log('User ID:', userRecord.uid);
    console.log('Email:', userRecord.email);
    console.log('Role: admin');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setUserAsAdmin();
