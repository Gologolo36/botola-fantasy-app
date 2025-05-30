
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { db } from '@/lib/firebase'; // Import the Firebase db instance
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'; // Import collection, getDocs, doc, getDoc, setDoc
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator'; // Added Separator

interface Player {
  id: string;
  name: string;
  team: string;
  position?: string;
  jerseyNumber?: number;
  imageUrl?: string; 
  dataAiHint?: string;
  price?: number; 
  points?: number; 
}

const MAX_TEAM_SIZE = 15;

export default function BotolaRosterPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // My Team state
  const [myTeamPlayerIds, setMyTeamPlayerIds] = useState<string[]>([]);
  const [myTeamPlayers, setMyTeamPlayers] = useState<Player[]>([]);
  const [myTeamLoading, setMyTeamLoading] = useState(false);

  const auth = getAuth(db.app);

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setEmail('');
        setPassword('');
        setMyTeamPlayerIds([]); // Clear team when user logs out
        setMyTeamPlayers([]);
      }
      setAuthMessage(currentUser ? `Logged in as ${currentUser.email}` : 'Please sign in or sign up.');
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const playersCollectionRef = collection(db, 'players'); 
        const playersSnapshot = await getDocs(playersCollectionRef); 
        const playersData = playersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Player, 'id'> 
        }));
        setPlayers(playersData);
      } catch (error) {
        console.error("Error fetching players: ", error);
        setAuthMessage("Error fetching players.");
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, []); 

  // Effect to load user's team from Firestore when user logs in
  useEffect(() => {
    if (!user || !isMounted) {
      setMyTeamLoading(false);
      return;
    }

    const loadUserTeam = async () => {
      setMyTeamLoading(true);
      setAuthMessage(''); // Clear previous messages
      try {
        const teamDocRef = doc(db, 'userTeams', user.uid);
        const teamDocSnap = await getDoc(teamDocRef);
        if (teamDocSnap.exists()) {
          const teamData = teamDocSnap.data();
          setMyTeamPlayerIds(teamData.playerIds || []);
        } else {
          setMyTeamPlayerIds([]); // No team saved yet
        }
      } catch (error) {
        console.error("Error loading user team:", error);
        setAuthMessage("Error loading your team.");
      } finally {
        setMyTeamLoading(false);
      }
    };
    loadUserTeam();
  }, [user, isMounted]); // Removed db from dependencies as it's stable

  // Effect to derive myTeamPlayers when players or myTeamPlayerIds change
  useEffect(() => {
    if (players.length > 0 && myTeamPlayerIds.length > 0) {
      const selectedPlayers = players.filter(p => myTeamPlayerIds.includes(p.id));
      // Ensure order is preserved or sort if necessary, for now, it depends on `players` order
      setMyTeamPlayers(selectedPlayers);
    } else {
      setMyTeamPlayers([]); // Clear if no players or no IDs
    }
  }, [players, myTeamPlayerIds]);


  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    setAuthMessage('');
    try {
      await signOut(auth);
    } catch (error: any)
    {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAddPlayerToTeam = async (playerToAdd: Player) => {
    if (!user) {
      setAuthMessage("You must be logged in to add players.");
      return;
    }
    if (myTeamPlayerIds.length >= MAX_TEAM_SIZE) {
      setAuthMessage(`Team is full (Max ${MAX_TEAM_SIZE} players).`);
      return;
    }
    if (myTeamPlayerIds.includes(playerToAdd.id)) {
      setAuthMessage(`${playerToAdd.name} is already in your team.`);
      return;
    }

    setAuthLoading(true); // Use authLoading for general async operations on team
    const newTeamPlayerIds = [...myTeamPlayerIds, playerToAdd.id];
    try {
      const teamDocRef = doc(db, 'userTeams', user.uid);
      await setDoc(teamDocRef, { playerIds: newTeamPlayerIds }, { merge: true });
      setMyTeamPlayerIds(newTeamPlayerIds); // This will trigger effect to update myTeamPlayers
      setAuthMessage(`${playerToAdd.name} added to your team!`);
    } catch (error) {
      console.error("Error adding player to team:", error);
      setAuthMessage("Failed to add player. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };
  
  if (!isMounted) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <Skeleton className="h-12 w-1/2 mb-4" />
        <Skeleton className="h-64 w-full max-w-md" />
      </div>
    );
  }

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

      <Card className="w-full max-w-md mb-10 shadow-xl border-none bg-card">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-primary-foreground bg-primary py-4 rounded-t-lg -mx-6 -mt-6 px-6">
            {user ? 'Welcome!' : 'Account'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {user ? (
            <div className="space-y-4 text-center">
              <p className="text-lg text-foreground">Welcome, {user.email}!</p>
              <Button onClick={handleSignOut} disabled={authLoading} className="w-full">
                {authLoading ? 'Signing Out...' : 'Sign Out'}
              </Button>
            </div>
          ) : (
            <form className="space-y-6"> {/* Removed onSubmit to handle buttons separately */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" type="email" placeholder="your@email.com" 
                  value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" type="password" placeholder="••••••••" 
                  value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-input"
                />
              </div>
              <div className="flex space-x-4">
                <Button type="button" onClick={handleSignUp} disabled={authLoading} className="flex-1">
                  {authLoading && email.length > 0 ? 'Processing...' : 'Sign Up'}
                </Button>
                <Button type="button" onClick={handleLogin} disabled={authLoading} variant="outline" className="flex-1">
                  {authLoading && email.length > 0 ? 'Processing...' : 'Log In'}
                </Button>
              </div>
            </form>
          )}
          {authMessage && (
            <p className={`text-sm text-center p-3 rounded-md ${authMessage.toLowerCase().includes('error') || authMessage.toLowerCase().includes('invalid') || authMessage.toLowerCase().includes('failed') || authMessage.toLowerCase().includes('must be logged in') || authMessage.toLowerCase().includes('team is full') ? 'bg-destructive/20 text-destructive' : 'bg-accent/20 text-accent-foreground'}`}>
              {authMessage}
            </p>
          )}
        </CardContent>
      </Card>

      {/* My Team Section */}
      {user && (
        <Card className="w-full max-w-2xl mb-10 shadow-xl border-none bg-card">
          <CardHeader className="bg-secondary">
            <CardTitle className="text-2xl text-center text-secondary-foreground py-4">
              My Team ({myTeamPlayers.length}/{MAX_TEAM_SIZE})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {myTeamLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4 bg-muted/50" />
                <Skeleton className="h-6 w-1/2 bg-muted/50" />
                <p className="text-muted-foreground text-center">Loading your team...</p>
              </div>
            ) : myTeamPlayers.length === 0 ? (
              <p className="text-lg text-muted-foreground text-center">Your team is empty. Add players from the roster below.</p>
            ) : (
              <ul className="space-y-3">
                {myTeamPlayers.map(player => (
                  <li key={player.id} className="flex justify-between items-center p-3 bg-background rounded-md shadow">
                    <div>
                      <p className="font-semibold text-foreground">{player.name}</p>
                      <p className="text-sm text-muted-foreground">{player.team}</p>
                    </div>
                    {/* Placeholder for "Remove" button if needed later */}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      
      <div 
        id="playersList"
        style={{ textAlign: 'left', width: '100%', maxWidth: '700px' }}
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
                  {players.map((player) => {
                    const isPlayerInTeam = myTeamPlayerIds.includes(player.id);
                    const isTeamFull = myTeamPlayerIds.length >= MAX_TEAM_SIZE;
                    return (
                      <li 
                        key={player.id} 
                        className="p-6 hover:bg-accent/10 transition-colors duration-200 flex items-start space-x-6"
                        aria-label={`Player: ${player.name}, Team: ${player.team}`}
                      >
                        {player.imageUrl ? (
                          <img 
                            src={player.imageUrl} 
                            alt={player.name} 
                            className="h-20 w-20 rounded-full object-cover border-2 border-primary/50 shadow-md"
                            data-ai-hint={player.dataAiHint || "sports person"}
                          />
                        ) : (
                          <div 
                            className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs border-2 border-primary/50 shadow-md"
                            data-ai-hint={player.dataAiHint || "sports person"}
                          >
                            No Image
                          </div>
                        )}
                        <div className="flex-grow">
                          <p className="text-xl font-semibold text-foreground">{player.name}</p>
                          <p className="text-md text-primary font-medium">{player.team}</p>
                          {player.position && <p className="text-sm text-muted-foreground">Position: {player.position}</p>}
                          {player.jerseyNumber !== undefined && <p className="text-sm text-muted-foreground">Jersey: #{player.jerseyNumber}</p>}
                          {player.price !== undefined && <p className="text-sm text-muted-foreground">Price: £{player.price.toFixed(1)}m</p>}
                          {player.points !== undefined && <p className="text-sm text-muted-foreground">Points: {player.points}</p>}
                        </div>
                        {user && (
                          <Button
                            onClick={() => handleAddPlayerToTeam(player)}
                            disabled={authLoading || isPlayerInTeam || (isTeamFull && !isPlayerInTeam)}
                            variant={isPlayerInTeam ? "outline" : "default"}
                            size="sm"
                            className="mt-2 self-center"
                          >
                            {isPlayerInTeam ? "Added" : (isTeamFull ? "Team Full" : "Add to Team")}
                          </Button>
                        )}
                      </li>
                    );
                  })}
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
