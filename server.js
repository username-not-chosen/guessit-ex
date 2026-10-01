'use strict';

// ===========================================================================
// Configuration
// ===========================================================================

// The port the application listens on.
const PORT = 3000;

// The URL used to connect to the PostgreSQL database. It has the shape
// postgresql://USER:PASSWORD@HOST:PORT/DATABASE. Change the password to match
// the one you set when you ran schema.sql.
const DATABASE_URL = 'postgresql://guessit:change-me-now@localhost:5432/guessit';

// The colour used for the page's accent (buttons, title). Change it if you
// like a different look.
const ACCENT_COLOR = '#4e4664ff';

// How long a game stays playable after it is created. Once it is older than
// this, the game can no longer be viewed, guessed or given up. See "Game
// isolation" below. It is a PostgreSQL interval.
const GAME_TTL = '1 hour';

// The longest name a player can give, in characters. A longer name is cut to
// this length before the game is created.
const MAX_NAME_LENGTH = 500;

// The most games kept in the database. When a new game would go over this
// number, the oldest games are deleted to make room for it.
const MAX_GAMES = 1000;

// ===========================================================================

const crypto = require('node:crypto');
const express = require('express');
const { Pool } = require('pg');

const db = new Pool({ connectionString: DATABASE_URL });

const app = express();
app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------------------------
// Game isolation
// ---------------------------------------------------------------------------
//
// This game has no accounts: whoever knows a game's URL can play it. That is
// fine for a small teaching demo, but the public instance is shared, so two
// deliberate measures keep players from wandering into each other's games:
//
//   1. Each game gets a long random ID instead of a sequential number, so a
//      game's URL cannot be found by counting 1, 2, 3, ... (see newGameId).
//   2. A game can only be used for GAME_TTL after it is created; after that it
//      is treated as gone (enforced in loadGame).
//
// This is intended, lightweight isolation: a leaked ID still grants full
// access, and nothing here authenticates the player. A real application with
// private data would add real accounts and authorisation.

