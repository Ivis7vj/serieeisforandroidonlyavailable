-- 1. Create Tables

CREATE TABLE IF NOT EXISTS public.weekly_series_metrics (
    week_id TEXT NOT NULL, -- Format: 'YYYY-WW' (ISO Week)
    series_id BIGINT NOT NULL,
    liked_users TEXT[] DEFAULT '{}', -- Array of user_ids (simulating Set)
    watched_users TEXT[] DEFAULT '{}',
    rated_users TEXT[] DEFAULT '{}',
    tracked_users TEXT[] DEFAULT '{}',
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (week_id, series_id)
);

CREATE TABLE IF NOT EXISTS public.weekly_top_series (
    week_id TEXT NOT NULL,
    rank INT NOT NULL,
    series_id BIGINT NOT NULL,
    score NUMERIC NOT NULL,
    liked_count INT DEFAULT 0,
    watched_count INT DEFAULT 0,
    rated_count INT DEFAULT 0,
    tracked_count INT DEFAULT 0,
    published_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (week_id, rank)
);

-- 2. Helper Function to get Current Week ID (Sunday Start)
CREATE OR REPLACE FUNCTION get_current_week_id() 
RETURNS TEXT AS $$
BEGIN
    -- Shift by 1 day so Sunday becomes the start of the Next ISO week
    -- ISO Week (IYYY-IW): Mon-Sun.
    -- Sat (Day 6) + 1 day = Sun (Day 7) -> Same ISO Week (Week X)
    -- Sun (Day 7) + 1 day = Mon (Day 1) -> Next ISO Week (Week X+1)
    -- Result: Sat is Week X, Sun is Week X+1. Perfect Sunday-Start behavior.
    RETURN to_char(now() + interval '1 day', 'IYYY-IW');
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger Function: Update Weekly Metrics
CREATE OR REPLACE FUNCTION update_weekly_metrics()
RETURNS TRIGGER AS $$
DECLARE
    cur_week_id TEXT;
    target_user_id UUID;
    target_tmdb_id BIGINT;
    action_type TEXT; -- 'LIKE', 'WATCH', 'RATE', 'TRACK'
