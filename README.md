# 🗣️ Ole Talk 🇹🇹

> *Where every Trini finds their voice.*

A Trinidadian social platform built with vanilla HTML/CSS/JS and Supabase. Think Twitter, but limed out in T&T flag colours — red, black, and white with a carnival soul.

---

## What It Does

Ole Talk is a full social network with:

- **Posts ("Talks")** — up to 280 characters with hashtag and @mention highlighting
- **Likes & Reposts** — with live count updates
- **Replies** — threaded comment modal on every post
- **Follow system** — follow/unfollow users, see a Following feed
- **Notifications** — real-time alerts for likes, replies, follows
- **Explore** — search users and posts, browse trending T&T hashtags
- **User profiles** — with follower/following counts and post history
- **Realtime feed** — new posts from other users appear live via Supabase Realtime

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Backend / DB | [Supabase](https://supabase.com) (Postgres + Auth + Realtime) |
| Fonts | Playfair Display, Nunito (Google Fonts) |
| Auth | Supabase email/password auth |

No build step. No framework. Just three files.

---

## File Structure

```
oletalk/
├── index.html   # App shell, all pages and modals
├── style.css    # T&T themed styles (flag colours, dark mode)
└── app.js       # All logic — auth, feed, posts, follows, realtime
```

---

## Database Schema

Run this SQL in your Supabase SQL editor to set up all tables, policies, and indexes:

**Tables:** `profiles`, `posts`, `likes`, `reposts`, `follows`, `comments`, `notifications`

All tables have Row Level Security (RLS) enabled. The `schema.sql` file in this repo contains the full setup including the trigger that auto-creates a profile on signup.

---

## Getting Started

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and grab your **Project URL** and **Anon Key** from *Settings → API*.

### 2. Run the schema

In your Supabase dashboard, go to **SQL Editor** and paste in the full contents of `schema.sql`. This creates all tables, RLS policies, indexes, and the new-user trigger.

### 3. Add your credentials

Open `app.js` and replace the two constants at the top:

```js
const SUPABASE_URL = 'your-project-url';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 4. Run it

Open `index.html` directly in your browser, or serve with any static server:

```bash
npx serve .
```

No install, no build. That's it.

---

## Deploying

Ole Talk is static — deploy anywhere:

- **Netlify** — drag and drop the folder
- **Vercel** — `vercel deploy`
- **GitHub Pages** — push to a `gh-pages` branch
- **Cloudflare Pages** — connect your repo

Make sure your Supabase project's **Site URL** and **Redirect URLs** are set to your deployment domain under *Authentication → URL Configuration*.

---

## Features in Detail

### Auth
Email/password signup and login via Supabase Auth. A database trigger auto-creates a profile row on signup. Username uniqueness is checked before account creation.

### Feed
- **For You** — all recent posts from everyone
- **Following** — posts from people you follow (plus your own)
- New posts from other users appear at the top in real-time via Supabase Realtime channels

### Profiles
Emoji avatars with consistent colours per user (generated from a hash of the user ID, so they never change). Bio editable via prompt. Profile banner uses the T&T diagonal flag stripe pattern.

### Notifications
Generated server-side on like, comment, and follow actions. Unread count badge shown in the nav. Marking all read clears the badge.

---

## Design

The UI is built around the **Trinidad and Tobago national flag** — red (`#CE1126`), black, and white — with a warm gold accent for carnival/steel pan energy.

- **Playfair Display** — headings and logo (editorial, character)
- **Nunito** — body text (friendly, readable)
- Diagonal flag stripe on auth screen and profile banners
- Dark base (`#0e0c0c`) with layered elevation

---

## Known Limitations

- No image uploads (text-only posts)
- No direct messages
- No infinite scroll (loads last 50 posts)
- Edit profile only supports bio (no display name change in UI)

---

## Made By

**Mathias Moore** · 🇹🇹 · 2025

