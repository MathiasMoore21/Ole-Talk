// Ole Talk — app.js
// Supabase backend integration
// Made by: Mathias Moore 🇹🇹

const SUPABASE_URL = 'https://bwypwhtztudiroetkfws.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3eXB3aHR6dHVkaXJvZXRrZndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDA1MzEsImV4cCI6MjA5MzMxNjUzMX0.aLfqXX9Yw0v75E-ic67HX_nt6iJkv2dbLfee9HxwbRA';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App state
let currentUser = null;
let currentProfile = null;
let currentFeed = 'for-you';
let activeCommentPostId = null;
let realtimeChannel = null;
let searchDebounce = null;

// Avatar emojis and colours for user icons
const AVATARS = ['🌴', '🦜', '🌺', '🥁', '🎺', '🌊', '🎉', '🦋'];
const AV_COLORS = ['av-0', 'av-1', 'av-2', 'av-3', 'av-4', 'av-5', 'av-6', 'av-7'];

// Static trending hashtags shown on explore page
const STATIC_TRENDING = [
  { tag: '#Carnival2025', count: '2.4K talks' },
  { tag: '#Doubles', count: '1.8K talks' },
  { tag: '#LimingTonight', count: '982 talks' },
  { tag: '#Soca', count: '876 talks' },
  { tag: '#TrinidadAndTobago', count: '741 talks' },
  { tag: '#Parang', count: '512 talks' },
  { tag: '#POS', count: '430 talks' },
];

// Full Supabase select string for posts — used everywhere to keep queries consistent
const POST_SELECT = `
  id, content, created_at, user_id, reply_to,
  profiles:user_id (id, username, display_name, verified),
  likes (user_id),
  reposts (user_id),
  comments (id)
`;

// ============ INIT ============

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    await loadUser(session.user);
    showApp();
  } else {
    showAuth();
  }

  // Listen for auth changes (login, logout, token refresh)
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      await loadUser(session.user);
      showApp();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      showAuth();
    }
  });
});

async function loadUser(user) {
  currentUser = user;
  const { data } = await db.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = data;
  updateSidebarUser();
  updateComposeAvatars();
  await loadFeed();
  loadWhoToFollow();
  loadTrending();
  subscribeRealtime();
  checkNotifications();
}

// ============ AUTH ============

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

function switchTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signup-form').classList.toggle('hidden', tab !== 'signup');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('auth-error').classList.add('hidden');
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn-text');

  if (!email || !password) return showAuthError('Fill in all fields nah!');

  btn.textContent = 'Logging in...';
  const { error } = await db.auth.signInWithPassword({ email, password });
  btn.textContent = 'Log in';

  if (error) showAuthError(error.message);
}

async function signup() {
  const displayName = document.getElementById('signup-display').value.trim();
  const username = document.getElementById('signup-username').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const btn = document.getElementById('signup-btn-text');

  if (!displayName || !username || !email || !password) return showAuthError('All fields needed, doh play!');
  if (username.length < 3) return showAuthError('Username must be at least 3 characters');
  if (password.length < 6) return showAuthError('Password must be at least 6 characters');

  // Check if username is already taken
  const { data: existing } = await db.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) return showAuthError('That username already taken, try another!');

  btn.textContent = 'Joining...';
  const { data: authData, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName } }
  });
  btn.textContent = 'Join the lime 🎉';

  if (error) {
    showAuthError(error.message);
    return;
  }

  // The DB trigger handles profile creation, but we upsert here as a fallback
  if (authData?.user) {
    await db.from('profiles').upsert({
      id: authData.user.id,
      username,
      display_name: displayName,
      bio: '',
      verified: false
    }, { onConflict: 'id' });
  }

  showAuthError('Check your email to confirm yuh account! 📧');
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function logout() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  await db.auth.signOut();
}

