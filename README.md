# Guess It

A tiny guess-the-number game with a leaderboard, written for Node.js with a
PostgreSQL database. A player picks a name, the server thinks of a number
between 1 and 100, and answers "higher" or "lower" until it is found. Games are
ranked on the home page by the fewest guesses.

It is deliberately small, all in one file, and left partly unimplemented so that
students fill in the missing pieces.

- [What is in here](#what-is-in-here)
- [Requirements](#requirements)
- [Setup](#setup)
- [Run in development mode](#run-in-development-mode)
- [Run in production mode](#run-in-production-mode)

> [!NOTE]
> This is an educational project for the [Media Engineering Architecture &
> Deployment][archidep] course. It is not intended to be deployed outside the
> controlled environment of the course.

## What is in here

- **`server.js`** — the whole application: the configuration, the routes, the
  database queries and the HTML. This is the only file you edit.
- **`schema.sql`** — creates the database user, the database and the table.
- **`package.json`** — application dependencies: [Express][express] and
  [pg][pg].

The incomplete queries are marked with `// IMPLEMENT ME` comments in
`server.js`.

## Requirements

- [Node.js][node] 22, 24 or 26
- [PostgreSQL][postgres] 14 to 18

## Setup

1. Change the password in `schema.sql`, then create the database by running it
   as a PostgreSQL superuser, for example:

   ```bash
   sudo -u postgres psql < schema.sql   # PostgreSQL installed with apt
   psql postgres < schema.sql           # Postgres.app, or Homebrew
   ```

2. Set the same password in the `DATABASE_URL` at the top of `server.js`.

3. Install the dependencies:

   ```bash
   npm ci
   ```

## Run in development mode

Start the server with live reload, which restarts it whenever you save a file:

```bash
npm run dev
```

Then open <http://localhost:3000>.

## Run in production mode

Start the server with Node.js:

```bash
node server.js
```

Then open <http://localhost:3000>.

[archidep]: https://archidep.ch
[express]: https://expressjs.com
[node]: https://nodejs.org
[pg]: https://node-postgres.com
[postgres]: https://www.postgresql.org

## Team

- Alice
- Bob
- Chuck
