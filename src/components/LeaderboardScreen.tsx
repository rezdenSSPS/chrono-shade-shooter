
import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardScreenProps {
  onBackToMenu: () => void;
}

interface LeaderboardEntry {
  id: string;
  player_name: string;
  score: number;
  created_at: string;
}

const LeaderboardScreen = ({ onBackToMenu }: LeaderboardScreenProps) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold mb-8">LEADERBOARD</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="text-center text-white max-w-md mx-auto">
      <h1 className="text-4xl font-bold mb-8">LEADERBOARD</h1>
      
      <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-white">
        {leaderboard.length === 0 ? (
          <p className="text-gray-400">No scores yet. Be the first!</p>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex justify-between items-center p-3 rounded ${
                  index === 0 ? 'bg-yellow-600' : 
                  index === 1 ? 'bg-gray-400' : 
                  index === 2 ? 'bg-orange-600' : 'bg-gray-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-lg">#{index + 1}</span>
                  <span className="text-lg">{entry.player_name}</span>
                </div>
                <span className="font-bold text-xl">{entry.score}s</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        onClick={onBackToMenu}
        className="bg-white text-black hover:bg-gray-200 text-lg px-6 py-3"
      >
        BACK TO MENU
      </Button>
    </div>
  );
};

export default LeaderboardScreen;