// ============ NAVIGATION ============

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`)?.classList.add('active');
  document.getElementById(`mnav-${page}`)?.classList.add('active');

  if (page === 'explore') loadExplore();
  if (page === 'notifications') loadNotifications();
  // Profile page always loads the current user's profile
  if (page === 'profile') loadProfilePage(currentUser?.id);
}

// ============ FEED ============

async function switchFeed(type, btn) {
  currentFeed = type;
  document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  await loadFeed();
}

async function loadFeed() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="feed-loading"><div class="spinner"></div></div>';

  let query = db
    .from('posts')
    .select(POST_SELECT)
    .is('reply_to', null) // only top-level posts, not replies
    .order('created_at', { ascending: false })
    .limit(50);

  if (currentFeed === 'following' && currentUser) {
    // Get IDs of people we follow
    const { data: followData } = await db
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUser.id);

    const ids = followData?.map(f => f.following_id) || [];
    ids.push(currentUser.id); // include own posts

    // If not following anyone yet, show empty state
    if (ids.length === 1) {
      feed.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌴</div>
          <p>Follow some people to see their talks!</p>
        </div>`;
      return;
    }

    query = query.in('user_id', ids);
  }

  const { data: posts, error } = await query;

  feed.innerHTML = '';

  if (error || !posts?.length) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌴</div>
        <p>${currentFeed === 'following' ? 'Follow some people to see their talks!' : 'No talks yet. Be the first!'}</p>
      </div>`;
    return;
  }

  posts.forEach(post => feed.appendChild(renderPost(post)));
}

function renderPost(post) {
  const profile = post.profiles;
  const likeCount = post.likes?.length || 0;
  const repostCount = post.reposts?.length || 0;
  const commentCount = post.comments?.length || 0;
  const liked = post.likes?.some(l => l.user_id === currentUser?.id);
  const reposted = post.reposts?.some(r => r.user_id === currentUser?.id);
  const avatarIdx = hashStr(profile?.id || 'x') % 8;
  const timeAgo = getTimeAgo(post.created_at);
  // post.user_id tells us if we own this post (needed for delete button)
  const isOwner = post.user_id === currentUser?.id;

  const el = document.createElement('div');
  el.className = 'post-card';
  el.dataset.postId = post.id;

  el.innerHTML = `
    <div class="post-avatar ${AV_COLORS[avatarIdx]}" onclick="goToProfile('${profile?.id}', event)">
      ${AVATARS[avatarIdx]}
    </div>
    <div class="post-body">
      <div class="post-header">
        <span class="post-display" onclick="goToProfile('${profile?.id}', event)">${escHtml(profile?.display_name || 'Unknown')}</span>
        ${profile?.verified ? '<span class="verified-badge" title="Verified">✅</span>' : ''}
        <span class="post-handle">@${profile?.username || '?'}</span>
        <span class="post-time">${timeAgo}</span>
      </div>
      <div class="post-content">${formatContent(post.content)}</div>
      <div class="post-actions">
        <button class="action-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${post.id}', this, event)">
          <svg viewBox="0 0 24 24"><path d="${liked
            ? 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
            : 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'}"/></svg>
          <span class="count">${likeCount > 0 ? likeCount : ''}</span>
        </button>
        <button class="action-btn" onclick="openCommentModal('${post.id}', event)">
          <svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>
          <span class="count">${commentCount > 0 ? commentCount : ''}</span>
        </button>
        <button class="action-btn ${reposted ? 'reposted' : ''}" onclick="toggleRepost('${post.id}', this, event)">
          <svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
          <span class="count">${repostCount > 0 ? repostCount : ''}</span>
        </button>
        ${isOwner ? `
        <button class="action-btn" onclick="deletePost('${post.id}', event)" style="margin-left:auto;max-width:40px;">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>` : ''}
      </div>
    </div>
  `;

  return el;
}

// Navigate to a profile page without losing the event target
function goToProfile(userId, event) {
  event?.stopPropagation();
  if (!userId) return;
  loadProfilePage(userId);
}

// ============ POST ACTIONS ============

async function createPost() {
  const text = document.getElementById('compose-text').value.trim();
  if (!text) return;

  const btn = document.getElementById('post-btn-text');
  btn.textContent = '...';

  const { data, error } = await db
    .from('posts')
    .insert({ user_id: currentUser.id, content: text })
    .select(POST_SELECT)
    .single();

  btn.textContent = 'Talk';
  document.getElementById('compose-text').value = '';
  resetCharCounter();

  if (error) {
    toast('Couldn\'t post, try again', 'error');
    return;
  }

  // Add the new post to the top of the feed with a brief highlight
  const feed = document.getElementById('feed');
  const card = renderPost(data);
  card.style.borderLeft = '3px solid var(--red)';
  setTimeout(() => (card.style.borderLeft = ''), 1600);
  feed.prepend(card);
  toast('Ole Talk posted! 🗣️', 'success');
}

async function createPostFromModal() {
  const text = document.getElementById('modal-compose-text').value.trim();
  if (!text) return;

  const { error } = await db
    .from('posts')
    .insert({ user_id: currentUser.id, content: text });

  document.getElementById('modal-compose-text').value = '';
  closePostModal();

  if (!error) {
    toast('Ole Talk posted! 🗣️', 'success');
    loadFeed(); // Reload feed to show the new post
  } else {
    toast('Couldn\'t post, try again', 'error');
  }
}

async function toggleLike(postId, btn, event) {
  event?.stopPropagation();
  if (!currentUser) return toast('Log in to like!', 'error');

  const liked = btn.classList.contains('liked');
  const countEl = btn.querySelector('.count');
  const cur = parseInt(countEl.textContent) || 0;

  if (liked) {
    btn.classList.remove('liked');
    countEl.textContent = cur > 1 ? cur - 1 : '';
    await db.from('likes').delete().match({ user_id: currentUser.id, post_id: postId });
  } else {
    btn.classList.add('liked');
    countEl.textContent = cur + 1;
    await db.from('likes').insert({ user_id: currentUser.id, post_id: postId });

    // Notify the post owner (skip if it's our own post)
    const { data: post } = await db.from('posts').select('user_id').eq('id', postId).single();
    if (post && post.user_id !== currentUser.id) {
      await db.from('notifications').insert({
        user_id: post.user_id,
        actor_id: currentUser.id,
        type: 'like',
        post_id: postId
      });
    }
  }
}

async function toggleRepost(postId, btn, event) {
  event?.stopPropagation();
  if (!currentUser) return toast('Log in to repost!', 'error');

  const reposted = btn.classList.contains('reposted');
  const countEl = btn.querySelector('.count');
  const cur = parseInt(countEl.textContent) || 0;

  if (reposted) {
    btn.classList.remove('reposted');
    countEl.textContent = cur > 1 ? cur - 1 : '';
    await db.from('reposts').delete().match({ user_id: currentUser.id, post_id: postId });
  } else {
    btn.classList.add('reposted');
    countEl.textContent = cur + 1;
    await db.from('reposts').insert({ user_id: currentUser.id, post_id: postId });
    toast('Reposted!', 'success');
  }
}

async function deletePost(postId, event) {
  event?.stopPropagation();
  if (!confirm('Delete this talk?')) return;

  await db.from('posts').delete().eq('id', postId).eq('user_id', currentUser.id);
  document.querySelector(`[data-post-id="${postId}"]`)?.remove();
  toast('Talk deleted', 'success');
}

// ============ COMMENTS ============

function openCommentModal(postId, event) {
  event?.stopPropagation();
  activeCommentPostId = postId;

  const modal = document.getElementById('comment-modal');
  modal.classList.remove('hidden');

  // Set the comment compose avatar
  const avatarIdx = hashStr(currentUser.id) % 8;
  const avatarEl = document.getElementById('comment-avatar');
  avatarEl.className = `compose-avatar ${AV_COLORS[avatarIdx]}`;
  avatarEl.textContent = AVATARS[avatarIdx];

  loadComments(postId);
}

function closeCommentModal(event) {
  // If event exists, only close when clicking the overlay backdrop (not the card)
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('comment-modal').classList.add('hidden');
  document.getElementById('comment-text').value = '';
  activeCommentPostId = null;
}

async function loadComments(postId) {
  const { data } = await db
    .from('comments')
    .select(`
      id, content, created_at,
      profiles:user_id (id, username, display_name, verified)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  const list = document.getElementById('comments-list');

  if (!data?.length) {
    list.innerHTML = '<div class="empty-state" style="padding:24px"><p>No replies yet. Be the first!</p></div>';
    return;
  }

  list.innerHTML = '';
  data.forEach(c => list.appendChild(renderComment(c)));
}

