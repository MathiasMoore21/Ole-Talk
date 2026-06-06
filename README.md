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


## File Structure

```
oletalk/
├── index.html   # App shell, all pages and modals
├── style.css    # T&T themed styles (flag colours, dark mode)
└── app.js       # All logic — auth, feed, posts, follows, realtime
