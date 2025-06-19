
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
    
    // Set up real-time subscription
    const channel = supabase
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard'
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      <div className="text-center text-white bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col justify-center items-center">
        <h1 className="text-5xl font-bold mb-8 text-cyan-400">🏆 HALL OF HEROES</h1>
        <p className="text-xl">⏳ Loading champions...</p>
      </div>
    );
  }

  return (
    <div className="text-center text-white bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col justify-center items-center py-8">
      <h1 className="text-5xl font-bold mb-8 text-cyan-400">🏆 HALL OF HEROES</h1>
      
      <div className="bg-black/60 rounded-2xl p-8 mb-8 border-2 border-cyan-400 shadow-2xl max-w-2xl w-full mx-4">
        {leaderboard.length === 0 ? (
          <p className="text-gray-400 text-xl">🎯 No champions yet. Be the first legend!</p>
        ) : (
          <div className="space-y-4">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex justify-between items-center p-4 rounded-xl transform transition-all hover:scale-105 ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-black' : 
                  index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-300 text-black' : 
                  index === 2 ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-black' : 
                  'bg-gradient-to-r from-gray-700 to-gray-600 text-white'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl font-bold">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-bold">{entry.player_name}</div>
                    <div className="text-sm opacity-75">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-bold">
                  ⏱️ {entry.score}s
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        onClick={onBackToMenu}
        className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-xl px-8 py-4 rounded-xl font-bold"
      >
        🏠 BACK TO MENU
      </Button>
    </div>
  );
};

export default LeaderboardScreen;
