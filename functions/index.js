const functions = require("firebase-functions");
const initializeFirebaseAdmin = require("./initializeFirebaseAdmin");
const {MlbBot} = require("./mlbBot");

const admin = initializeFirebaseAdmin();
const firestore = admin.firestore();
const mlbBot = new MlbBot(firestore);

// To test via http
// exports.processGames = functions.https.onRequest(async (req, res) => {
//   // http://localhost:5001/my-team-sucks/us-central1/processGames
//   await mlbBot.processGames();
//   res.send("woooo");
// });

// Run every 5 minutes between 12am and 3am: https://crontab.guru/#*/5_0-3_*_*_*
// exports.processGamesLate = functions
//     .runWith({
//     // Ensure the function has enough memory and time
//     // to process large files
//       timeoutSeconds: 300,
//       memory: "4GB",
//     })
//     .pubsub.schedule("*/5 0-3 * * *")
//     .timeZone("America/New_York")
//     .onRun(async (context) => {
//       await mlbBot.processGames();
//       return null;
//     });

// // Run every 5 minutes between 2pm and 12am: https://www.adminschoice.com/crontab-quick-reference
// exports.processGamesEarly = functions
//     .runWith({
//       timeoutSeconds: 300,
//       memory: "4GB",
//     })
//     .pubsub.schedule("*/5 14-23 * * *")
//     .timeZone("America/New_York")
//     .onRun(async (context) => {
//       await mlbBot.processGames();
//       return null;
//     });

// // Run every morning at 9am: https://crontab.guru/#0_9_*_*_*
// exports.suckMeterReport = functions.pubsub.schedule("0 9 * * *")
//     .timeZone("America/New_York")
//     .onRun(async (context) => {
//       await mlbBot.suckMeterReport();
//       return null;
//     });
