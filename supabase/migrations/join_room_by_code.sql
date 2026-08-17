-- ============================================
-- Atomic Duo room-join RPC
-- ============================================
-- Fixes the Duo room-code join regression that appeared after P0-1 RLS
-- hardening. A client-side `INSERT ... ON CONFLICT DO UPDATE` on room_players
-- is rejected (403) because PostgREST upserts additionally evaluate the
-- member-only SELECT policy as a WITH-CHECK, which is FALSE for a fresh joiner.
--
-- This RPC moves the join into a single atomic, SECURITY DEFINER operation:
--   * identity is auth.uid() (never a client-supplied player_id)
--   * the room row is locked FOR UPDATE so concurrent joins serialize
--   * capacity + team/slot are computed server-side under the lock
--   * the player is inserted exactly once (PK guards duplicates)
--   * idempotent for re-joins
-- RLS table policies are NOT weakened. This is the only privileged join path.
--
-- Error contract (SQLSTATE -> client):
--   42501 UNAUTHORIZED   |  P0001 ROOM_NOT_FOUND / INVALID_CODE
--   P0002 ROOM_EXPIRED   |  P0003 ROOM_FULL
--   P0004 ROOM_NOT_JOINABLE | P0005 four-player room (use the seat lobby)
--
-- Deploy via Supabase SQL Editor. Idempotent — safe to re-run.
--
-- NOTE: every rooms column reference is qualified with v_room.<col> because the
-- RETURNS TABLE output columns (code/status/mode/...) shadow PL/pgSQL names and
-- would otherwise make `WHERE code = ...` ambiguous.

CREATE OR REPLACE FUNCTION public.join_room_by_code(p_code text)
RETURNS TABLE (
  room_id      uuid,
  code         text,
  team         text,
  slot         integer,
  status       text,
  mode         text,
  host_team    text,
  created_by   text,
  time_seconds integer,
  game_id      uuid,
  game_status  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_uid    text := auth.uid()::text;
  v_room   public.rooms%ROWTYPE;
  v_team   text;
  v_slot   integer;
  v_total  integer;
  v_white  integer;
  v_black  integer;
  v_code   text := upper(btrim(p_code));
BEGIN
  -- 1. Authenticate
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  -- 2. Code format (charset from generateRoomCode)
  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'INVALID_CODE' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Serialize all join attempts on this room (THE concurrency control).
  --    PostgREST wraps each RPC call in its own transaction, so this lock is
  --    held until the insert commits; the next caller sees the updated roster.
  SELECT * INTO v_room FROM public.rooms WHERE public.rooms.code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Validate room (four-player uses its seat lobby; reject here)
  IF v_room.mode = 'fourplayer' THEN
    RAISE EXCEPTION 'ROOM_NOT_JOINABLE' USING ERRCODE = 'P0005';
  END IF;
  IF v_room.status <> 'waiting' THEN
    RAISE EXCEPTION 'ROOM_NOT_JOINABLE' USING ERRCODE = 'P0004';
  END IF;
  IF v_room.expires_at IS NOT NULL AND v_room.expires_at < now() THEN
    RAISE EXCEPTION 'ROOM_EXPIRED' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Idempotent re-join: return existing assignment, never duplicate
  SELECT rp.team, rp.slot INTO v_team, v_slot
    FROM public.room_players rp
   WHERE rp.room_id = v_room.id AND rp.player_id = v_uid;
  IF FOUND THEN
    RETURN QUERY
      SELECT v_room.id, v_room.code, v_team, v_slot, v_room.status, v_room.mode,
             v_room.host_team, v_room.created_by, v_room.time_seconds,
             g.id, g.status::text
      FROM (SELECT 1) x LEFT JOIN public.games g ON g.room_id = v_room.id;
    RETURN;
  END IF;

  -- 6. Capacity + team/slot computed UNDER the lock
  SELECT count(*) FILTER (WHERE rp.team = 'WHITE'),
         count(*) FILTER (WHERE rp.team = 'BLACK'),
         count(*)
    INTO v_white, v_black, v_total
   FROM public.room_players rp WHERE rp.room_id = v_room.id;

  IF v_total >= 4 THEN
    RAISE EXCEPTION 'ROOM_FULL' USING ERRCODE = 'P0003';
  END IF;

  -- Server-side team assignment (mirrors the legacy client rule; host team first)
  IF v_white < 2 AND v_black < 2 THEN
    v_team := COALESCE(v_room.host_team, 'WHITE');
  ELSIF v_white < 2 THEN
    v_team := 'WHITE';
  ELSIF v_black < 2 THEN
    v_team := 'BLACK';
  ELSE
    RAISE EXCEPTION 'ROOM_FULL' USING ERRCODE = 'P0003';
  END IF;

  v_slot := (SELECT count(*) FROM public.room_players rp
              WHERE rp.room_id = v_room.id AND rp.team = v_team);

  -- 7. Insert exactly once (PK guards against any residual race). Target-less
  --    ON CONFLICT DO NOTHING is used because the room_players PK is the only
  --    unique constraint, and naming columns here would collide with the
  --    RETURNS TABLE output variables (room_id/player_id).
  INSERT INTO public.room_players (room_id, player_id, team, slot, status)
  VALUES (v_room.id, v_uid, v_team, v_slot, 'ready')
  ON CONFLICT DO NOTHING;

  RETURN QUERY
    SELECT v_room.id, v_room.code, v_team, v_slot, v_room.status, v_room.mode,
           v_room.host_team, v_room.created_by, v_room.time_seconds,
           g.id, g.status::text
    FROM (SELECT 1) x LEFT JOIN public.games g ON g.room_id = v_room.id;
END;
$$;

-- Expose ONLY to authenticated users (mirrors delete_my_account convention)
REVOKE EXECUTE ON FUNCTION public.join_room_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_room_by_code(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.join_room_by_code(text) TO authenticated;
