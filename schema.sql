-- Ole Talk Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES TABLE
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text not null,
  bio text default '',
  avatar_seed text default 'default',
  header_color text default '#c0392b',
  verified boolean default false,
  created_at timestamp with time zone default timezone('utc', now())
);

-- POSTS TABLE
create table posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  content text not null check (char_length(content) <= 280),
  image_url text,
  reply_to uuid references posts(id) on delete set null,
  repost_of uuid references posts(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- LIKES TABLE
create table likes (
  user_id uuid references profiles(id) on delete cascade not null,
  post_id uuid references posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc', now()),
  primary key (user_id, post_id)
);

-- REPOSTS TABLE
create table reposts (
  user_id uuid references profiles(id) on delete cascade not null,
  post_id uuid references posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc', now()),
  primary key (user_id, post_id)
);

-- FOLLOWS TABLE
create table follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc', now()),
  primary key (follower_id, following_id),
  check (follower_id != following_id)
);

-- COMMENTS TABLE
create table comments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  post_id uuid references posts(id) on delete cascade not null,
  content text not null check (char_length(content) <= 280),
  created_at timestamp with time zone default timezone('utc', now())
);

-- NOTIFICATIONS TABLE
create table notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  actor_id uuid references profiles(id) on delete cascade not null,
  type text not null check (type in ('like', 'repost', 'follow', 'comment', 'mention')),
  post_id uuid references posts(id) on delete cascade,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ROW LEVEL SECURITY
alter table profiles enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table reposts enable row level security;
alter table follows enable row level security;
alter table comments enable row level security;
alter table notifications enable row level security;

-- PROFILES POLICIES
create policy "Profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);

-- POSTS POLICIES
create policy "Posts are viewable by everyone" on posts for select using (true);
create policy "Authenticated users can insert posts" on posts for insert with check (auth.uid() = user_id);
create policy "Users can delete their own posts" on posts for delete using (auth.uid() = user_id);

-- LIKES POLICIES
create policy "Likes are viewable by everyone" on likes for select using (true);
create policy "Authenticated users can like" on likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike" on likes for delete using (auth.uid() = user_id);

-- REPOSTS POLICIES
create policy "Reposts are viewable by everyone" on reposts for select using (true);
create policy "Authenticated users can repost" on reposts for insert with check (auth.uid() = user_id);
create policy "Users can undo repost" on reposts for delete using (auth.uid() = user_id);

-- FOLLOWS POLICIES
create policy "Follows are viewable by everyone" on follows for select using (true);
create policy "Authenticated users can follow" on follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on follows for delete using (auth.uid() = follower_id);

-- COMMENTS POLICIES
create policy "Comments are viewable by everyone" on comments for select using (true);
create policy "Authenticated users can comment" on comments for insert with check (auth.uid() = user_id);
create policy "Users can delete their own comments" on comments for delete using (auth.uid() = user_id);

-- NOTIFICATIONS POLICIES
create policy "Users can view their own notifications" on notifications for select using (auth.uid() = user_id);
create policy "System can insert notifications" on notifications for insert with check (true);
create policy "Users can mark notifications as read" on notifications for update using (auth.uid() = user_id);

-- HANDLE NEW USER TRIGGER (auto-create profile)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_seed)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'display_name',
    new.id::text
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- SEED SOME TRENDING TOPICS (optional - just metadata, posts drive hashtags)
-- Trending is computed dynamically from posts in the last 24h

-- INDEXES for performance
create index posts_user_id_idx on posts(user_id);
create index posts_created_at_idx on posts(created_at desc);
create index likes_post_id_idx on likes(post_id);
create index reposts_post_id_idx on reposts(post_id);
create index comments_post_id_idx on comments(post_id);
create index follows_follower_idx on follows(follower_id);
create index follows_following_idx on follows(following_id);
create index notifications_user_id_idx on notifications(user_id, read);
