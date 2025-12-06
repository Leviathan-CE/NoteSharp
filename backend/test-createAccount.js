import { createAccount } from './dist/routes/fireAuthRoutes.js';
// Import Firebase initialization
import './dist/services/firebase.js';

async function testCreateAccount() {
  try {
    console.log('Creating test user account...');
    console.log('-----------------------------------');
    
    const userData = {
      email: "test@example.com",
      password: "Test123456!"
    };
    
    console.log(`Email: ${userData.email}`);
    console.log(`Password: ${userData.password}`);
    console.log('-----------------------------------');
    
    const sessionToken = await createAccount(userData);
    console.log('✅ Success! User created');
    console.log('-----------------------------------');
    console.log('You can now login with:');
    console.log(`Email: ${userData.email}`);
    console.log(`Password: ${userData.password}`);
    console.log('-----------------------------------');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('Note: If user already exists, just use the credentials above to login');
  }
}

testCreateAccount();
