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
const {Collections} = require("./enums");


class Bot {
  constructor({firestore, idToHashtag, idToScreenshotInfo, sport, year}) {
    this.twitterClient = new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_KEY_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
    });
    this.firestore = firestore;
    this.idToHashtag = idToHashtag;
    this.idToScreenshotInfo = idToScreenshotInfo;
    this.sport = sport;
    this.year = year;

    const useFake = process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "test";

    this.tmpDir = useFake ? "tmp" : "/tmp";
    this.appBaseUrl = useFake ? "http://localhost:8081" : "https://my-team-sucks.web.app";
  }

  async processGames() {
    throw new Error("processGames must be implemented.");
  }

  async suckMeterReport() {
    const teamsSnap = await this.firestore
        .collection(Collections.SPORT)
        .doc(this.sport)
        .collection(Collections.YEAR)
        .doc(this.year)
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
${rank} ${this.idToHashtag[id]} ${meter.toFixed(1)}`;

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
      const res = await this.twitterClient.v2.tweet(message, options);
      inReplyTo = res.data.id;
    }
  }

  async _tweetAndUpdateDb({
    message,
    teamId,
    gameId,
    teamName,
    date,
    record,
    lastTen,
    gamesBack,
    meter,
    sportRank,
  }) {
    const imageFilePath = await this._getImage({
      teamId,
      record,
      lastTen,
      gamesBack,
      meter,
      sportRank,
    });

    // const mediaId = await this.twitterClient.v1.uploadMedia(imageFilePath);
    // await this.twitterClient.v2.tweet(message, {media: {media_ids: [mediaId]}});
    fs.unlinkSync(imageFilePath);

    const teamRef = this.firestore
        .collection(Collections.SPORT)
        .doc(this.sport)
        .collection(Collections.YEAR)
        .doc(this.year)
        .collection(Collections.TEAMS)
        .doc(teamId);
    await teamRef.set({id: teamId, name: teamName, meter}, {merge: true});
    await teamRef
        .collection(Collections.HISTORY)
        .doc(date)
        .set({gameId, meter});
  }

  async _getStoredGameIdsForDate(date) {
    const gamesRef = this.firestore
        .collection(Collections.SPORT)
        .doc(this.sport)
        .collection(Collections.YEAR)
        .doc(this.year)
        .collection(Collections.GAMES);

    const storedTodayGamesSnap = await gamesRef.where("date", "==", date).get();
    const storedGameIds = new Set();
    storedTodayGamesSnap.forEach((doc) => {
      storedGameIds.add(doc.id);
    });
    return storedGameIds;
  }

  async _getNewFinals(date) {
    const storedGameIds = await this._getStoredGameIdsForDate(date);
    const games = await this._getGamesForDate(date);

    return games.reduce((result, game) => {
      const gameId = this._getGameId(game);
      if (this._isFinal(game) && !storedGameIds.has(gameId)) {
        result.count += 1;
        const {winner, loser} = this._getTeamsFromGame(game);

        result.games[gameId] = {
          id: gameId,
          date,
          winner,
          loser,
          tweets: [],
          teamUpdates: [],
        };
        result.teams[winner.id] = {tweet: `The ${winner.name} beat the ${loser.name}, ${winner.score}-${loser.score}.`, name: winner.name, gameId};
        result.teams[loser.id] = {tweet: `The ${loser.name} lost to the ${winner.name}, ${winner.score}-${loser.score}.`, name: loser.name, gameId};
      }
      return result;
    }, {games: {}, teams: {}, count: 0});
  }

  async _getImage(payload) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(`${this.appBaseUrl}/graphic-template.html`);
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
      document.querySelector("#sport-rank").innerHTML = sportRank;
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
    }, payload, this.idToScreenshotInfo);
    const template = await page.$("#template-container");
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir);
    }
    const imageFilePath = `${this.tmpDir}/${payload.teamId}.png`;
    await template.screenshot({path: imageFilePath});
    await browser.close();
    return imageFilePath;
  }

  async _storeProcessedGames(games) {
    return Promise.all(Object.entries(games).map(([gameId, gameData]) => {
      return this.firestore
          .collection(Collections.SPORT)
          .doc(this.sport)
          .collection(Collections.YEAR)
          .doc(this.year)
          .collection(Collections.GAMES)
          .doc(gameId)
          .set(gameData);
    }));
  }

  _meter({
    gamesBack,
    winningPercentage,
    lastTenPct,
    sportRank,
  }) {
    throw new Error("_meter must be implemented.");
  }

  _getGameId(game) {
    throw new Error("_getGameId must be implemented.");
  }

  _getTeamsFromGame(game) {
    throw new Error("_getTeamsFromGame must be implemented.");
  }

  _isFinal(game) {
    throw new Error("_isFinal must be implemented.");
  }

  async _getDateToProcess() {
    throw new Error("_getDateToProcess must be implemented.");
  }

  async _getGamesForDate() {
    throw new Error("_getGamesForDate must be implemented.");
  }
}

module.exports = {Bot};
