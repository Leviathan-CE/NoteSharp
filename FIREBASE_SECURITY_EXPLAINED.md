# Firebase Security Rules - How They Protect Your Data

## Key Concept: API Key vs. Authentication Token

### Firebase API Key (Public)
- **Purpose**: Identifies your Firebase project
- **Visibility**: Public (can be in client-side code)
- **Security**: Alone, it does NOT grant access to data
- **Example**: `AIzaSyB1234567890abcdefghijklmnopqrstuvw` (in your frontend config)

### Authentication Token (Private)
- **Purpose**: Proves a user's identity
- **Visibility**: Private (generated when user logs in)
- **Security**: This is what Security Rules check
- **Example**: JWT token that contains `uid: "user-123"`

## How Security Rules Work

When a user makes a Firestore request, Firebase:

1. **Checks if user is authenticated** (`request.auth != null`)
2. **Gets the user's UID** (`request.auth.uid` from their auth token)
3. **Checks the document's data** (`resource.data.userId`)
4. **Compares them** (only allow if they match)

## Example Scenarios

### Firestore Structure
```
/boards/abc123 → { title: "My Board", userId: "user-1" }
/boards/xyz789 → { title: "Other Board", userId: "user-2" }
```

### Security Rules
```javascript
match /boards/{boardId} {
  allow read: if request.auth != null && 
    resource.data.userId == request.auth.uid;
}
```

### Scenario 1: Attacker has API key, NOT logged in
```javascript
// Attacker tries:
db.collection('boards').get()

// Firebase checks:
request.auth != null  // ❌ FALSE (no auth token)
Result: DENIED ❌
```

### Scenario 2: Attacker has API key, logs in as "user-1", tries to read "user-2's" board
```javascript
// Attacker tries:
db.collection('boards').doc('xyz789').get()  // userId = "user-2"

// Firebase checks:
request.auth != null  // ✅ TRUE (logged in as "user-1")
resource.data.userId == request.auth.uid  // ❌ FALSE ("user-2" != "user-1")
Result: DENIED ❌
```

### Scenario 3: User "user-1" tries to read their own board
```javascript
// User tries:
db.collection('boards').doc('abc123').get()  // userId = "user-1"

// Firebase checks:
request.auth != null  // ✅ TRUE (logged in as "user-1")
resource.data.userId == request.auth.uid  // ✅ TRUE ("user-1" == "user-1")
Result: ALLOWED ✅
```

## Important Takeaways

1. **API keys are public by design** - This is normal and expected
2. **Security Rules are your security** - They check authentication and ownership
3. **Without proper rules, anyone CAN access data** - Always require:
   - `request.auth != null` (authentication check)
   - `resource.data.userId == request.auth.uid` (ownership check)
4. **Your current rules ARE secure** - They have both checks

## What Makes Rules Secure?

✅ **Secure Rules:**
```javascript
allow read: if request.auth != null && 
  resource.data.userId == request.auth.uid;
```

❌ **Insecure Rules:**
```javascript
// Anyone can read (even without login)
allow read: if true;

// Any logged-in user can read any board (no ownership check)
allow read: if request.auth != null;
```

## Summary

- API key alone = NO access to data
- API key + Authentication token = Access only if rules allow it
- Your rules require authentication AND ownership check = Secure ✅

