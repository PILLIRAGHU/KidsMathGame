# Math Quest Kids

A math practice game for kids: addition, subtraction and multiplication with digit boxes,
carry/borrow helper boxes, animations and sounds. Scores are saved per player name.

Designed & developed by Raghu Pilli.

## Run it

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

If the server can't be reached, scores are kept in the browser and sent automatically the next
time the server answers. Opening `index.html` directly (without the server) still works, but
scores then stay on that one device.

## Note

Players are identified by name only (not case-sensitive), with no password. Anyone who types
the same name shares that player's record.
