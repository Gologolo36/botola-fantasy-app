
"use client";

import { useState, useEffect, type FormEvent, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase'; 
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  Timestamp,
  orderBy,
  onSnapshot
} from 'firebase/firestore'; 
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Award, Star, ShieldCheck, Banknote, Scale, Trash2, TrendingUp, CalendarDays, Users, PlusCircle, LogIn } from 'lucide-react'; 

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

interface UserTeamData {
  playerIds: string[];
  captainId: string | null;
  viceCaptainId: string | null;
  budget: number;
  currentGameweek: number;
  freeTransfers: number;
  transfersMadeThisGw: number;
  pointsDeductions: number;
  userEmail?: string; // For easier lookup in leaderboards
}

interface League {
  id: string;
  name: string;
  code: string;
  creatorId: string;
  members: string[]; // array of UIDs
  createdAt: Timestamp;
}

interface LeaderboardEntry {
  memberId: string;
  memberEmail: string; // Or display name
  points: number;
  rank: number;
}


const MAX_TEAM_SIZE = 15;
const INITIAL_BUDGET = 100.0;
const CURRENT_GAMEWEEK = 1;
const INITIAL_FREE_TRANSFERS_GW1 = 1; 
const TRANSFER_POINT_COST = 4;


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
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [budget, setBudget] = useState<number>(INITIAL_BUDGET);
  
  // Gameweek and Transfer state
  const [currentGameweek, setCurrentGameweek] = useState<number>(CURRENT_GAMEWEEK);
  const [freeTransfers, setFreeTransfers] = useState<number>(INITIAL_FREE_TRANSFERS_GW1);
  const [transfersMadeThisGw, setTransfersMadeThisGw] = useState<number>(0);
  const [pointsDeductions, setPointsDeductions] = useState<number>(0);

  // League State
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [leagueNameInput, setLeagueNameInput] = useState('');
  const [leagueCodeInput, setLeagueCodeInput] = useState('');
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [leagueMessage, setLeagueMessage] = useState('');
  const [leagueLeaderboards, setLeagueLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});


  const auth = getAuth(db.app);

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        // Reset all user-specific state
        setEmail('');
        setPassword('');
        setMyTeamPlayerIds([]); 
        setMyTeamPlayers([]);
        setCaptainId(null);
        setViceCaptainId(null);
        setBudget(INITIAL_BUDGET);
        setCurrentGameweek(CURRENT_GAMEWEEK);
        setFreeTransfers(INITIAL_FREE_TRANSFERS_GW1);
        setTransfersMadeThisGw(0);
        setPointsDeductions(0);
        setUserLeagues([]);
        setLeagueLeaderboards({});
        setLeagueMessage('');
        setAuthMessage('Please sign in or sign up.');
      } else {
        setAuthMessage(`Logged in as ${currentUser.email}`);
        // User is logged in, load their team and leagues
      }
    });
    return () => unsubscribe();
  }, [auth]);

  const calculateTeamPointsForMember = useCallback((teamPlayerIds: string[], teamCaptainId: string | null, teamPointsDeductions: number, allPlayers: Player[]): number => {
    if (!teamPlayerIds || teamPlayerIds.length === 0 || !allPlayers || allPlayers.length === 0) {
      return 0 - (teamPointsDeductions || 0);
    }
    
    const currentTeamPlayers = allPlayers.filter(p => teamPlayerIds.includes(p.id));
    if (currentTeamPlayers.length === 0) return 0 - (teamPointsDeductions || 0);

    const rawPoints = currentTeamPlayers.reduce((total, player) => {
      let playerPoints = player.points || 0;
      if (player.id === teamCaptainId) {
        playerPoints *= 2; 
      }
      return total + playerPoints;
    }, 0);
    return rawPoints - (teamPointsDeductions || 0);
  }, []);


  const loadUserTeam = useCallback(async () => {
    if (!user || !isMounted) return;

    setMyTeamLoading(true);
    setAuthMessage(''); 
    const teamDocRef = doc(db, 'userTeams', user.uid);
    try {
      const teamDocSnap = await getDoc(teamDocRef);
      
      let teamDataToSave: UserTeamData = {
        playerIds: [],
        captainId: null,
        viceCaptainId: null,
        budget: INITIAL_BUDGET,
        currentGameweek: CURRENT_GAMEWEEK,
        freeTransfers: INITIAL_FREE_TRANSFERS_GW1,
        transfersMadeThisGw: 0,
        pointsDeductions: 0,
        userEmail: user.email || undefined,
      };
      let needsFirestoreUpdate = false;

      if (teamDocSnap.exists()) {
        const existingData = teamDocSnap.data() as UserTeamData;
        teamDataToSave = { ...teamDataToSave, ...existingData }; 

        if (existingData.currentGameweek !== CURRENT_GAMEWEEK || existingData.freeTransfers === undefined) {
          teamDataToSave.currentGameweek = CURRENT_GAMEWEEK;
          // For GW1, give more transfers if it's the first time or a reset. Subsequent GWs might get 1 or 2.
          teamDataToSave.freeTransfers = INITIAL_FREE_TRANSFERS_GW1; 
          teamDataToSave.transfersMadeThisGw = 0;
          teamDataToSave.pointsDeductions = 0; 
          needsFirestoreUpdate = true;
        }
        if (existingData.budget === undefined) {
            teamDataToSave.budget = INITIAL_BUDGET;
            needsFirestoreUpdate = true;
        }
        if (existingData.userEmail !== user.email) { // Keep email updated
            teamDataToSave.userEmail = user.email || undefined;
            needsFirestoreUpdate = true;
        }
      } else {
        needsFirestoreUpdate = true; // New user, document doesn't exist
      }
      
      setMyTeamPlayerIds(teamDataToSave.playerIds || []);
      setCaptainId(teamDataToSave.captainId || null);
      setViceCaptainId(teamDataToSave.viceCaptainId || null);
      setBudget(teamDataToSave.budget);
      setCurrentGameweek(teamDataToSave.currentGameweek);
      setFreeTransfers(teamDataToSave.freeTransfers);
      setTransfersMadeThisGw(teamDataToSave.transfersMadeThisGw);
      setPointsDeductions(teamDataToSave.pointsDeductions);

      if (needsFirestoreUpdate) {
        await setDoc(teamDocRef, teamDataToSave, { merge: true });
      }

    } catch (error) {
      console.error("Error loading/initializing user team:", error);
      setAuthMessage("Error loading/initializing your team.");
    } finally {
      setMyTeamLoading(false);
    }
  }, [user, isMounted]); 

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

  useEffect(() => {
    if (user && isMounted) {
      loadUserTeam();
    } else if (!user && isMounted) {
      // Reset team state if user logs out
      setMyTeamPlayerIds([]);
      setMyTeamPlayers([]);
      setCaptainId(null);
      setViceCaptainId(null);
      setBudget(INITIAL_BUDGET);
      setCurrentGameweek(CURRENT_GAMEWEEK);
      setFreeTransfers(INITIAL_FREE_TRANSFERS_GW1);
      setTransfersMadeThisGw(0);
      setPointsDeductions(0);
      setMyTeamLoading(false);
    }
  }, [user, isMounted, loadUserTeam]);


  useEffect(() => {
    if (players.length > 0 && myTeamPlayerIds.length > 0) {
      const selectedPlayers = players.filter(p => myTeamPlayerIds.includes(p.id));
      setMyTeamPlayers(selectedPlayers);
    } else {
      setMyTeamPlayers([]); 
    }
  }, [players, myTeamPlayerIds]);

  const teamValue = useMemo(() => {
    return myTeamPlayers.reduce((total, player) => total + (player.price || 0), 0);
  }, [myTeamPlayers]);

  const totalTeamPoints = useMemo(() => {
    return calculateTeamPointsForMember(myTeamPlayerIds, captainId, pointsDeductions, players);
  }, [myTeamPlayerIds, captainId, pointsDeductions, players, calculateTeamPointsForMember]);


  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      // Create a user document in 'users' collection
      await setDoc(doc(db, "users", newUser.uid), {
        email: newUser.email,
        uid: newUser.uid,
        createdAt: Timestamp.now(),
      });
      // Initialize team document as well - loadUserTeam will be called by auth state change
      // No need to explicitly call loadUserTeam() here as onAuthStateChanged will trigger it.
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
      // loadUserTeam will be called by onAuthStateChanged
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
      // State reset is handled by onAuthStateChanged
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
    const playerPrice = playerToAdd.price || 0;
    if (playerPrice > budget) {
      setAuthMessage(`Not enough budget to add ${playerToAdd.name}. Needs £${playerPrice.toFixed(1)}m, you have £${budget.toFixed(1)}m.`);
      return;
    }

    setAuthLoading(true); 
    const newTeamPlayerIds = [...myTeamPlayerIds, playerToAdd.id];
    const newBudget = budget - playerPrice;

    let transferMsg = "";
    let currentPointsDeductions = pointsDeductions;
    let currentFreeTransfers = freeTransfers;
    let currentTransfersMade = transfersMadeThisGw + 1;

    if (currentFreeTransfers > 0) {
      currentFreeTransfers -= 1;
      transferMsg = "Used free transfer.";
    } else {
      currentPointsDeductions += TRANSFER_POINT_COST;
      transferMsg = `-${TRANSFER_POINT_COST} points deduction for transfer.`;
    }
    
    try {
      const teamDocRef = doc(db, 'userTeams', user.uid);
      await setDoc(teamDocRef, { 
        playerIds: newTeamPlayerIds, 
        budget: newBudget,
        freeTransfers: currentFreeTransfers,
        transfersMadeThisGw: currentTransfersMade,
        pointsDeductions: currentPointsDeductions,
        currentGameweek: currentGameweek, // Ensure currentGameweek is saved
        userEmail: user.email // ensure email is saved
      }, { merge: true });
      
      setMyTeamPlayerIds(newTeamPlayerIds); 
      setBudget(newBudget);
      setFreeTransfers(currentFreeTransfers);
      setTransfersMadeThisGw(currentTransfersMade);
      setPointsDeductions(currentPointsDeductions);
      setAuthMessage(`${playerToAdd.name} added! Budget: £${newBudget.toFixed(1)}m. ${transferMsg}`);
    } catch (error) {
      console.error("Error adding player to team:", error);
      setAuthMessage("Failed to add player. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSellPlayer = async (playerToSell: Player) => {
    if (!user) {
      setAuthMessage("You must be logged in to sell players.");
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    const newTeamPlayerIds = myTeamPlayerIds.filter(id => id !== playerToSell.id);
    const newBudget = budget + (playerToSell.price || 0);
    let newCaptainId = captainId;
    let newViceCaptainId = viceCaptainId;

    if (captainId === playerToSell.id) newCaptainId = null;
    if (viceCaptainId === playerToSell.id) newViceCaptainId = null;
    
    let transferMsg = "";
    let currentPointsDeductions = pointsDeductions;
    let currentFreeTransfers = freeTransfers;
    let currentTransfersMade = transfersMadeThisGw + 1;

    if (currentFreeTransfers > 0) {
      currentFreeTransfers -= 1;
      transferMsg = "Used free transfer.";
    } else {
      currentPointsDeductions += TRANSFER_POINT_COST;
      transferMsg = `-${TRANSFER_POINT_COST} points deduction for transfer.`;
    }

    try {
      const teamDocRef = doc(db, 'userTeams', user.uid);
      await setDoc(teamDocRef, { 
        playerIds: newTeamPlayerIds, 
        budget: newBudget,
        captainId: newCaptainId,
        viceCaptainId: newViceCaptainId,
        freeTransfers: currentFreeTransfers,
        transfersMadeThisGw: currentTransfersMade,
        pointsDeductions: currentPointsDeductions,
        currentGameweek: currentGameweek // Ensure currentGameweek is saved
      }, { merge: true });

      setMyTeamPlayerIds(newTeamPlayerIds);
      setBudget(newBudget);
      setCaptainId(newCaptainId);
      setViceCaptainId(newViceCaptainId);
      setFreeTransfers(currentFreeTransfers);
      setTransfersMadeThisGw(currentTransfersMade);
      setPointsDeductions(currentPointsDeductions);
      setAuthMessage(`${playerToSell.name} sold. Budget: £${newBudget.toFixed(1)}m. ${transferMsg}`);
    } catch (error) {
      console.error("Error selling player:", error);
      setAuthMessage("Failed to sell player. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };


  const handleSetCaptain = async (selectedPlayerId: string) => {
    if (!user) {
      setAuthMessage("You must be logged in to set a captain.");
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    let newCaptainId: string | null = selectedPlayerId;
    let newViceCaptainId: string | null = viceCaptainId;

    if (newViceCaptainId === selectedPlayerId) newViceCaptainId = null; 
    
    try {
      const teamDocRef = doc(db, 'userTeams', user.uid);
      await setDoc(teamDocRef, { captainId: newCaptainId, viceCaptainId: newViceCaptainId }, { merge: true });
      setCaptainId(newCaptainId);
      setViceCaptainId(newViceCaptainId); 
      setAuthMessage(`Captain set to ${players.find(p=>p.id === newCaptainId)?.name || 'selected player'}.`);
    } catch (error) {
      console.error("Error setting captain:", error);
      setAuthMessage("Failed to set captain. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSetViceCaptain = async (selectedPlayerId: string) => {
    if (!user) {
      setAuthMessage("You must be logged in to set a vice-captain.");
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    let newViceCaptainId: string | null = selectedPlayerId;
    let newCaptainId: string | null = captainId;

    if (newCaptainId === selectedPlayerId) newCaptainId = null; 

    try {
      const teamDocRef = doc(db, 'userTeams', user.uid);
      await setDoc(teamDocRef, { captainId: newCaptainId, viceCaptainId: newViceCaptainId }, { merge: true });
      setViceCaptainId(newViceCaptainId);
      setCaptainId(newCaptainId); 
      setAuthMessage(`Vice-Captain set to ${players.find(p=>p.id === newViceCaptainId)?.name || 'selected player'}.`);
    } catch (error) {
      console.error("Error setting vice-captain:", error);
      setAuthMessage("Failed to set vice-captain. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // --- League Functions ---
  const generateLeagueCode = (length = 6): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const handleCreateLeague = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setLeagueMessage("You must be logged in to create a league.");
      return;
    }
    if (!leagueNameInput.trim()) {
      setLeagueMessage("League name cannot be empty.");
      return;
    }
    setLeagueLoading(true);
    setLeagueMessage('');

    try {
      let newCode = generateLeagueCode();
      // Simple check for code uniqueness, in a real app might need more robust check or retry
      const q = query(collection(db, "leagues"), where("code", "==", newCode));
      let existingLeagueSnap = await getDocs(q);
      while(!existingLeagueSnap.empty){
        newCode = generateLeagueCode();
        existingLeagueSnap = await getDocs(query(collection(db, "leagues"), where("code", "==", newCode)));
      }

      const leagueData = {
        name: leagueNameInput.trim(),
        code: newCode,
        creatorId: user.uid,
        members: [user.uid],
        createdAt: Timestamp.now(),
      };
      const leagueDocRef = await addDoc(collection(db, "leagues"), leagueData);
      setLeagueMessage(`League "${leagueData.name}" created! Code: ${leagueData.code}`);
      setLeagueNameInput(''); // Clear input
    } catch (error) {
      console.error("Error creating league:", error);
      setLeagueMessage("Failed to create league. Please try again.");
    } finally {
      setLeagueLoading(false);
    }
  };

  const handleJoinLeague = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setLeagueMessage("You must be logged in to join a league.");
      return;
    }
    if (!leagueCodeInput.trim()) {
      setLeagueMessage("League code cannot be empty.");
      return;
    }
    setLeagueLoading(true);
    setLeagueMessage('');
    try {
      const q = query(collection(db, "leagues"), where("code", "==", leagueCodeInput.trim()));
      const leagueSnap = await getDocs(q);

      if (leagueSnap.empty) {
        setLeagueMessage("Invalid league code.");
        setLeagueLoading(false);
        return;
      }

      const leagueDoc = leagueSnap.docs[0];
      const leagueData = leagueDoc.data() as League;

      if (leagueData.members.includes(user.uid)) {
        setLeagueMessage(`You are already in league "${leagueData.name}".`);
        setLeagueLoading(false);
        return;
      }

      await updateDoc(doc(db, "leagues", leagueDoc.id), {
        members: arrayUnion(user.uid)
      });
      setLeagueMessage(`Successfully joined league "${leagueData.name}"!`);
      setLeagueCodeInput(''); // Clear input
    } catch (error) {
      console.error("Error joining league:", error);
      setLeagueMessage("Failed to join league. Please try again.");
    } finally {
      setLeagueLoading(false);
    }
  };
  
  useEffect(() => {
    if (!user || !isMounted || players.length === 0) {
      setUserLeagues([]);
      setLeagueLeaderboards({});
      return;
    }
  
    setLeagueLoading(true);
    const q = query(collection(db, "leagues"), where("members", "array-contains", user.uid), orderBy("createdAt", "desc"));
  
    const unsubscribeLeagues = onSnapshot(q, async (querySnapshot) => {
      const leaguesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as League));
      setUserLeagues(leaguesData);
  
      const leaderboards: Record<string, LeaderboardEntry[]> = {};
      for (const league of leaguesData) {
        const memberEntries: LeaderboardEntry[] = [];
        for (const memberId of league.members) {
          try {
            const userDocSnap = await getDoc(doc(db, "users", memberId));
            const userTeamDocSnap = await getDoc(doc(db, "userTeams", memberId));
            
            const memberEmail = userDocSnap.exists() ? userDocSnap.data()?.email || 'Unknown User' : 'Unknown User';
            let memberPoints = 0;

            if (userTeamDocSnap.exists()) {
              const teamData = userTeamDocSnap.data() as UserTeamData;
              memberPoints = calculateTeamPointsForMember(teamData.playerIds, teamData.captainId, teamData.pointsDeductions, players);
            }
            memberEntries.push({ memberId, memberEmail, points: memberPoints, rank: 0 });
          } catch (error) {
            console.error(`Error fetching data for member ${memberId} in league ${league.id}`, error);
            memberEntries.push({ memberId, memberEmail: 'Error Loading', points: 0, rank: 0 });
          }
        }
        // Sort by points and assign rank
        memberEntries.sort((a, b) => b.points - a.points);
        memberEntries.forEach((entry, index) => entry.rank = index + 1);
        leaderboards[league.id] = memberEntries;
      }
      setLeagueLeaderboards(leaderboards);
      setLeagueLoading(false);
    }, (error) => {
      console.error("Error fetching user leagues:", error);
      setLeagueMessage("Could not load your leagues.");
      setLeagueLoading(false);
    });
  
    return () => unsubscribeLeagues();
  }, [user, isMounted, players, calculateTeamPointsForMember]);


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
          Botola Pro Fantasy
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl">
          Build your dream team, create leagues, and compete!
        </p>
      </header>

      <Card className="w-full max-w-md mb-10 shadow-xl border-none bg-card">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-primary-foreground bg-primary py-4 rounded-t-lg -mx-6 -mt-6 px-6">
            {user ? `Welcome, ${user.email?.split('@')[0]}!` : 'Account'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {user ? (
            <div className="space-y-4 text-center">
              <Button onClick={handleSignOut} disabled={authLoading} className="w-full">
                {authLoading ? 'Signing Out...' : 'Sign Out'}
              </Button>
            </div>
          ) : (
            <form className="space-y-6">
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
            <p className={`text-sm text-center p-3 rounded-md ${authMessage.toLowerCase().includes('error') || authMessage.toLowerCase().includes('invalid') || authMessage.toLowerCase().includes('failed') || authMessage.toLowerCase().includes('must be logged in') || authMessage.toLowerCase().includes('team is full') || authMessage.toLowerCase().includes('not enough budget') ? 'bg-destructive/20 text-destructive' : 'bg-accent/20 text-accent-foreground'}`}>
              {authMessage}
            </p>
          )}
        </CardContent>
      </Card>

      {user && (
        <>
          <Card className="w-full max-w-2xl mb-10 shadow-xl border-none bg-card">
            <CardHeader className="bg-secondary text-secondary-foreground py-4 rounded-t-lg -mx-6 -mt-6 px-6">
              <CardTitle className="text-xl sm:text-2xl text-center flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 px-2">
                <span className="whitespace-nowrap">My Team ({myTeamPlayers.length}/{MAX_TEAM_SIZE})</span>
                <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-sm sm:text-base font-semibold mt-2 sm:mt-0">
                  <span className="flex items-center whitespace-nowrap">
                    <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 mr-1 text-purple-400" /> GW: {currentGameweek}
                  </span>
                  <span className="flex items-center whitespace-nowrap">
                    <Banknote className="h-4 w-4 sm:h-5 sm:w-5 mr-1 text-green-400" /> £{budget.toFixed(1)}m
                  </span>
                  <span className="flex items-center whitespace-nowrap">
                    <Scale className="h-4 w-4 sm:h-5 sm:w-5 mr-1 text-blue-400" /> Val: £{teamValue.toFixed(1)}m
                  </span>
                  <span className="flex items-center whitespace-nowrap">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-1 text-orange-400" /> FT: {freeTransfers}
                  </span>
                  <span className="flex items-center whitespace-nowrap">
                    <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 mr-1 text-primary" /> Pts: {totalTeamPoints}
                  </span>
                </div>
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
                  {myTeamPlayers.map(player => {
                    const isCaptain = player.id === captainId;
                    const isViceCaptain = player.id === viceCaptainId;
                    return (
                      <li key={player.id} className="flex justify-between items-center p-3 bg-background rounded-md shadow">
                        <div className="flex-grow">
                          <p className="font-semibold text-foreground">
                            {player.name}
                            {isCaptain && <span className="ml-2 text-xs font-bold text-primary">(C)</span>}
                            {isViceCaptain && <span className="ml-2 text-xs font-bold text-secondary-foreground">(V)</span>}
                          </p>
                          <p className="text-sm text-muted-foreground">{player.team} {player.price !== undefined ? `(£${player.price.toFixed(1)}m)` : ''}</p>
                        </div>
                        <div className="flex space-x-1 sm:space-x-2 items-center">
                          <Button 
                            size="sm" 
                            variant={isCaptain ? "default" : "outline"} 
                            onClick={() => handleSetCaptain(player.id)}
                            disabled={authLoading || (isCaptain && player.id === captainId) } 
                            aria-label={`Set ${player.name} as Captain`}
                            className="p-1.5 sm:p-2"
                          >
                            <Award className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant={isViceCaptain ? "secondary" : "outline"} 
                            onClick={() => handleSetViceCaptain(player.id)}
                            disabled={authLoading || (isViceCaptain && player.id === viceCaptainId)} 
                            aria-label={`Set ${player.name} as Vice-Captain`}
                            className="p-1.5 sm:p-2"
                          >
                            <Star className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleSellPlayer(player)}
                            disabled={authLoading}
                            aria-label={`Sell ${player.name}`}
                            className="p-1.5 sm:p-2"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="w-full max-w-2xl mb-10 shadow-xl border-none bg-card">
            <CardHeader className="bg-primary text-primary-foreground py-4 rounded-t-lg -mx-6 -mt-6 px-6">
              <CardTitle className="text-xl sm:text-2xl text-center flex items-center justify-center gap-2">
                <Users className="h-6 w-6" /> Mini Leagues
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <form onSubmit={handleCreateLeague} className="space-y-3">
                <Label htmlFor="leagueName">Create New League</Label>
                <div className="flex space-x-2">
                  <Input 
                    id="leagueName" 
                    type="text" 
                    placeholder="Enter league name" 
                    value={leagueNameInput} 
                    onChange={(e) => setLeagueNameInput(e.target.value)} 
                    className="bg-input flex-grow"
                  />
                  <Button type="submit" disabled={leagueLoading} className="whitespace-nowrap">
                    <PlusCircle className="mr-2 h-4 w-4" /> Create
                  </Button>
                </div>
              </form>
              <form onSubmit={handleJoinLeague} className="space-y-3">
                <Label htmlFor="leagueCode">Join Existing League</Label>
                <div className="flex space-x-2">
                  <Input 
                    id="leagueCode" 
                    type="text" 
                    placeholder="Enter league code" 
                    value={leagueCodeInput} 
                    onChange={(e) => setLeagueCodeInput(e.target.value)} 
                    className="bg-input flex-grow"
                  />
                  <Button type="submit" disabled={leagueLoading} variant="outline" className="whitespace-nowrap">
                     <LogIn className="mr-2 h-4 w-4" /> Join
                  </Button>
                </div>
              </form>
              {leagueMessage && (
                <p className={`text-sm text-center p-3 rounded-md ${leagueMessage.toLowerCase().includes('error') || leagueMessage.toLowerCase().includes('invalid') || leagueMessage.toLowerCase().includes('failed') ? 'bg-destructive/20 text-destructive' : 'bg-accent/20 text-accent-foreground'}`}>
                  {leagueMessage}
                </p>
              )}

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-center text-primary">Your Leagues</h3>
                {leagueLoading && userLeagues.length === 0 && <p className="text-muted-foreground text-center">Loading your leagues...</p>}
                {!leagueLoading && userLeagues.length === 0 && <p className="text-muted-foreground text-center">You haven't joined any leagues yet.</p>}
                
                {userLeagues.length > 0 && (
                  <Accordion type="single" collapsible className="w-full">
                    {userLeagues.map(league => (
                      <AccordionItem value={league.id} key={league.id}>
                        <AccordionTrigger className="hover:bg-accent/10 px-3 rounded-md">
                          <div className="flex justify-between w-full items-center pr-2">
                            <span>{league.name}</span>
                            <span className="text-xs text-muted-foreground">Code: {league.code}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pt-2 pb-1">
                          {leagueLeaderboards[league.id] ? (
                            <ul className="space-y-2 text-sm">
                              <li className="flex justify-between font-semibold text-foreground bg-background p-2 rounded-t-md">
                                <span>Rank</span>
                                <span>Manager</span>
                                <span>Points</span>
                              </li>
                              {leagueLeaderboards[league.id].map(entry => (
                                <li key={entry.memberId} className={`flex justify-between items-center p-2 rounded-md ${entry.memberId === user.uid ? 'bg-primary/10 text-primary font-medium' : 'bg-background'}`}>
                                  <span className="w-1/6 text-center">{entry.rank}</span>
                                  <span className="w-3/6 truncate" title={entry.memberEmail}>{entry.memberEmail.split('@')[0]}</span>
                                  <span className="w-2/6 text-right font-semibold">{entry.points}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground text-center py-2">Loading leaderboard...</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            </CardContent>
          </Card>
        </>
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
              <CardTitle className="text-2xl text-center text-primary-foreground py-6 rounded-t-lg -mx-6 -mt-6 px-6">
                Player Roster
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {players.length > 0 ? (
                <ul className="divide-y divide-border">
                  {players.map((player) => {
                    const isPlayerInTeam = myTeamPlayerIds.includes(player.id);
                    const isTeamFull = myTeamPlayerIds.length >= MAX_TEAM_SIZE;
                    const playerPrice = player.price || 0;
                    const canAfford = playerPrice <= budget;
                    
                    let buttonText = "Add to Team";
                    if (isPlayerInTeam) buttonText = "In Team";
                    else if (isTeamFull) buttonText = "Team Full";
                    else if (!canAfford) buttonText = "Too Expensive";

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
                          {player.points !== undefined && <p className="text-sm text-muted-foreground">Points: {player.points || 0}</p>}
                        </div>
                        {user && (
                          <Button
                            onClick={() => handleAddPlayerToTeam(player)}
                            disabled={authLoading || isPlayerInTeam || (isTeamFull && !isPlayerInTeam) || (!canAfford && !isPlayerInTeam)}
                            variant={isPlayerInTeam ? "outline" : "default"}
                            size="sm"
                            className="mt-2 self-center"
                          >
                            {buttonText}
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
        <p>&copy; {new Date().getFullYear()} Botola Fantasy. All rights reserved.</p>
      </footer>
    </div>
  );
}


    

    