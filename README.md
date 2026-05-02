# 🗣️ Ole Talk — Trinidadian Social App

> Where every Trini finds their voice.

A full-stack Twitter-style social media app built with a Trinidadian flair — real authentication, a live database, and real-time updates, all on the free tier.

**Made by [YOUR NAME]** 🇹🇹

---

## ✨ Features

- 🔐 **Real Auth** — Sign up & log in with email/password via Supabase Auth
- 🗣️ **Post (Ole Talk)** — Share thoughts up to 280 characters
- ❤️ **Likes & Reposts** — Full interaction with live counts
- 💬 **Comments / Replies** — Reply to any talk
- 👤 **Follow System** — Follow people, see their posts in your Following feed
- 🔔 **Notifications** — Get notified on likes, reposts, follows, and replies
- ⚡ **Real-time Feed** — New posts appear instantly without refreshing
- 🔍 **Search & Explore** — Search posts, hashtags, and users
- 📱 **Fully Responsive** — Mobile-first with bottom nav

---

## 🚀 Setup Guide (Free, No Credit Card)

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, fill in name & password, choose a region
3. Wait ~1 minute for it to spin up

### Step 2 — Run the Database Schema

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Copy the entire contents of `schema.sql` and paste it in
4. Click **Run** (▶️)
5. You should see "Success. No rows returned"

### Step 3 — Get Your API Keys

1. Go to **Project Settings** → **API**
2. Copy your **Project URL** (looks like `https://xxxx.supabase.co`)
3. Copy your **anon/public** key (long string starting with `eyJ...`)

### Step 4 — Add Keys to the App

Open `app.js` and replace these two lines at the top:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';      // ← paste your Project URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // ← paste your anon key
```

### Step 5 — Configure Auth (Allow Sign-ups)

1. In Supabase → **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. For testing, go to **Authentication** → **Settings** and disable **"Confirm email"** (optional — makes sign-up instant)

### Step 6 — Personalise It

In `index.html`, find the footer and replace `Your Name`:
```html
<p class="sidebar-footer">Ole Talk · Made by <strong>Your Name</strong> · 🇹🇹 2025</p>
```

In `app.js`, update the header comment:
```javascript
// Made by: Your Name 🇹🇹
```

---

## 🌐 Deploy to GitHub Pages (Free)

```bash
# Create repo on github.com named "ole-talk", then:
git init
git add .
git commit -m "🇹🇹 Ole Talk - Trinidadian social app"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/ole-talk.git
git push -u origin main
```

Then: **Settings** → **Pages** → Source: **Deploy from branch** → `main` → **/ (root)** → Save

Your live URL will be: `https://YOURUSERNAME.github.io/ole-talk`

> ⚠️ **Add your GitHub Pages URL to Supabase Auth allowed URLs:**
> Supabase → Authentication → URL Configuration → Add `https://YOURUSERNAME.github.io` to **Site URL**

---

## 🛠️ Tech Stack

| Layer | Tech | Cost |
|-------|------|------|
| Frontend | HTML, CSS, Vanilla JS | Free |
| Auth | Supabase Auth | Free |
| Database | Supabase PostgreSQL | Free (500MB) |
| Real-time | Supabase Realtime | Free |
| Hosting | GitHub Pages | Free |
| **Total** | | **$0/month** |

---

## 📁 File Structure

```
ole-talk/
├── index.html      # App layout & auth screen
├── style.css       # Carnival dark theme
├── app.js          # All logic + Supabase integration  
├── schema.sql      # Database setup (run once in Supabase)
└── README.md       # This file
```

---

## 🎨 Design

- **Dark carnival theme** — Gold & red inspired by the TT flag 🇹🇹
- **Syne** for headings (bold, distinctive)
- **DM Sans** for body text (clean & readable)
- Animated auth screen with floating orbs
- Avatar emoji system with 8 Trini-themed emojis
- Responsive layout: sidebar on desktop, bottom nav on mobile

---

*Ole Talk — built with 🇹🇹 pride and zero budget.*
