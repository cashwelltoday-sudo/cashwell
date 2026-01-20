# Firebase Setup voor Cashwell Group

## Stap 1: Ga naar Firebase Console
Ga naar: https://console.firebase.google.com/

## Stap 2: Open je Project
Klik op je project "cashwell-group"

## Stap 3: Open Project Settings
Klik op het **tandwiel-icoon** (⚙️) naast "Project Overview" in de linkerbovenhoek:

```
Project Overview
⚙️ Project settings  ← HIER KLIKKEN
```

## Stap 4: Scroll naar "Your apps"
Scroll naar beneden tot je "Your apps" ziet met een web-icoontje (`</>`):

```
Your apps
🌐 </> Web app  ← HIER KLIKKEN
```

## Stap 5: Registreer de app
1. Vul een app nickname in, bijv. "Cashwell Web"
2. Klik op "Register app"

## Stap 6: Kopieer de firebaseConfig
Na het registreren zie je code zoals dit:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "cashwell-group.firebaseapp.com",
  projectId: "cashwell-group",
  appId: "1:123456789:web:abc123def456"
};
```

**Kopieer deze gegevens en deel ze met mij!**

---

## Stap 7: Enable Google Auth (BELANGRIJK!)
Nadat je de config hebt gedeeld:

1. Klik in Firebase Console op **Authentication** (linkerzijbalk)
2. Klik op **Sign-in method**
3. Klik op **Google** provider
4. Enable de schakelaar "Enable"
5. Selecteer je email als "Support email"
6. Klik op **Save**

Dan werkt de Google login!

