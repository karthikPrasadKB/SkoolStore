-- Non-food items (e.g. stationery): a food type of 'none' shows no veg / non-veg mark.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter type public.food_type add value if not exists 'none';
