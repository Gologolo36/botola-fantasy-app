"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Player {
  id: string;
  name: string;
  team: string;
  position?: string;
  jerseyNumber?: number;
  imageUrl?: string; // Optional: for player images
}

// Mock data for Botola Pro players
const mockPlayers: Player[] = [
  { id: '1', name: 'Yahya Jabrane', team: 'Wydad AC', position: 'Midfielder', jerseyNumber: 5, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: 'soccer player' },
  { id: '2', name: 'Anas Zniti', team: 'Raja CA', position: 'Goalkeeper', jerseyNumber: 1, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: 'athlete portrait' },
  { id: '3', name: 'Yousri Bouzok', team: 'Raja CA', position: 'Winger', jerseyNumber: 7, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: 'soccer action' },
  { id: '4', name: 'Rabie Hrimat', team: 'FAR Rabat', position: 'Midfielder', jerseyNumber: 8, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: 'sports game' },
  { id: '5', name: 'Youssef El Motie', team: 'Wydad AC', position: 'Goalkeeper', jerseyNumber: 12, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: 'goal keeper' },
  { id: '6', name: 'Diney Borges', team: 'FAR Rabat', position: 'Defender', jerseyNumber: 4, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: 'soccer match' },
  { id: '7', name: 'Ayoub El Amloud', team: 'Wydad AC', position: 'Defender', jerseyNumber: 22, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: 'player running' },
  { id: '8', name: 'Mohamed Zrida', team: 'Raja CA', position: 'Midfielder', jerseyNumber: 18, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: 'midfielder action' },
];

export default function BotolaRosterPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlayers(mockPlayers);
      setLoading(false);
    }, 1500); // Simulate API call

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col items-center bg-background text-foreground">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl md:text-6xl">
          Botola Pro Players
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl">
          Discover the stars of Moroccan football.
        </p>
      </header>
      
      <div 
        id="playersList"
        style={{ textAlign: 'left', width: '100%', maxWidth: '700px', marginTop: '20px' }}
        className={`
          transition-opacity duration-1000 ease-in-out 
          ${loading ? 'opacity-0' : 'opacity-100'}
        `}
      >
        {loading ? (
          <Card className="shadow-xl border-none">
            <CardHeader>
              <Skeleton className="h-8 w-3/5 mx-auto bg-muted/50" />
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border border-border rounded-lg bg-card">
                  <Skeleton className="h-16 w-16 rounded-full bg-muted/50" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-4/5 bg-muted/50" />
                    <Skeleton className="h-4 w-3/5 bg-muted/50" />
                    <Skeleton className="h-4 w-1/2 bg-muted/50" />
                  </div>
                </div>
              ))}
              <p className="text-lg text-muted-foreground text-center pt-4">Loading players...</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl border-none bg-card overflow-hidden">
            <CardHeader className="bg-primary p-0">
              <CardTitle className="text-2xl text-center text-primary-foreground py-6">
                Player Roster
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {players.length > 0 ? (
                <ul className="divide-y divide-border">
                  {players.map((player) => (
                    <li 
                      key={player.id} 
                      className="p-6 hover:bg-accent/10 transition-colors duration-200 flex items-center space-x-6"
                      aria-label={`Player: ${player.name}, Team: ${player.team}`}
                    >
                      {player.imageUrl && (
                        // Using a simple img tag for placeholder, next/image would be for optimized images
                        <img 
                          src={player.imageUrl} 
                          alt={player.name} 
                          className="h-20 w-20 rounded-full object-cover border-2 border-primary/50 shadow-md"
                          data-ai-hint={player.dataAiHint || "sports person"}
                        />
                      )}
                      <div className="flex-grow">
                        <p className="text-xl font-semibold text-foreground">{player.name}</p>
                        <p className="text-md text-primary font-medium">{player.team}</p>
                        {player.position && <p className="text-sm text-muted-foreground">Position: {player.position}</p>}
                        {player.jerseyNumber && <p className="text-sm text-muted-foreground">Jersey: #{player.jerseyNumber}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-lg text-muted-foreground text-center p-10">No players found.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <footer className="mt-16 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Botola Roster. All rights reserved.</p>
      </footer>
    </div>
  );
}