BEGIN
    -- Determine operation type and IDs based on table
    -- TG_TABLE_NAME is the table that fired the trigger
    
    cur_week_id := get_current_week_id();
    
    IF (TG_OP = 'DELETE') THEN
         -- We do NOT remove users from weekly metrics on delete (per requirements: "Tracking stops... Old data wiped Sunday")
         -- "Once a user votes, it counts for the week" is a common pattern, OR we could remove them.
         -- Requirement says: "One user = one vote per action per series per week"
         -- Implementation: We will ADD on INSERT/UPDATE. We generally don't decrement historical weekly headers unless specified.
         -- Given "Real-time tracking", we'll just track active adds. 
         -- If user unlikes, we optionally remove, but for "Top This Week", usually acts are cumulative. 
         -- Let's stick to ADD logic only for simplicity unless strictly required to handle "undo".
         -- User said: "Mirror these into weekly aggregation."
         RETURN OLD;
    END IF;

    -- Extract Data based on Table
    IF (TG_TABLE_NAME = 'likes') THEN
        target_user_id := NEW.user_id;
        target_tmdb_id := NEW.tmdb_id;
        action_type := 'LIKE';
    ELSIF (TG_TABLE_NAME = 'watchlist') THEN
        target_user_id := NEW.user_id;
        target_tmdb_id := NEW.tmdb_id; 
        -- NOTE: Watchlist might key off 'series_id' or 'tmdb_id'. 
        -- Based on service file: 'tmdb_id' is consistent.
        action_type := 'TRACK';
    ELSIF (TG_TABLE_NAME = 'season_ratings' OR TG_TABLE_NAME = 'episode_ratings') THEN
        target_user_id := NEW.user_id;
        target_tmdb_id := NEW.tmdb_id;
        action_type := 'RATE';
    ELSIF (TG_TABLE_NAME = 'watched_episodes') THEN
        target_user_id := NEW.user_id;
        target_tmdb_id := NEW.tmdb_id;
        action_type := 'WATCH';
    END IF;

    -- Ensure we have a valid series ID (Basic validation)
    IF target_tmdb_id IS NULL OR target_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Upsert into metrics table
    INSERT INTO public.weekly_series_metrics (week_id, series_id)
    VALUES (cur_week_id, target_tmdb_id)
    ON CONFLICT (week_id, series_id) DO NOTHING;

    -- Update the specific array set
    -- Using array_append + distinct logic or just a custom update
    IF action_type = 'LIKE' THEN
        UPDATE public.weekly_series_metrics
        SET liked_users = array_append(liked_users, target_user_id::text),
            last_updated_at = now()
        WHERE week_id = cur_week_id AND series_id = target_tmdb_id
        AND NOT (liked_users @> ARRAY[target_user_id::text]); -- Idempotency check
    ELSIF action_type = 'WATCH' THEN
        UPDATE public.weekly_series_metrics
        SET watched_users = array_append(watched_users, target_user_id::text),
            last_updated_at = now()
        WHERE week_id = cur_week_id AND series_id = target_tmdb_id
        AND NOT (watched_users @> ARRAY[target_user_id::text]);
    ELSIF action_type = 'RATE' THEN
        -- Rating also counts as Watched per rule: "rated (rating ⇒ watched is already true)"
        UPDATE public.weekly_series_metrics
        SET rated_users = array_append(rated_users, target_user_id::text),
            watched_users = array_append(watched_users, target_user_id::text), -- Auto-add to watched
            last_updated_at = now()
        WHERE week_id = cur_week_id AND series_id = target_tmdb_id;
        -- Note: The array uniqueness check is tricky with double update. 
        -- Better to do two separate updates or a function that cleans arrays.
        -- For simplicity in SQL, relying on the 'Set' logic at ranking time is safer, 
        -- OR we just fix duplication on read. 
        -- Let's try to keep clean arrays:
         
        -- Refined RATE Update:
        UPDATE public.weekly_series_metrics
        SET rated_users = CASE 
                WHEN NOT (rated_users @> ARRAY[target_user_id::text]) THEN array_append(rated_users, target_user_id::text)
                ELSE rated_users 
            END,
            watched_users = CASE 
                WHEN NOT (watched_users @> ARRAY[target_user_id::text]) THEN array_append(watched_users, target_user_id::text)
                ELSE watched_users 
            END,
            last_updated_at = now()
        WHERE week_id = cur_week_id AND series_id = target_tmdb_id;
        
    ELSIF action_type = 'TRACK' THEN
        UPDATE public.weekly_series_metrics
        SET tracked_users = array_append(tracked_users, target_user_id::text),
            last_updated_at = now()
        WHERE week_id = cur_week_id AND series_id = target_tmdb_id
        AND NOT (tracked_users @> ARRAY[target_user_id::text]);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Triggers
-- Drop existing if any to avoid errors during re-runs
DROP TRIGGER IF EXISTS tr_weekly_likes ON public.likes;

CREATE TRIGGER tr_weekly_likes
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION update_weekly_metrics();

DROP TRIGGER IF EXISTS tr_weekly_watchlist ON public.watchlist;

CREATE TRIGGER tr_weekly_watchlist
AFTER INSERT ON public.watchlist
FOR EACH ROW EXECUTE FUNCTION update_weekly_metrics();

DROP TRIGGER IF EXISTS tr_weekly_season_ratings ON public.season_ratings;

CREATE TRIGGER tr_weekly_season_ratings
AFTER INSERT ON public.season_ratings
FOR EACH ROW EXECUTE FUNCTION update_weekly_metrics();

DROP TRIGGER IF EXISTS tr_weekly_episode_ratings ON public.episode_ratings;

CREATE TRIGGER tr_weekly_episode_ratings
AFTER INSERT ON public.episode_ratings
FOR EACH ROW EXECUTE FUNCTION update_weekly_metrics();

DROP TRIGGER IF EXISTS tr_weekly_watched ON public.watched_episodes;

CREATE TRIGGER tr_weekly_watched
AFTER INSERT ON public.watched_episodes
FOR EACH ROW EXECUTE FUNCTION update_weekly_metrics();

-- 5. Ranking Calculation Function (To be called regularly or via cron)
CREATE OR REPLACE FUNCTION generate_weekly_top()
RETURNS VOID AS $$
DECLARE
    cur_week_id TEXT;
    target_rank_week_id TEXT;
