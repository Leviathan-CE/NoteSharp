import admin from 'firebase-admin';
import dotenv from 'dotenv';
// Use the collection name directly since we're in a script
const USER_COLLECTION = 'Users';

dotenv.config();

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Replace this with the email of the user you want to check/fix
const USER_EMAIL = 'admin@gmail.com';

async function verifyAndFixAdmin() {
  try {
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(USER_EMAIL);
    console.log('Found user:', userRecord.uid, userRecord.email);
    
    // Check current user document
    const userDoc = await db.collection(USER_COLLECTION).doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      console.log('⚠️  User document does not exist in Users collection. Creating it...');
      
      // Create user document with admin privileges
      await db.collection(USER_COLLECTION).doc(userRecord.uid).set({
        email: userRecord.email,
        Email: userRecord.email,
        UID: userRecord.uid,
        uid: userRecord.uid,
        role: 'admin',
        Role: 'admin',
        isAdmin: true,
        IsAdmin: true,
        displayName: userRecord.displayName || userRecord.email?.split('@')[0] || 'Admin User',
        DisplayName: userRecord.displayName || userRecord.email?.split('@')[0] || 'Admin User',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Created user document with admin privileges');
    } else {
      const userData = userDoc.data();
      console.log('\n📋 Current user data:');
      console.log('  role:', userData?.role || 'not set');
      console.log('  Role:', userData?.Role || 'not set');
      console.log('  isAdmin:', userData?.isAdmin);
      console.log('  IsAdmin:', userData?.IsAdmin);
      
      // Check if admin fields are correct
      const hasRole = userData?.role === 'admin' || userData?.Role === 'admin';
      const hasAdminFlag = userData?.isAdmin === true || userData?.IsAdmin === true;
      
      if (!hasRole || !hasAdminFlag) {
        console.log('\n⚠️  Admin fields are missing or incorrect. Fixing...');
        
        // Update with all required admin fields
        await db.collection(USER_COLLECTION).doc(userRecord.uid).set({
          email: userRecord.email || userData?.email,
          Email: userRecord.email || userData?.Email || userData?.email,
          UID: userRecord.uid,
          uid: userRecord.uid,
          role: 'admin',
          Role: 'admin',
          isAdmin: true,
          IsAdmin: true,
          displayName: userData?.displayName || userData?.DisplayName || userRecord.displayName || userRecord.email?.split('@')[0] || 'Admin User',
          DisplayName: userData?.displayName || userData?.DisplayName || userRecord.displayName || userRecord.email?.split('@')[0] || 'Admin User',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Fixed admin fields');
      } else {
        console.log('\n✅ Admin fields are correctly set');
      }
    }
    
    // Set custom claims in Firebase Auth
    try {
      await admin.auth().setCustomUserClaims(userRecord.uid, { isAdmin: true });
      console.log('✅ Set custom claims in Firebase Auth');
    } catch (err) {
      console.warn('⚠️  Failed to set custom claims:', err.message);
    }
    
    // Verify final state
    const finalDoc = await db.collection(USER_COLLECTION).doc(userRecord.uid).get();
    const finalData = finalDoc.data();
    
    console.log('\n📊 Final user document:');
    console.log('  UID:', finalData?.UID || finalData?.uid);
    console.log('  Email:', finalData?.email || finalData?.Email);
    console.log('  role:', finalData?.role);
    console.log('  Role:', finalData?.Role);
    console.log('  isAdmin:', finalData?.isAdmin);
    console.log('  IsAdmin:', finalData?.IsAdmin);
    
    const isAdmin = (finalData?.isAdmin === true || finalData?.IsAdmin === true) && 
                    (finalData?.role === 'admin' || finalData?.Role === 'admin');
    
    if (isAdmin) {
      console.log('\n✅ User is now properly configured as admin!');
      console.log('   Please log out and log back in for changes to take effect.');
    } else {
      console.log('\n❌ User admin status could not be verified. Please check manually.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAndFixAdmin();

