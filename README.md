# Math Quest Kids

A math practice game for kids: addition, subtraction and multiplication with digit boxes,
carry/borrow helper boxes, animations and sounds. Scores are saved per player name.

Designed & developed by Raghu Pilli.

## Where scores are saved

- **Firebase (online, works on GitHub Pages):** used when `firebase-config.js` has your Firebase settings.
- **Local server (SQLite):** used when `firebase-config.js` is left empty and you run `npm start`.

## Put it on GitHub Pages (with Firebase)

GitHub Pages can only host files, it can't run a database, so scores are saved in Firebase
Firestore (free plan is plenty for this game).

1. Go to <https://console.firebase.google.com>, click **Create a project** (Google Analytics not needed).
2. In the project, open **Build → Firestore Database → Create database**. Pick a location near you
   and choose **production mode**.
3. Open the **Rules** tab, replace everything with the contents of [firestore.rules](firestore.rules),
   and click **Publish**.
4. Open **Project settings** (gear icon) → **General** → **Your apps** → click the **Web** icon (`</>`),
   give it any nickname (no Firebase Hosting needed) and **Register app**.
5. Copy the values from the `firebaseConfig` it shows into [firebase-config.js](firebase-config.js)
   (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
6. Commit and push. Open your GitHub Pages site, play one question, and check the Score Book says
   "☁️ Scores are saved online". The scores appear in the Firebase console under **Firestore Database → Data**.

The Firebase web config is meant to be public, so it's fine in the repository; the rules are what
protect the data (each answer can only add one correct-or-wrong to a record, nothing can be edited or deleted).
To reset a player, delete their document under `users` in the Firebase console.

## Run it locally

Requires [Node.js](https://nodejs.org) 22.5 or newer. There is nothing to install.

```sh
npm start
```

Then open <http://localhost:3000>.

Scores are stored in a SQLite database at `data/mathquest.db`, so a player sees the same
history on any machine that uses the same server.

### Playing from other machines

- **Same home/school network:** run `npm start` on one computer and open
  `http://<that-computer's-IP>:3000` on the others. On Windows, find the IP with `ipconfig`
  and allow Node.js through the firewall when asked.
- **Anywhere (internet):** deploy this folder to any Node.js host (Render, Railway, Fly.io, a VPS).
  Give it a persistent disk and point `DB_FILE` at it so scores survive restarts.

### Settings (environment variables)

| Variable  | Default              | Meaning                    |
|-----------|----------------------|----------------------------|
| `PORT`    | `3000`               | Port to listen on          |
| `HOST`    | `0.0.0.0`            | Interface to listen on     |
| `DB_FILE` | `data/mathquest.db`  | Location of the database   |

## Offline

If the database (Firebase or the local server) can't be reached, scores are kept in the browser and sent automatically the next
time the server answers. Opening `index.html` directly (without the server) still works, but
scores then stay on that one device.

## Note

Players are identified by name only (not case-sensitive), with no password. Anyone who types
the same name shares that player's record.
