-- WARNING: Deletes ALL data from ALL tables. Irreversible.
-- Run this in the Supabase SQL Editor to start fresh.

DELETE FROM duel_games;
DELETE FROM challenge_links;
DELETE FROM messages;
DELETE FROM friendships;
DELETE FROM completed_games;
DELETE FROM games;
DELETE FROM room_players;
DELETE FROM rooms;
DELETE FROM profiles;

-- Also clean auth users (optional — remove comment if needed)
-- DELETE FROM auth.users;