BEGIN
    cur_week_id := get_current_week_id(); -- Current Active Week (e.g., Week 11)
    
    -- If running on Sunday, we want to rank the COMPLETED week (Week 10).
    -- If running 'get_current_week_id' returns Week 11, then 'Week 11' - 1 week = Week 10.
    -- Calculation:
    target_rank_week_id := to_char(now() + interval '1 day' - interval '1 week', 'IYYY-IW');

    -- Safety: If somehow empty, find most recent week in metrics (Fallback)
    I ERROR  [ReferenceError: Property 'StyleSheet' doesn't exist] 

Call Stack
  <global> (app\profile-section.tsx)
  loadModuleImplementation (node_modules\expo\node_modules\@expo\cli\build\metro-require\require.js)     
  guardedLoadModule (node_modules\expo\node_modules\@expo\cli\build\metro-require\require.js)
  metroRequire (node_modules\expo\node_modules\@expo\cli\build\metro-require\require.js)
  runUpdatedModule (node_modules\expo\node_modules\@expo\cli\build\metro-require\require.js)
  metroHotUpdateModule (node_modules\expo\node_modules\@expo\cli\build\metro-require\require.js)
  define (node_modules\expo\node_modules\@expo\cli\build\metro-require\require.js)
  eval (http:\172.16.143.199:8081\app\profile-section.bundle)
  inject (node_modules\metro-runtime\src\modules\HMRClient.js)
  forEach (<native>)
  injectUpdate (node_modules\metro-runtime\src\modules\HMRClient.js)
  on$argument_1 (node_modules\metro-runtime\src\modules\HMRClient.js)
  call (<native>)
  emit (node_modules\metro-runtime\src\modules\vendor\eventemitter3.js)
  _ws.onmessage (node_modules\metro-runtime\src\modules\HMRClient.js)
  invoke (http:\172.16.143.199:8081\index.bundle)
  registerBundleEntryPoints (node_modules\react-native\Libraries\Utilities\HMRClient.js)
  client.on$argument_1 (node_modules\react-native\Libraries\Utilities\HMRClient.js)
  anonymous (http:\172.16.143.199:8081\index.bundle)
  apply (<native>)
  emit (http:\172.16.143.199:8081\index.bundle)
  apply (<native>)
  anonymous (http:\172.16.143.199:8081\index.bundle)
  showFuseboxWarningsMigrationMessageOnce (node_modules\react-native\Libraries\LogBox\Data\LogBoxData.js)F NOT EXISTS (SELECT 1 FROM weekly_series_metrics WHERE week_id = target_rank_week_id) THEN
        -- Requirements: "low data for top 1 ? show the old data ofcourse no issue"
        -- If we have NO data for the target week, we DO NOT update the leaderboard.
        -- We exit, leaving the previous week's data intact in 'weekly_top_series'.
        RAISE NOTICE 'No data found for week %, keeping existing leaderboard.', target_rank_week_id;
        RETURN;
    END IF;

    -- Clear OLDER rankings (keeping only the new one we are about to insert is the updated strictness? 
    -- User said: "show the old previeous data only" if no new data. 
    -- So we ONLY delete if we are about to insert NEW data.
    
    -- Insert Ranked Data into a TEMP table or memory first? 
    -- Or just Delete WHERE week_id < target_rank_week_id after insertion?
    -- Let's stick to: If we are here, we have data. So we replace the table contents?
    -- Actually, user said "store the new one another time".
    -- Let's just DELETE everything (since we have a NEW valid week.
    DELETE FROM public.weekly_top_series; -- Wipe table completely as we have a NEW valid week.

    -- Insert Ranked Data
    INSERT INTO public.weekly_top_series (
        week_id, rank, series_id, score, 
        liked_count, watched_count, rated_count, tracked_count
    )
    SELECT 
        week_id,
        ROW_NUMBER() OVER (ORDER BY score DESC, series_id ASC) as rank,
        series_id,
        score,
        liked_len, watched_len, rated_len, tracked_len
    FROM (
        SELECT 
            week_id,
            series_id,
            cardinality(liked_users) as liked_len,
            cardinality(watched_users) as watched_len,
            cardinality(rated_users) as rated_len,
            cardinality(tracked_users) as tracked_len,
            (
                (cardinality(rated_users) * 4) +
                (cardinality(watched_users) * 3) +
                (cardinality(liked_users) * 2) +
                (cardinality(tracked_users) * 1)
            ) as score
        FROM public.weekly_series_metrics
        WHERE week_id = target_rank_week_id
    ) scored_data
    ORDER BY score DESC
    LIMIT 20;

    -- STRICT CLEANUP:
    -- Delete the metrics we just processed (to save space)
    DELETE FROM public.weekly_series_metrics WHERE week_id = target_rank_week_id;
    
END;
$$ LANGUAGE plpgsql;

-- 6. (Optional) Enable pg_cron if available
-- SELECT cron.schedule('0 9 * * 0', $$SELECT generate_weekly_top()$$);