// Generate a random, practically unguessable game ID: 24 characters of letters
// and digits (about 140 bits of randomness).
const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function newGameId() {
  const bytes = crypto.randomBytes(24);
  let id = '';
  for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return id;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Home page: the leaderboard and the form to start a new game.
app.get('/', async (req, res, next) => {
  try {
    // The leaderboard.
    //
    // Select the games that have been won (found_at is not null), best first:
    // the fewest attempts first, and among games with the same number of
    // attempts, the one found earliest first. Return only the top ten.
    const leaderboardQuery = ''; // <-- IMPLEMENT ME

    // If the leaderboard cannot be loaded, for example because the database is
    // not running, the page is shown anyway and the error is printed in the
    // terminal. This way, the application can start without a database.
    let leaderboard = [];
    let totalGames = 0;
    let loaded = true;
    try {
      leaderboard = (await db.query(leaderboardQuery)).rows;
      // The total number of games ever started, won or not.
      totalGames = (await db.query('SELECT count(*)::int AS total FROM game')).rows[0].total;
    } catch (err) {
      console.error('Could not load the leaderboard:', err);
      loaded = false;
    }

    res.send(renderHome(leaderboard, totalGames, loaded));
  } catch (err) {
    next(err);
  }
});

// Start a new game.
app.post('/games', async (req, res, next) => {
  try {
    if (!req.body.name || req.body.name.trim() === '') {
      return res.redirect('/');
    }

    // Cut the name to MAX_NAME_LENGTH characters.
    const name = req.body.name.slice(0, MAX_NAME_LENGTH);

    // Give the game a random ID, and pick the secret number between 1 and 100.
    const id = newGameId();
    const secret = Math.floor(Math.random() * 100) + 1;

    // Insert the new game.
    await db.query(
      `INSERT INTO game (id, name, secret, attempts, created_at) VALUES ('${id}', '${name}', ${secret}, 0, NOW())`
    );

    // Keep only the MAX_GAMES most recent games, deleting the older ones.
    await db.query(
      `DELETE FROM game WHERE id NOT IN (SELECT id FROM game ORDER BY created_at DESC LIMIT ${MAX_GAMES})`
    );

    res.redirect('/games/' + id);
  } catch (err) {
    next(err);
  }
});

// A single game: the guess form, and the hint after a guess.
app.get('/games/:id', async (req, res, next) => {
  try {
    const game = await loadGame(req.params.id);
    if (!game) {
      return res.status(404).send(renderNotFound());
    }

    // Work out the hint to show. The secret is never sent to the browser; it
    // is only compared here, on the server.
    let hint = null;
    if (game.found_at) {
      hint = 'won';
    } else if (/^\d+$/.test(req.query.guess || '')) {
      const guess = Number(req.query.guess);
      if (guess < game.secret) hint = 'higher';
      else if (guess > game.secret) hint = 'lower';
    }

    res.send(renderGame(game, hint));
  } catch (err) {
    next(err);
  }
});

// Record a guess.
app.post('/games/:id/guesses', async (req, res, next) => {
  try {
    // Refuse unknown or expired games (see "Game isolation" above).
    const game = await loadGame(req.params.id);
    if (!game) {
      return res.status(404).send(renderNotFound());
    }

    // The guess is validated as an integer before it is used.
    const guess = req.body.guess;
    if (/^\d+$/.test(guess || '')) {
      // Record the guess.
      //
      // Add one to the game's attempts. When the guess equals the secret, also
      // set found_at to the current time (NOW()); otherwise leave found_at
      // unchanged. The game to update is `game` (its ID is `game.id`).
      const updateQuery = ''; // <-- IMPLEMENT ME
      await db.query(updateQuery);
    }

    res.redirect('/games/' + game.id + '?guess=' + encodeURIComponent(req.body.guess || ''));
  } catch (err) {
    next(err);
  }
});

// Give up: delete the game.
app.post('/games/:id/delete', async (req, res, next) => {
  try {
    // Refuse unknown or expired games (see "Game isolation" above).
    const game = await loadGame(req.params.id);
    if (!game) {
      return res.redirect('/');
    }

    // Give up.
    //
    // Delete `game` from the database (its ID is `game.id`).
    const deleteQuery = ''; // <-- IMPLEMENT ME
    await db.query(deleteQuery);

    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

// Load a single game by its ID, if it exists and is still within GAME_TTL of
// being created (see "Game isolation" above). The ID is validated as strictly
// alphanumeric first, so — unlike the player's name — it is safe to splice into
// the query.
async function loadGame(id) {
  if (!/^[A-Za-z0-9]+$/.test(id)) {
    return null;
  }
  const result = await db.query(`SELECT * FROM game WHERE id = '${id}' AND created_at > NOW() - INTERVAL '${GAME_TTL}'`);
  return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
      crossorigin="anonymous"
    />
    <style>
      :root { --accent: ${ACCENT_COLOR}; }
      body {
        background: linear-gradient(160deg, #f5f3ff 0%, #eef2ff 100%);
        min-height: 100vh;
      }
      .navbar-brand { font-weight: 700; letter-spacing: -0.02em; }
      .accent { color: var(--accent); }
      .btn-accent {
        background-color: var(--accent);
        border-color: var(--accent);
        color: #fff;
        transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.05s ease;
      }
      .btn-accent:hover,
      .btn-accent:focus-visible {
        background-color: color-mix(in srgb, var(--accent), #000 12%);
        border-color: color-mix(in srgb, var(--accent), #000 12%);
        color: #fff;
        box-shadow: 0 6px 18px rgba(108, 60, 233, 0.35);
      }
      .btn-accent:active {
        background-color: color-mix(in srgb, var(--accent), #000 20%);
        transform: translateY(1px);
      }
      .card { border: none; box-shadow: 0 10px 30px rgba(60, 40, 140, 0.08); }
      .rank { width: 2.5rem; font-variant-numeric: tabular-nums; }
      .rank-1 { color: #d4a11e; }
      .rank-2 { color: #9aa0a6; }
      .rank-3 { color: #b06b3a; }
    </style>
  </head>
  <body>
    <nav class="navbar navbar-dark mb-4" style="background-color: var(--accent);">
      <div class="container">
        <a class="navbar-brand" href="/">🎯 Guess It</a>
      </div>
    </nav>
    <main class="container pb-5" style="max-width: 720px;">
      ${body}
    </main>
  </body>
</html>`;
}

function renderHome(leaderboard, totalGames, loaded) {
  const rows = leaderboard
    .map((game, i) => {
      const rank = i + 1;
      const medal = rank <= 3 ? `<span class="rank-${rank}">●</span> ` : '';
      return `<li class="list-group-item d-flex justify-content-between align-items-center">
        <span class="rank fw-bold ${rank <= 3 ? 'rank-' + rank : ''}">${rank}</span>
        <span class="flex-grow-1 ms-2">${medal}${game.name}</span>
        <span class="badge bg-light text-dark rounded-pill">${game.attempts} tries</span>
      </li>`;
    })
    .join('\n');

  let board;
  if (!loaded) {
    board = `<p class="alert alert-warning mb-0">The leaderboard could not be loaded from the database. The error is in the terminal where Guess It runs.</p>`;
  } else if (leaderboard.length) {
    board = `<ol class="list-group list-group-flush">${rows}</ol>`;
  } else {
    board = `<p class="text-muted text-center my-4">No games won yet. Be the first!</p>`;
  }

  const total = loaded
    ? `<p class="text-muted text-center small mt-3 mb-0">${totalGames.toLocaleString('en-US')} ${totalGames === 1 ? 'game' : 'games'} played in total</p>`
    : '';

  return layout(
    'Guess It',
    `<div class="card mb-4">
      <div class="card-body">
        <h1 class="h4 mb-3">Start a new game</h1>
        <form action="/games" method="post" class="d-flex gap-2">
          <input
            class="form-control form-control-lg"
            type="text"
            name="name"
            placeholder="Your name"
            autofocus
          />
          <button class="btn btn-accent btn-lg px-4" type="submit">Play</button>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <h2 class="h5 mb-3">🏆 Leaderboard <small class="text-muted">— fewest tries wins</small></h2>
        ${board}
        ${total}
      </div>
    </div>`
  );
}

function renderGame(game, hint) {
  let banner = '';
  if (hint === 'won') {
    banner = `<div class="alert alert-success">
        🎉 <strong>${game.name}</strong>, you found it in ${game.attempts} tries!
        <a href="/" class="alert-link">Back to the leaderboard</a>
      </div>`;
  } else if (hint === 'higher') {
    banner = `<div class="alert alert-info">📈 Higher!</div>`;
  } else if (hint === 'lower') {
    banner = `<div class="alert alert-warning">📉 Lower!</div>`;
  }

  const controls = game.found_at
    ? `<form action="/games/${game.id}/delete" method="post">
         <button class="btn btn-outline-secondary" type="submit">Delete this game</button>
       </form>`
    : `<form action="/games/${game.id}/guesses" method="post" class="d-flex gap-2 mb-3">
         <input
           class="form-control form-control-lg"
           type="number"
           name="guess"
           min="1"
           max="100"
           placeholder="1 – 100"
           autofocus
         />
         <button class="btn btn-accent btn-lg px-4" type="submit">Guess</button>
       </form>
       <form action="/games/${game.id}/delete" method="post">
         <button class="btn btn-link text-muted p-0" type="submit">Give up</button>
       </form>`;

  return layout(
    'Guess It',
    `${banner}
    <div class="card">
      <div class="card-body">
        <h1 class="h4 mb-1">Hello, ${game.name}!</h1>
        <p class="text-muted mb-4">I'm thinking of a number between 1 and 100. You've made ${game.attempts} guesses.</p>
        ${controls}
      </div>
    </div>`
  );
}

function renderNotFound() {
  return layout(
    'Not found',
    `<div class="card"><div class="card-body text-center">
      <h1 class="h4">Game not found</h1>
      <a href="/" class="btn btn-accent mt-2">Back home</a>
    </div></div>`
  );
}

// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Guess It is listening on http://localhost:${PORT}`);
});
