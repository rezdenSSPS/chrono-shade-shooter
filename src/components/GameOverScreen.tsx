
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
    <div className="text-center text-white">
      <h1 className="text-5xl font-bold mb-4 text-red-400">GAME OVER</h1>
      <p className="text-3xl mb-8">Final Time: <span className="text-yellow-400 font-bold">{score}s</span></p>
      
      {!hasSubmitted ? (
        <div className="mb-8">
          <p className="text-lg mb-4">Enter your name for the leaderboard:</p>
          <div className="flex justify-center items-center space-x-4">
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name"
              className="max-w-xs bg-white text-black"
              onKeyPress={(e) => e.key === 'Enter' && submitScore()}
            />
            <Button
              onClick={submitScore}
              disabled={isSubmitting}
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <p className="text-green-400 text-lg mb-4">✓ Score submitted successfully!</p>
        </div>
      )}

      <div className="space-y-4">
        <Button
          onClick={onShowLeaderboard}
          className="bg-blue-500 hover:bg-blue-600 text-white text-lg px-6 py-3"
        >
          VIEW LEADERBOARD
        </Button>
        <br />
        <Button
          onClick={onBackToMenu}
          variant="outline"
          className="border-white text-white hover:bg-white hover:text-black"
        >
          BACK TO MENU
        </Button>
      </div>
    </div>
  );
};

export default GameOverScreen;
