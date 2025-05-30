import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK - this should be done only once.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Interface for the expected incoming match data from the external API.
 */
interface IncomingMatchData {
  playerId: string; // ID of the player involved
  action: "goal" | "assist" | "yellow_card" | "red_card" | "appearance" | "clean_sheet_half" | "clean_sheet_full"; // Type of action
  // You can add more fields as needed, e.g., matchId, minutesPlayed, teamId for context.
}

/**
 * HTTP-triggered Cloud Function to process incoming match data and update player scores.
 *
 * @param request - The HTTP request object. Expects a POST request with a JSON body
 *                  matching the IncomingMatchData interface.
 * @param response - The HTTP response object.
 */
export const processMatchEvent = functions.https.onRequest(async (request, response) => {
  // Only allow POST requests
  if (request.method !== "POST") {
    response.status(405).send({ error: "Method Not Allowed. Please use POST." });
    return;
  }

  try {
    const eventData = request.body as IncomingMatchData;

    if (!eventData.playerId || !eventData.action) {
      response.status(400).send({ error: "Bad Request: Missing playerId or action in request body." });
      return;
    }

    // --- 1. Placeholder for processing incoming match data & calculating points ---
    // This is where you'll implement your specific scoring logic based on eventData.action.
    // For example, goals might be worth more for defenders, assists have a standard value, etc.
    let pointsEarned = 0;
    switch (eventData.action) {
      case "goal":
        pointsEarned = 5; // Simplified example: 5 points for a goal
        break;
      case "assist":
        pointsEarned = 3; // Simplified example: 3 points for an assist
        break;
      case "yellow_card":
        pointsEarned = -1;
        break;
      case "red_card":
        pointsEarned = -3;
        break;
      case "appearance":
        pointsEarned = 1; // For playing part of the game
        break;
      // Add more cases for other actions like clean_sheet_half, clean_sheet_full, etc.
      default:
        console.warn(\`Unknown action type: \${eventData.action}\`);
        // Optionally, you might choose not to award points or send an error
        response.status(400).send({ error: \`Unknown action type: \${eventData.action}\` });
        return;
    }

    // --- 2. Update player's points in Cloud Firestore ---
    const playerRef = db.collection("players").doc(eventData.playerId);

    await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);

      if (!playerDoc.exists) {
        // If player doesn't exist, you might choose to log this or handle differently.
        // For now, we'll throw an error which will be caught and sent in the response.
        throw new Error(\`Player with ID \${eventData.playerId} not found.\`);
      }

      const currentPoints = playerDoc.data()?.points || 0; // Safely get current points, default to 0
      const newTotalPoints = currentPoints + pointsEarned;

      transaction.update(playerRef, { points: newTotalPoints });
      console.log(\`Player \${eventData.playerId} points updated from \${currentPoints} to \${newTotalPoints} for action \${eventData.action}\`);
    });

    response.status(200).send({
      status: "success",
      message: \`Player \${eventData.playerId}'s score updated due to \${eventData.action}.\`,
      pointsAdded: pointsEarned,
    });

  } catch (error) {
    console.error("Error processing match event:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    response.status(500).send({ error: "Internal Server Error", details: errorMessage });
  }
});