function renderComment(c) {
  const p = c.profiles;
  const avatarIdx = hashStr(p?.id || 'x') % 8;
  const el = document.createElement('div');
  el.className = 'post-card';
  el.style.cursor = 'default';
  el.innerHTML = `
    <div class="post-avatar ${AV_COLORS[avatarIdx]}">${AVATARS[avatarIdx]}</div>
    <div class="post-body">
      <div class="post-header">
        <span class="post-display">${escHtml(p?.display_name || 'Unknown')}</span>
        <span class="post-handle">@${p?.username || '?'}</span>
        <span class="post-time">${getTimeAgo(c.created_at)}</span>
      </div>
      <div class="post-content">${formatContent(c.content)}</div>
    </div>
  `;
  return el;
}

async function submitComment() {
  const text = document.getElementById('comment-text').value.trim();
  if (!text || !activeCommentPostId) return;

  const { error } = await db.from('comments').insert({
    user_id: currentUser.id,
    post_id: activeCommentPostId,
    content: text
  });

  if (error) {
    toast('Couldn\'t reply, try again', 'error');
    return;
  }

  document.getElementById('comment-text').value = '';
  loadComments(activeCommentPostId);
  toast('Replied! 💬', 'success');

  // Update comment count on the post card in the feed
  const postCard = document.querySelector(`[data-post-id="${activeCommentPostId}"]`);
  if (postCard) {
    const commentBtn = postCard.querySelectorAll('.action-btn')[1];
    if (commentBtn) {
      const countEl = commentBtn.querySelector('.count');
      const cur = parseInt(countEl.textContent) || 0;
      countEl.textContent = cur + 1;
    }
  }

  // Notify post owner
  const { data: post } = await db.from('posts').select('user_id').eq('id', activeCommentPostId).single();
  if (post && post.user_id !== currentUser.id) {
    await db.from('notifications').insert({
      user_id: post.user_id,
      actor_id: currentUser.id,
      type: 'comment',
      post_id: activeCommentPostId
    });
  }
}

