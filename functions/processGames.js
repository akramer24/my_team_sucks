const axios = require("axios");
const {TwitterApi} = require("twitter-api-v2");
const {Collections, Sports, StatsRoutes} = require("./enums");
const {
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_TOKEN_SECRET,
  TWITTER_API_KEY,
  TWITTER_API_KEY_SECRET,
} = require("./secrets");

const twitterClient = new TwitterApi({
  appKey: TWITTER_API_KEY,
  appSecret: TWITTER_API_KEY_SECRET,
  accessToken: TWITTER_ACCESS_TOKEN,
  accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
});

const tweet = async (data, payload = {}) => {
  await twitterClient.v2.tweet(data, payload);
};

const meter = ({
  gamesBack,
  winningPercentage,
  lastTenPct,
  sportRank,
}) => {
  return 113.28 +
    (.307 * gamesBack) -
    (158.47 * winningPercentage) +
    (1.144 * sportRank) -
    ((lastTenPct) - .500) * 20;
};

const idToHashtag = {
  "108": "#GoHalos",
  "109": "#Dbacks",
  "110": "#Birdland",
  "111": "#DirtyWater",
  "112": "#ItsDifferentHere",
  "113": "#ATOBTTR",
  "114": "#ForTheLand",
  "115": "#Rockies",
  "116": "#DetroitRoots",
  "117": "#LevelUp",
  "118": "#TogetherRoyal",
  "119": "#AlwaysLA",
  "120": "#NATITUDE",
  "121": "#LGM",
  "133": "#DrumTogether",
  "134": "#LetsGoBucs",
  "135": "#TimeToShine",
  "136": "#SeaUsRise",
  "137": "#SFGameUp",
  "138": "#STLCards",
  "139": "#RaysUp",
  "140": "#StraightUpTX",
  "141": "#NextLevel",
  "142": "#MNTwins",
  "143": "#RingTheBell",
  "144": "#ForTheA",
  "145": "#ChangeTheGame",
  "146": "#MakeItMiami",
  "147": "#RepBX",
  "158": "#ThisIsMyCrew",
};

const processGames = async (firestore) => {
  try {
    const allGamesRes = await axios.get(StatsRoutes.GAMES);
    const today = allGamesRes.data.dates[0];

    const gamesRef = firestore
        .collection(Collections.SPORT)
        .doc(Sports.BASE)
        .collection(Collections.YEAR)
        .doc("2022")
        .collection(Collections.GAMES);

    const storedTodayGamesSnap = await gamesRef.where("date", "==", today.date).get();
    const storedGameIds = new Set();
    storedTodayGamesSnap.forEach((doc) => {
      storedGameIds.add(doc.id);
    });

    const newFinals = today.games.reduce((result, game) => {
      const gameId = String(game.gamePk);
      if (["Final", "Game Over"].includes(game.status.detailedState) && !storedGameIds.has(gameId)) {
        result.count += 1;
        const {away, home} = game.teams;
        const {winner, loser} = away.isWinner ? ({winner: away, loser: home}) : ({winner: home, loser: away});
        const winnerId = String(winner.team.id);
        const loserId = String(loser.team.id);

        result.games[gameId] = {
          id: gameId,
          date: today.date,
          winner: {name: winner.team.name, id: winnerId, score: winner.score},
          loser: {name: loser.team.name, id: loserId, score: loser.score},
          tweets: [],
          teamUpdates: [],
        };
        result.teams[winnerId] = {tweet: `The ${winner.team.name} beat the ${loser.team.name}, ${winner.score}-${loser.score}.`, name: winner.team.name, gameId};
        result.teams[loserId] = {tweet: `The ${loser.team.name} lost to the ${winner.team.name}, ${winner.score}-${loser.score}.`, name: loser.team.name, gameId};
      }
      return result;
    }, {games: {}, teams: {}, count: 0});

    if (newFinals.count) {
      const standingsRes = await axios.get(StatsRoutes.STANDINGS);
      for (const division of standingsRes.data?.records) {
        for (const entry of division.teamRecords) {
          const teamId = String(entry.team.id);
          if (!newFinals.teams[teamId]) {
            continue;
          }
          const {gameId, name: teamName, tweet: pendingTweet} = newFinals.teams[teamId];
          if (pendingTweet) {
            const meterResult = meter({
              gamesBack: parseFloat(entry.gamesBack.replace("-", "0").replace("+", "-")),
              winningPercentage: parseFloat(entry.winningPercentage),
              sportRank: parseFloat(entry.sportRank),
              lastTenPct: parseFloat(entry.records.splitRecords.find((rec) => rec.type === "lastTen").pct),
            });
            const finalTweet = `${pendingTweet} Their suck meter is now ${meterResult.toFixed(1)}.
            
${idToHashtag[teamId]}`;
            try {
              await tweet(finalTweet);
              newFinals.games[gameId].tweets.push(teamId);
            } catch (err) {
              console.error(err);
            }
            try {
              const teamRef = firestore
                  .collection(Collections.SPORT)
                  .doc(Sports.BASE)
                  .collection(Collections.YEAR)
                  .doc("2022")
                  .collection(Collections.TEAMS)
                  .doc(teamId);
              await teamRef.set({id: teamId, name: teamName, meter: meterResult}, {merge: true});
              await teamRef
                  .collection(Collections.HISTORY)
                  .doc(today.date)
                  .set({gameId, meter: meterResult});
              newFinals.games[gameId].teamUpdates.push(teamId);
            } catch (err) {
              console.error(err);
            }
          }
        }
      }

      await Promise.all(Object.entries(newFinals.games).map(([gameId, gameData]) => {
        return firestore
            .collection(Collections.SPORT)
            .doc(Sports.BASE)
            .collection(Collections.YEAR)
            .doc("2022")
            .collection(Collections.GAMES)
            .doc(gameId)
            .set(gameData);
      }));
    } else {
      console.log("No new final scores to process as of", Date.now());
    }
  } catch (err) {
    console.error("oops", err);
  }
};

module.exports = {
  meter,
  processGames,
  tweet,
};
