
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GameOverScreenProps {
  score: number;
  onBackToMenu: () => void;
  onShowLeaderboard: () => void;
}

const GameOverScreen = ({ score, onBackToMenu, onShowLeaderboard }: GameOverScreenProps) => {
  const [playerName, setPlayerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const { toast } = useToast();

  const submitScore = async () => {
    if (!playerName.trim()) {
      toast({
        title: "Enter your name",
        description: "Please enter a name to submit your score",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('leaderboard')
        .insert([
          {
            player_name: playerName.trim(),
            score: score
          }
        ]);

      if (error) throw error;

      toast({
        title: "Score submitted!",
        description: "Your score has been added to the leaderboard",
      });
      setHasSubmitted(true);
    } catch (error) {
      console.error('Error submitting score:', error);
      toast({
        title: "Error",
        description: "Failed to submit score. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="text-center text-white bg-gradient-to-b from-red-900 via-purple-900 to-black min-h-screen flex flex-col justify-center items-center">
      <div className="bg-black/60 p-8 rounded-2xl border-2 border-red-500 shadow-2xl">
        <h1 className="text-6xl font-bold mb-6 text-red-400 animate-pulse">💀 GAME OVER 💀</h1>
        <p className="text-4xl mb-8">Survival Time: <span className="text-yellow-400 font-bold">{score} seconds</span></p>
        
        {!hasSubmitted ? (
          <div className="mb-8">
            <p className="text-xl mb-4 text-cyan-300">🏆 Enter your name for the leaderboard:</p>
            <div className="flex justify-center items-center space-x-4">
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your warrior name"
                className="max-w-xs bg-gray-800 text-white border-cyan-400 text-lg"
                onKeyPress={(e) => e.key === 'Enter' && submitScore()}
              />
              <Button
                onClick={submitScore}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold px-6 py-3"
              >
                {isSubmitting ? '⏳ Submitting...' : '🚀 Submit'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <p className="text-green-400 text-2xl mb-4">✅ Score submitted successfully!</p>
          </div>
        )}

        <div className="space-y-4">
          <Button
            onClick={onShowLeaderboard}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white text-xl px-8 py-4 rounded-xl"
          >
            🏆 VIEW LEADERBOARD
          </Button>
          <br />
          <Button
            onClick={onBackToMenu}
            variant="outline"
            className="border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black text-lg px-6 py-3 rounded-xl"
          >
            🔄 BACK TO MENU
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;
