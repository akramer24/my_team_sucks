const axios = require("axios");
const fs = require("fs");
const {TwitterApi} = require("twitter-api-v2");
const puppeteer = require("puppeteer");
const Gauge = require("svg-gauge");
const {
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_TOKEN_SECRET,
  TWITTER_API_KEY,
  TWITTER_API_KEY_SECRET,
} = require("./secrets");
const {Collections, Sports, StatsRoutes} = require("./enums");

const twitterClient = new TwitterApi({
  appKey: TWITTER_API_KEY,
  appSecret: TWITTER_API_KEY_SECRET,
  accessToken: TWITTER_ACCESS_TOKEN,
  accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
});

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

const TMP_DIR = process.env.FUNCTIONS_EMULATOR === "true" ? "tmp" : "/tmp";
const APP_BASE_URL = process.env.FUNCTIONS_EMULATOR === "true" ? "http://localhost:8081" : "https://my-team-sucks.web.app";

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
            const gamesBack = parseFloat(entry.gamesBack.replace("-", "0").replace("+", "-"));
            const lastTen = entry.records.splitRecords.find((rec) => rec.type === "lastTen");
            const sportRank = parseFloat(entry.sportRank);
            const meterResult = meter({
              gamesBack,
              winningPercentage: parseFloat(entry.winningPercentage),
              sportRank,
              lastTenPct: parseFloat(lastTen.pct),
            });
            const finalTweet = `${pendingTweet} Their suck meter is now ${meterResult.toFixed(1)}.
            
${idToHashtag[teamId]}`;
            try {
              const imageFilePath = await getImage({
                teamId,
                record: `${entry.leagueRecord.wins}-${entry.leagueRecord.losses}`,
                lastTen: `${lastTen.wins}-${lastTen.losses}`,
                gamesBack,
                meter: meterResult,
                sportRank,
              });
              const mediaId = await twitterClient.v1.uploadMedia(imageFilePath);
              await twitterClient.v2.tweet(finalTweet, {media: {media_ids: [mediaId]}});
              newFinals.games[gameId].tweets.push(teamId);
              fs.unlinkSync(imageFilePath);
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

async function suckMeterReport(firestore) {
  const teamsSnap = await firestore
      .collection(Collections.SPORT)
      .doc(Sports.BASE)
      .collection(Collections.YEAR)
      .doc("2022")
      .collection(Collections.TEAMS)
      .orderBy("meter", "desc")
      .get();

  const reportStart = "Daily Suck Meter Report";
  let report = reportStart;
  const tweets = [];
  let rank = 1;
  teamsSnap.forEach((doc) => {
    const {id, meter} = doc.data();
    const nextLine = `
${rank} ${idToHashtag[id]} ${meter.toFixed(1)}`;

    if (report.length + nextLine.length > 240) {
      tweets.push(report);
      report = `${reportStart} Pt. ${tweets.length + 1}${nextLine}`;
    } else {
      report += nextLine;

      if (rank === 30) {
        tweets.push(report);
      }
    }
    rank++;
  });

  let inReplyTo = null;
  for (const message of tweets) {
    const options = {};
    if (inReplyTo) {
      options.reply = {in_reply_to_tweet_id: inReplyTo};
    }
    const res = await twitterClient.v2.tweet(message, options);
    inReplyTo = res.data.id;
  }
}

const idToScreenshotInfo = {
  "108": {
    abbr: "LAA",
    bg: "rgba(186, 0, 33, 0.9)",
  },
  "109": {
    abbr: "ARI",
    bg: "rgba(227, 212, 173, 0.9)",
    textColor: "black",
  },
  "110": {
    abbr: "BAL",
    bg: "rgba(223, 70, 1, 0.9)",
  },
  "111": {
    abbr: "BOS",
    bg: "rgba(189, 48, 57, 0.9)",
  },
  "112": {
    abbr: "CHI (NL)",
    bg: "rgba(14, 51, 134, 0.9)",
  },
  "113": {
    abbr: "CIN",
    bg: "rgba(198, 1, 31, 0.9)",
  },
  "114": {
    abbr: "CLE",
    bg: "rgba(0, 56, 93, 0.9)",
  },
  "115": {
    abbr: "COL",
    bg: "rgba(51, 51, 102, 0.9)",
  },
  "116": {
    abbr: "DET",
    bg: "rgba(12, 35, 64, 0.9)",
  },
  "117": {
    abbr: "CHEAT",
    bg: "rgba(235, 110, 31, 0.9)",
  },
  "118": {
    abbr: "KC",
    bg: "rgba(0, 70, 135, 0.9)",
  },
  "119": {
    abbr: "LAD",
    bg: "rgba(0, 90, 156, 0.9)",
  },
  "120": {
    abbr: "WSH",
    bg: "rgba(171, 0 ,3, 0.9)",
  },
  "121": {
    abbr: "NYM",
    bg: "rgba(252, 89, 16, 0.9)",
  },
  "133": {
    abbr: "OAK",
    bg: "rgba(0, 56, 49, 0.9)",
  },
  "134": {
    abbr: "PIT",
    bg: "rgba(253, 184, 39, 0.9)",
  },
  "135": {
    abbr: "SD",
    bg: "rgba(47, 36, 29, 0.8)",
  },
  "136": {
    abbr: "SEA",
    bg: "rgba(12, 44, 86, 0.9)",
  },
  "137": {
    abbr: "SF",
    bg: "rgba(253, 90, 30, 0.9)",
  },
  "138": {
    abbr: "STL",
    bg: "rgba(196, 30, 58, 0.9)",
  },
  "139": {
    abbr: "TB",
    bg: "rgba(143, 188, 230, 0.9)",
  },
  "140": {
    abbr: "TEX",
    bg: "rgba(0, 50, 120, 0.9)",
  },
  "141": {
    abbr: "TOR",
    bg: "rgba(19, 74, 142, 0.9)",
  },
  "142": {
    abbr: "MIN",
    bg: "rgba(0, 43, 92. 0.9)",
  },
  "143": {
    abbr: "PHI",
    bg: "rgba(232, 24, 40, 0.9)",
  },
  "144": {
    abbr: "ATL",
    bg: "rgba(19, 39, 79, 0.9)",
  },
  "145": {
    abbr: "CHI (AL)",
    bg: "rgba(0, 0, 0, 0.5)",
  },
  "146": {
    abbr: "MIA",
    bg: "rgba(0, 163, 224, 0.9)",
  },
  "147": {
    abbr: "NYY",
    bg: "rgba(0, 48, 135, 0.9)",
  },
  "158": {
    abbr: "MIL",
    bg: "rgba(255, 197, 47, 0.9)",
  },
};

async function getImage(payload) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`${APP_BASE_URL}/graphic-template.html`);
  await page.evaluate(({
    teamId,
    record,
    lastTen,
    gamesBack,
    meter,
    sportRank,
  }, idToScreenshotInfo) => {
    const {abbr, bg, textColor} = idToScreenshotInfo[teamId];
    document.querySelector("#team-abbr").innerHTML = abbr;
    document.querySelector("#record").innerHTML = record;
    document.querySelector("#last-ten").innerHTML = lastTen;
    document.querySelector("#games-back").innerHTML = `${gamesBack} GB`;
    document.querySelector("#mlb-rank").innerHTML = sportRank;
    document.querySelector("#template-mask").style.backgroundColor = bg;
    textColor && document.documentElement.style.setProperty("--text-color", textColor);
    document.getElementById("suck-meter").innerHTML = "";
    Gauge(
        document.getElementById("suck-meter"),
        {
          dialRadius: 40,
          dialStartAngle: 135,
          dialEndAngle: 45,
          value: meter,
          max: 100,
          min: 0,
          valueDialClass: "value",
          valueClass: "value-text",
          dialClass: "dial",
          gaugeClass: "gauge",
          showValue: true,
          gaugeColor: null,
          color: function(val) {
            return val < 10 ?
            "#3ecb1c" :
            val < 25 ?
              "#49e722" :
              val < 40 ?
                "#f1f200" :
                val < 60 ?
                  "#f2b100" :
                  val < 75 ?
                    "#e64646" :
                    val < 90 ?
                      "#cb2424" :
                      "#b30000";
          },
          label: function(val) {
            return meter.toFixed(1);
          },
        },
    );
  }, payload, idToScreenshotInfo);
  const template = await page.$("#template-container");
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR);
  }
  const imageFilePath = `${TMP_DIR}/${payload.teamId}.png`;
  await template.screenshot({path: imageFilePath});
  await browser.close();
  return imageFilePath;
}

module.exports = {
  getImage,
  meter,
  processGames,
  suckMeterReport,
};
