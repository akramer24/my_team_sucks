const functions = require("firebase-functions");
const {processGames} = require("./processGames");
const initializeFirebaseAdmin = require("./initializeFirebaseAdmin");

const admin = initializeFirebaseAdmin();
const firestore = admin.firestore();

// To test via http
// exports.processGames = functions.https.onRequest(async (req, res) => {
//   // http://localhost:5001/my-team-sucks/us-central1/processGames
//   await processGames(firestore);
//   res.send('woooo')
// });

// Run every 5 minutes between 12am and 3am: https://crontab.guru/#*/5_0-3_*_*_*
exports.processGamesLate = functions.pubsub.schedule("*/5 0-3 * * *")
    .timeZone("America/New_York")
    .onRun(async (context) => {
      await processGames(firestore);
      return null;
    });

// Run every 5 minutes between 2pm and 12am: https://www.adminschoice.com/crontab-quick-reference
exports.processGamesEarly = functions.pubsub.schedule("*/5 14-23 * * *")
    .timeZone("America/New_York")
    .onRun(async (context) => {
      await processGames(firestore);
      return null;
    });
