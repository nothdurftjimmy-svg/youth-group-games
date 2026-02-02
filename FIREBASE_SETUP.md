# Firebase Setup Instructions

To enable real-time multiplayer for the Among Us game, you need to create a FREE Firebase project.

## Steps:

### 1. Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name it "youth-group-games" (or any name you like)
4. Disable Google Analytics (not needed)
5. Click "Create project"

### 2. Enable Realtime Database
1. In your Firebase console, click "Realtime Database" in the left menu
2. Click "Create Database"
3. Choose your location (US or closest to you)
4. Start in **TEST MODE** (you can secure it later)
5. Click "Enable"

### 3. Get Your Configuration
1. Click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the web icon `</>`
5. Register your app (name it "Youth Group Games")
6. Copy the `firebaseConfig` object

### 4. Update Your Code
Open the file `js/amongus.js` and replace lines 18-26 with your config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR-API-KEY-HERE",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

### 5. Set Database Rules (Optional - for production)
In Firebase Console > Realtime Database > Rules, use these rules:

```json
{
  "rules": {
    "games": {
      "$gameId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

⚠️ **Note:** These rules allow anyone to read/write. For production, you should add authentication.

### 6. Deploy Your Changes
After updating the config, commit and push to GitHub:

```powershell
git add .
git commit -m "Add Firebase configuration"
git push
```

Your multiplayer Among Us game will now work! 🎉

## Free Tier Limits
Firebase's free tier (Spark Plan) includes:
- 1 GB stored data
- 10 GB/month downloaded data
- 100 simultaneous connections

This is plenty for a youth group!

## Need Help?
If you have issues, check the Firebase Console for errors or let me know!
