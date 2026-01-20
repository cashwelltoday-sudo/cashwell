# Firebase Realtime Sync Implementatie

## Doel
Alle data opslaan in Firebase Firestore zodat:
- Data realtime wordt gesynchroniseerd tussen alle apparaten
- Nieuwe gebruikers automatisch worden toegevoegd voor iedereen
- Groepsleden elkaars data kunnen zien

## Benodigde wijzigingen in script.js

### 1. DataManager klasse aanpassen
- Firestore als primaire opslag (niet localStorage)
- Cloud subscriptions voor realtime updates

### 2. Cloud functies implementeren
- `cloudAddEntry()` - Entry toevoegen aan Firestore
- `cloudUpdateEntry()` - Entry updaten
- `cloudDeleteEntry()` - Entry verwijderen
- `cloudAddWalletAsset()` - Wallet asset toevoegen
- `cloudUpdateWalletAsset()` - Wallet asset updaten
- `cloudDeleteWalletAsset()` - Wallet asset verwijderen
- `cloudAddTeamEvent()` - Team event toevoegen
- `cloudDeleteTeamEvent()` - Team event verwijderen
- `cloudUpdateTeamEventAttendance()` - Aanwezigheid bijwerken

### 3. Firestore Rules (tijdelijk voor testing)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /groups/{groupId}/{document=**} {
      allow read, write: if true; // TODO: Beveiligen voor productie
    }
  }
}
```

## Huidige status code
De code heeft al:
- `initCloud()` - Firebase initialisatie
- `cloudUpsertMember()` - Member toevoegen/updaten
- `subscribeToCloud()` - Realtime subscriptions voor members, entries, chat
- `cloudAddEntry()` - Entry toevoegen
- `cloudAddGroupChatMessage()` - Chat message toevoegen

## Ontbrekende functionaliteit
1. Wallet assets sync naar cloud
2. Custom assets sync naar cloud
3. Team events sync naar cloud
4. Alle cloud functies gebruiken i.p.v. localStorage

## Implementatie plan
1. Wijzig DataManager om cloud als primary storage te gebruiken
2. Voeg ontbrekende cloud functies toe
3. Pas alle add/update/delete functies aan om cloud te gebruiken
4. Verwijder of minimaliseer localStorage gebruik