// ============ EXPLORE ============

async function loadExplore() {
  // Reset search input and show trending on explore load
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').classList.add('hidden');
  document.getElementById('trending-section').classList.remove('hidden');
  loadTrendingPage();
}

function loadTrendingPage() {
  const list = document.getElementById('trending-list');
  list.innerHTML = STATIC_TRENDING.map((t, i) => `
    <div class="trending-item" onclick="searchHashtag('${t.tag}')">
      <span class="trending-rank">${i + 1} · Trending in Trinidad</span>
      <span class="trending-tag">${t.tag}</span>
      <span class="trending-count">${t.count}</span>
    </div>
  `).join('');
}

function debounceSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(performSearch, 400);
}

async function performSearch() {
  const q = document.getElementById('search-input').value.trim();

  if (!q) {
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('trending-section').classList.remove('hidden');
    return;
  }

  document.getElementById('trending-section').classList.add('hidden');
  document.getElementById('search-results').classList.remove('hidden');

  const results = document.getElementById('search-results');
  results.innerHTML = '<div class="feed-loading"><div class="spinner"></div></div>';

  const isHashtag = q.startsWith('#');
  let postsQuery, usersQuery;

  if (isHashtag) {
    // Hashtag search: only look through post content
    postsQuery = db
      .from('posts')
      .select(POST_SELECT)
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(30);
  } else {
    // Text search: search both posts and user profiles
    postsQuery = db
      .from('posts')
      .select(POST_SELECT)
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    usersQuery = db
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(5);
  }

  const [{ data: posts }, usersResult] = await Promise.all([
    postsQuery,
    usersQuery || Promise.resolve({ data: null })
  ]);

  results.innerHTML = '';

  // Show matching users first
  if (usersResult?.data?.length) {
    const section = document.createElement('div');
    section.innerHTML = '<h2 class="section-title">👤 People</h2>';
    usersResult.data.forEach(u => section.appendChild(renderWhoItem(u)));
    results.appendChild(section);
  }

  // Then show matching posts
  if (posts?.length) {
    const section = document.createElement('div');
    section.innerHTML = '<h2 class="section-title">🗣️ Talks</h2>';
    posts.forEach(p => section.appendChild(renderPost(p)));
    results.appendChild(section);
  }

  if (!posts?.length && !usersResult?.data?.length) {
    results.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>No results for "${escHtml(q)}"</p>
      </div>`;
  }
}

// Search for a hashtag: put the tag in the search bar and run search
function searchHashtag(tag) {
  // Switch to explore page first, then update search
  showPage('explore');
  // Wait a tick for the page to render, then set input and search
  setTimeout(() => {
    document.getElementById('search-input').value = tag;
    performSearch();
  }, 50);
}

// ============ NOTIFICATIONS ============

async function loadNotifications() {
  const list = document.getElementById('notifications-list');
  list.innerHTML = '<div class="feed-loading"><div class="spinner"></div></div>';

  const { data } = await db
    .from('notifications')
    .select(`
      id, type, read, created_at,
      actors:actor_id (username, display_name),
      post:post_id (content)
    `)
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Mark all as read after fetching
  await db
    .from('notifications')
    .update({ read: true })
    .eq('user_id', currentUser.id)
    .eq('read', false);

  document.getElementById('notif-count').classList.add('hidden');

  list.innerHTML = '';

  if (!data?.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔔</div><p>No notifications yet</p></div>';
    return;
  }

  const icons = { like: '❤️', repost: '🔁', follow: '👤', comment: '💬', mention: '📣' };
  const msgs = {
    like: (name) => `<strong>${name}</strong> liked your talk`,
    repost: (name) => `<strong>${name}</strong> reposted your talk`,
    follow: (name) => `<strong>${name}</strong> started following you`,
    comment: (name) => `<strong>${name}</strong> replied to your talk`,
    mention: (name) => `<strong>${name}</strong> mentioned you`,
  };

  data.forEach(n => {
    const actorName = escHtml(n.actors?.display_name || 'Someone');
    const el = document.createElement('div');
    el.className = `notif-item ${n.read ? '' : 'unread'}`;
    el.innerHTML = `
      <div class="notif-icon">${icons[n.type] || '🔔'}</div>
      <div>
        <div class="notif-text">${msgs[n.type] ? msgs[n.type](actorName) : 'New notification'}</div>
        ${n.post?.content ? `<div class="notif-meta">"${escHtml(n.post.content.slice(0, 60))}${n.post.content.length > 60 ? '...' : ''}"</div>` : ''}
        <div class="notif-meta">${getTimeAgo(n.created_at)}</div>
      </div>
    `;
    list.appendChild(el);
  });
}

async function checkNotifications() {
  const { count } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .eq('read', false);

  if (count > 0) {
    const badge = document.getElementById('notif-count');
    badge.textContent = count > 9 ? '9+' : count;
    badge.classList.remove('hidden');
  }
}

async function markAllRead() {
  await db
    .from('notifications')
    .update({ read: true })
    .eq('user_id', currentUser.id);

  document.getElementById('notif-count').classList.add('hidden');
  loadNotifications();
}

// ============ PROFILE ============

async function loadProfilePage(userId) {
  // Default to current user if no ID provided
  if (!userId && currentUser) userId = currentUser.id;
  if (!userId) {
    toast('No user found', 'error');
    return;
  }

  // Show profile page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-profile').classList.add('active');
  document.getElementById('nav-profile')?.classList.add('active');
  document.getElementById('mnav-profile')?.classList.add('active');

  const content = document.getElementById('profile-content');
  content.innerHTML = '<div class="feed-loading"><div class="spinner"></div></div>';

  try {
    // Fetch profile, posts, follower count, and following count in parallel
    const [profileRes, postsRes, followersRes, followingRes] = await Promise.all([
      db.from('profiles').select('*').eq('id', userId).maybeSingle(),
      db.from('posts')
        .select(POST_SELECT)
        .eq('user_id', userId)
        .is('reply_to', null)
        .order('created_at', { ascending: false })
        .limit(30),
      db.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
      db.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);

    const profile = profileRes.data;

    if (!profile) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🤷</div>
          <p>Profile not found!<br>This user might not exist yet.</p>
        </div>`;
      return;
    }

    const posts = postsRes.data || [];
    const followersCount = followersRes.count || 0;
    const followingCount = followingRes.count || 0;

    // Check if current user is following this profile
    let isFollowing = false;
    if (currentUser && userId !== currentUser.id) {
      const { data: followRow } = await db
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId)
        .maybeSingle();
      isFollowing = !!followRow;
    }

    const avatarIdx = hashStr(userId) % 8;
    const isOwn = userId === currentUser?.id;

    content.innerHTML = `
      <div class="profile-header">
        <div class="profile-banner-default"></div>
        <div class="profile-avatar-wrap">
          <div class="profile-avatar-img ${AV_COLORS[avatarIdx]}">${AVATARS[avatarIdx]}</div>
        </div>
        <div class="profile-actions">
          ${isOwn
            ? `<button class="follow-btn" onclick="editProfile()">Edit Profile</button>`
            : `<button class="follow-btn ${isFollowing ? 'following' : ''}" id="follow-btn-${userId}"
                onclick="toggleFollow('${userId}', ${isFollowing})">${isFollowing ? 'Following' : 'Follow'}</button>`}
        </div>
      </div>
      <div class="profile-info">
        <div class="profile-display">${escHtml(profile.display_name || '?')} ${profile.verified ? '✅' : ''}</div>
        <div class="profile-handle">@${profile.username || '?'}</div>
        ${profile.bio ? `<div class="profile-bio">${escHtml(profile.bio)}</div>` : ''}
        <div class="profile-stats">
          <span class="profile-stat"><strong>${followingCount}</strong> <span>Following</span></span>
          <span class="profile-stat"><strong>${followersCount}</strong> <span>Followers</span></span>
          <span class="profile-stat"><strong>${posts.length}</strong> <span>Talks</span></span>
        </div>
      </div>
      <div id="profile-posts-feed" class="feed"></div>
    `;

    const profileFeed = document.getElementById('profile-posts-feed');

    if (!posts.length) {
      profileFeed.innerHTML = '<div class="empty-state"><div class="empty-icon">🤫</div><p>No talks yet</p></div>';
    } else {
      posts.forEach(p => profileFeed.appendChild(renderPost(p)));
    }

  } catch (err) {
    console.error('Profile load error:', err);
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Something went wrong loading this profile</p>
      </div>`;
  }
}

async function toggleFollow(userId, currently) {
  const btn = document.getElementById(`follow-btn-${userId}`);

  if (currently) {
    await db.from('follows').delete().match({ follower_id: currentUser.id, following_id: userId });
    btn.textContent = 'Follow';
    btn.classList.remove('following');
    toast('Unfollowed', 'success');
  } else {
    await db.from('follows').insert({ follower_id: currentUser.id, following_id: userId });
    btn.textContent = 'Following';
    btn.classList.add('following');
    toast('Following! 🎉', 'success');

    await db.from('notifications').insert({
      user_id: userId,
      actor_id: currentUser.id,
      type: 'follow'
    });
  }

  // Update the onclick with the new follow state (true/false as boolean, not string)
  btn.onclick = () => toggleFollow(userId, !currently);
}

function editProfile() {
  const bio = prompt('Update your bio:', currentProfile?.bio || '');
  if (bio === null) return; // user cancelled

  db.from('profiles')
    .update({ bio })
    .eq('id', currentUser.id)
    .then(() => {
      if (currentProfile) currentProfile.bio = bio;
      toast('Profile updated! ✨', 'success');
      loadProfilePage(currentUser.id);
    });
}

// ============ WHO TO FOLLOW ============

async function loadWhoToFollow() {
  // Get the list of people we already follow
  const { data: followingData } = await db
    .from('follows')
    .select('following_id')
    .eq('follower_id', currentUser.id);

  const followingIds = followingData?.map(f => f.following_id) || [];
  followingIds.push(currentUser.id); // exclude ourselves

  let query = db.from('profiles').select('*').limit(4);

  // Only exclude followed users if there are any
  if (followingIds.length > 0) {
    query = query.not('id', 'in', `(${followingIds.join(',')})`);
  }

  const { data: suggestions } = await query;

  const list = document.getElementById('who-to-follow');

  if (!suggestions?.length) {
    list.innerHTML = '<div style="padding:12px 16px;color:var(--text-muted);font-size:0.875rem">No suggestions yet 🤷</div>';
    return;
  }

  list.innerHTML = '';
  suggestions.forEach(u => list.appendChild(renderWhoItem(u)));
}

function renderWhoItem(u) {
  const avatarIdx = hashStr(u.id) % 8;
  const el = document.createElement('div');
  el.className = 'who-item';
  el.innerHTML = `
    <div class="who-avatar ${AV_COLORS[avatarIdx]}" onclick="loadProfilePage('${u.id}')" style="cursor:pointer">${AVATARS[avatarIdx]}</div>
    <div class="who-info">
      <div class="who-name">${escHtml(u.display_name)}</div>
      <div class="who-handle">@${u.username}</div>
    </div>
    <button class="follow-btn" onclick="quickFollow('${u.id}', this)">Follow</button>
  `;
  return el;
}

async function quickFollow(userId, btn) {
  // Prevent double-follow if button already clicked
  if (btn.classList.contains('following')) return;

  const { error } = await db
    .from('follows')
    .insert({ follower_id: currentUser.id, following_id: userId });

  if (!error) {
    btn.textContent = 'Following';
    btn.classList.add('following');
    toast('Following! 🎉', 'success');
  }
}

// ============ TRENDING SIDEBAR ============

function loadTrending() {
  const el = document.getElementById('trending-sidebar');
  el.innerHTML = STATIC_TRENDING.slice(0, 5).map(t => `
    <div class="trending-mini-item" onclick="searchHashtag('${t.tag}')">
      ${t.tag}
      <span class="trending-mini-count">${t.count}</span>
    </div>
  `).join('');
}

// ============ REALTIME ============

function subscribeRealtime() {
  // Remove any existing channel before creating a new one
  if (realtimeChannel) db.removeChannel(realtimeChannel);

  realtimeChannel = db
    .channel('public:posts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
      // Skip if it's our own post (already shown after createPost)
      if (payload.new.user_id === currentUser.id) return;
      // Skip if we're not on the home page
      if (!document.getElementById('page-home').classList.contains('active')) return;

      const { data: newPost } = await db
        .from('posts')
        .select(POST_SELECT)
        .eq('id', payload.new.id)
        .single();

      if (newPost && !newPost.reply_to) {
        document.getElementById('feed').prepend(renderPost(newPost));
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
      // Show notification badge when we receive a new notification
      if (payload.new.user_id === currentUser.id) {
        checkNotifications();
      }
    })
    .subscribe();
}

// ============ MODALS ============

function openPostModal() {
  document.getElementById('post-modal').classList.remove('hidden');

  // Set the modal compose avatar
  const avatarIdx = hashStr(currentUser.id) % 8;
  const avatar = document.getElementById('modal-avatar');
  avatar.className = `compose-avatar ${AV_COLORS[avatarIdx]}`;
  avatar.textContent = AVATARS[avatarIdx];

  setTimeout(() => document.getElementById('modal-compose-text').focus(), 100);
}

function closePostModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('post-modal').classList.add('hidden');
  document.getElementById('modal-compose-text').value = '';
}

// ============ CHAR COUNTER ============

function updateCharCount() {
  const text = document.getElementById('compose-text').value;
  updateRing('char-ring-fill', 'char-count-num', text.length);
}

function updateModalCharCount() {
  const text = document.getElementById('modal-compose-text').value;
  updateRing('modal-char-ring', null, text.length);
}

function updateRing(ringId, numId, len) {
  const max = 280;
  const circumference = 94.25;
  const offset = circumference - (len / max) * circumference;
  const ring = document.getElementById(ringId);
  if (!ring) return;
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = len > 260 ? '#e03131' : len > 220 ? '#e67700' : 'var(--red)';

  if (numId) {
    const num = document.getElementById(numId);
    if (len > 220) {
      num.textContent = max - len;
      num.classList.remove('hidden');
    } else {
      num.classList.add('hidden');
    }
  }
}

function resetCharCounter() {
  const ring = document.getElementById('char-ring-fill');
  if (ring) {
    ring.style.strokeDashoffset = '94.25';
    ring.style.stroke = 'var(--red)';
  }
  document.getElementById('char-count-num')?.classList.add('hidden');
}

// ============ SIDEBAR USER ============

function updateSidebarUser() {
  if (!currentProfile) return;
  const avatarIdx = hashStr(currentUser.id) % 8;
  const avatar = document.getElementById('sidebar-avatar');
  avatar.className = `sidebar-avatar ${AV_COLORS[avatarIdx]}`;
  avatar.textContent = AVATARS[avatarIdx];
  document.getElementById('sidebar-display').textContent = currentProfile.display_name;
  document.getElementById('sidebar-handle').textContent = `@${currentProfile.username}`;
}

function updateComposeAvatars() {
  const avatarIdx = hashStr(currentUser.id) % 8;
  ['compose-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.className = `compose-avatar ${AV_COLORS[avatarIdx]}`;
      el.textContent = AVATARS[avatarIdx];
    }
  });
}

// ============ TOAST ============

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ============ HELPERS ============

// Escape HTML to prevent XSS when rendering user content
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// Format post content: linkify hashtags and @mentions
function formatContent(text) {
  if (!text) return '';
  let escaped = escHtml(text);
  escaped = escaped.replace(/#(\w+)/g, '<span class="hashtag" onclick="searchHashtag(\'#$1\')">#$1</span>');
  escaped = escaped.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  return escaped;
}

// Human-friendly relative time (e.g. "5m", "2h", "3d")
function getTimeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-TT', { month: 'short', day: 'numeric' });
}

// Simple hash of a string to a number (used to pick consistent avatar colours)
function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Close modals on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closePostModal();
    closeCommentModal();
  }
});