const axios = require("axios");

const { Sports, StatsRoutes } = require("./enums");
const { Bot } = require("./bot");

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

class MlbBot extends Bot {
  constructor(firestore) {
    super({ firestore, idToHashtag, idToScreenshotInfo, sport: Sports.BASE, year: "2022" });
  }

  async processGames() {
    const date = await this._getDateToProcess();
    const newFinals = await this._getNewFinals(date);

    if (newFinals.count) {
      const standingsRes = await axios.get(StatsRoutes.STANDINGS);
      for (const division of standingsRes.data?.records) {
        for (const entry of division.teamRecords) {
          const teamId = String(entry.team.id);
          if (!newFinals.teams[teamId]) {
            continue;
          }
          const { gameId, name: teamName, tweet: pendingTweet } = newFinals.teams[teamId];
          if (pendingTweet) {
            const gamesBack = parseFloat(entry.gamesBack.replace("-", "0").replace("+", "-"));
            const lastTen = entry.records.splitRecords.find((rec) => rec.type === "lastTen");
            const sportRank = parseFloat(entry.sportRank);
            const meterResult = this._meter({
              gamesBack,
              winningPercentage: parseFloat(entry.winningPercentage),
              sportRank,
              lastTenPct: parseFloat(lastTen.pct),
            });
            let eliminationMessage;
            if (entry.gamesPlayed > 120) {
              const league = entry.team.league.id === 103 ? "AL" : "NL";
              const division = entry.team.division.name.replace("American League", "AL").replace("National League", "NL");
              if (entry.divisionLeader) {
                eliminationMessage = entry.divisionChamp ?
                  `They are the ${division} champs.` :
                  `Their magic number to clinch the ${division} is ${entry.magicNumber}.`;
              } else if (entry.wildCardRank && Number(entry.wildCardRank) <= 3) {
                eliminationMessage = `They hold the ${league}'s No. ${entry.wildCardRank} WC spot. Their ${division} elimination number is ${entry.eliminationNumber}.`;
              } else {
                const wcEliminationNumber = Number(entry.wildCardEliminationNumber);
                eliminationMessage = Number.isNaN(wcEliminationNumber) || wcEliminationNumber === 0 ?
                  'They are eliminated from playoff contention.' :
                  `They are ${entry.wildCardGamesBack} GB for the ${league} wild card with an elimination number of ${entry.wildCardEliminationNumber}.`;
              }
            }
            const tail = `Their suck meter is now ${meterResult.toFixed(1)}\n\n${idToHashtag[teamId]}`;
            const finalTweet = `${pendingTweet} ${eliminationMessage ? ` ${eliminationMessage}\n\n${tail}` : tail}`;
            await this._tweetAndUpdateDb({
              message: finalTweet,
              teamId,
              teamName,
              record: `${entry.leagueRecord.wins}-${entry.leagueRecord.losses}`,
              lastTen: `${lastTen.wins}-${lastTen.losses}`,
              gamesBack,
              meter: meterResult,
              sportRank,
              date,
              gameId,
            });

            newFinals.games[gameId].tweets.push(teamId);
            newFinals.games[gameId].teamUpdates.push(teamId);
          }
        }
      }

      await this._storeProcessedGames(newFinals.games);
    } else {
      console.log("No new final scores to process as of", Date.now());
    }
  }

  _meter({
    gamesBack,
    winningPercentage,
    lastTenPct,
    sportRank,
  }) {
    return 113.28 +
      (.307 * gamesBack) -
      (158.47 * winningPercentage) +
      (1.144 * sportRank) -
      ((lastTenPct) - .500) * 20;
  }

  _getGameId(game) {
    return String(game.gamePk);
  }

  _getTeamsFromGame(game) {
    const { away, home } = game.teams;
    const { winner, loser } = away.isWinner ? ({ winner: away, loser: home }) : ({ winner: home, loser: away });
    const winnerId = String(winner.team.id);
    const loserId = String(loser.team.id);
    return {
      winner: { name: winner.team.name, id: winnerId, score: winner.score },
      loser: { name: loser.team.name, id: loserId, score: loser.score },
    };
  }

  _isFinal(game) {
    return game.status.detailedState === "Final";
  }

  async _getDateToProcess() {
    const allGamesRes = await axios.get(StatsRoutes.GAMES);
    return allGamesRes.data.dates[0]?.date;
  }

  async _getGamesForDate(date) {
    const allGamesRes = await axios.get(StatsRoutes.GAMES);
    return allGamesRes.data.dates[0]?.games;
  }
}

module.exports = { MlbBot };
