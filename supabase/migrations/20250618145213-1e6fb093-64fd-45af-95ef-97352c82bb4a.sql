
-- Create leaderboard table for storing high scores
CREATE TABLE public.leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (but allow public read access for leaderboards)
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view leaderboard scores
CREATE POLICY "Anyone can view leaderboard" 
  ON public.leaderboard 
  FOR SELECT 
  USING (true);

-- Allow anyone to insert their score
CREATE POLICY "Anyone can submit scores" 
  ON public.leaderboard 
  FOR INSERT 
  WITH CHECK (true);

-- Create index for faster leaderboard queries
CREATE INDEX idx_leaderboard_score ON public.leaderboard(score DESC);
