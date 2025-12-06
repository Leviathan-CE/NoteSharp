import { createAccount, loginUser, logoutUser, verifyUserToken } from './dist/services/fireAuth.js';
// Import Firebase initialization
import { auth } from './dist/services/firebase.js';

async function testFireAuth() {
  try {
    console.log('🧪 Testing Firebase Auth Functions...\n');
    
    // Test 1: Create Account (Server-side)
    console.log('1️⃣ Testing createAccount...');
    const userData = {
      email: `testuser${Date.now()}@example.com`,
      password: "password123"
    };
    
    const sessionToken = await createAccount(userData);
    console.log('✅ Account created:', sessionToken);
    
    // Test 2: Login User (Client-side)
    console.log('\n2️⃣ Testing loginUser...');
    const loginResult = await loginUser(userData.email, "password123");
    console.log('✅ Login successful:', loginResult);
    
    // Test 3: Logout User (Client-side)
    console.log('\n3️⃣ Testing logoutUser...');
    await logoutUser();
    console.log('✅ Logout successful');
    
    console.log('\n🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFireAuth();
