const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const {TwitterApi} = require("twitter-api-v2");
const dummyGames = require("./dummyGamesData.json");
const dummyStandings = require("./dummyStandingsData.json");
const {StatsRoutes, Collections, Sports} = require("../enums");
const initializeFirebaseAdmin = require("../initializeFirebaseAdmin");
const {Seeder} = require("./seed");
const {MlbBot} = require("../mlbBot");

// This sets the mock adapter on the default instance
const mock = new MockAdapter(axios);

// Mock any GET request to API endpoints
// arguments for reply are (status, data, headers)
mock.onGet(StatsRoutes.GAMES).reply(200, dummyGames);
mock.onGet(StatsRoutes.STANDINGS).reply(200, dummyStandings);

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  unlinkSync: jest.fn(),
}));

const fs = require("fs");

describe("MlbBot", () => {
  let firestore;
  let bot;

  beforeAll(() => {
    const admin = initializeFirebaseAdmin();
    firestore = admin.firestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    bot = new MlbBot(firestore);
  });

  it("processGames fetches the day's games and tweets/stores info on new final scores", async () => {
    jest.spyOn(bot, "_getImage").mockImplementation(() => Promise.resolve("test-file-path"));
    await bot.processGames(firestore);
    // Dummy data includes 13 games, 10 of which are final
    // This results in 20 tweets
    expect(TwitterApi.mockTweet).toHaveBeenCalledTimes(20);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(20);
    expect(fs.unlinkSync).toHaveBeenCalledWith("test-file-path");
    const teamsSnap = await firestore
        .collection(Collections.SPORT)
        .doc(Sports.BASE)
        .collection(Collections.YEAR)
        .doc("2022")
        .collection(Collections.TEAMS)
        .get();
    const teamResults = [];
    teamsSnap.forEach((doc) => {
      teamResults.push(doc.data());
    });
    expect(teamResults).toEqual(
        [
          {meter: 58.558499999999995, name: "Boston Red Sox", id: "111"},
          {meter: 85.25049999999999, name: "Chicago Cubs", id: "112"},
          {meter: 51.536770000000004, name: "Cleveland Guardians", id: "114"},
          {meter: 84.58993000000001, name: "Colorado Rockies", id: "115"},
          {meter: 92.27217, name: "Detroit Tigers", id: "116"},
          {meter: 12.023440000000004, name: "Houston Astros", id: "117"},
          {meter: 90.34079, name: "Kansas City Royals", id: "118"},
          {
            meter: -2.7618299999999945,
            name: "Los Angeles Dodgers",
            id: "119",
          },
          {meter: 11.702959999999997, name: "New York Mets", id: "121"},
          {meter: 85.00218000000001, name: "Pittsburgh Pirates", id: "134"},
          {meter: 33.54529999999999, name: "San Diego Padres", id: "135"},
          {meter: 68.40193000000001, name: "San Francisco Giants", id: "137"},
          {meter: 34.03690999999999, name: "St. Louis Cardinals", id: "138"},
          {meter: 44.44464000000001, name: "Tampa Bay Rays", id: "139"},
          {meter: 75.85579000000001, name: "Texas Rangers", id: "140"},
          {meter: 34.24370999999999, name: "Toronto Blue Jays", id: "141"},
          {meter: 46.479839999999996, name: "Minnesota Twins", id: "142"},
          {meter: 23.30944000000001, name: "Atlanta Braves", id: "144"},
          {meter: 48.39277, name: "Chicago White Sox", id: "145"},
          {meter: 35.748909999999995, name: "Milwaukee Brewers", id: "158"},
        ],
    );

    const gamesSnap = await firestore
        .collection(Collections.SPORT)
        .doc(Sports.BASE)
        .collection(Collections.YEAR)
        .doc("2022")
        .collection(Collections.GAMES)
        .get();

    const gameResults = [];
    gamesSnap.forEach((doc) => {
      gameResults.push(doc.data());
    });

    expect(gameResults).toEqual(
        [
          {date: "2022-08-04", id: "661660", loser: {id: "142", name: "Minnesota Twins", score: 3}, teamUpdates: ["141", "142"], tweets: ["141", "142"], winner: {id: "141", name: "Toronto Blue Jays", score: 9}},
          {date: "2022-08-04", id: "661817", loser: {id: "145", name: "Chicago White Sox", score: 2}, teamUpdates: ["145", "140"], tweets: ["145", "140"], winner: {id: "140", name: "Texas Rangers", score: 3}},
          {date: "2022-08-04", id: "661945", loser: {id: "112", name: "Chicago Cubs", score: 3}, teamUpdates: ["138", "112"], tweets: ["138", "112"], winner: {id: "138", name: "St. Louis Cardinals", score: 4}},
          {date: "2022-08-04", id: "662114", loser: {id: "137", name: "San Francisco Giants", score: 3}, teamUpdates: ["119", "137"], tweets: ["119", "137"], winner: {id: "119", name: "Los Angeles Dodgers", score: 5}},
          {date: "2022-08-04", id: "662219", loser: {id: "135", name: "San Diego Padres", score: 3}, teamUpdates: ["135", "115"], tweets: ["135", "115"], winner: {id: "115", name: "Colorado Rockies", score: 7}},
          {date: "2022-08-04", id: "662303", loser: {id: "158", name: "Milwaukee Brewers", score: 4}, teamUpdates: ["158", "134"], tweets: ["158", "134"], winner: {id: "134", name: "Pittsburgh Pirates", score: 5}},
          {date: "2022-08-04", id: "662419", loser: {id: "144", name: "Atlanta Braves", score: 4}, teamUpdates: ["121", "144"], tweets: ["121", "144"], winner: {id: "121", name: "New York Mets", score: 6}},
          {date: "2022-08-04", id: "662651", loser: {id: "111", name: "Boston Red Sox", score: 3}, teamUpdates: ["111", "118"], tweets: ["111", "118"], winner: {id: "118", name: "Kansas City Royals", score: 7}},
          {date: "2022-08-04", id: "662812", loser: {id: "116", name: "Detroit Tigers", score: 2}, teamUpdates: ["139", "116"], tweets: ["139", "116"], winner: {id: "139", name: "Tampa Bay Rays", score: 6}},
          {date: "2022-08-04", id: "662975", loser: {id: "114", name: "Cleveland Guardians", score: 0}, teamUpdates: ["114", "117"], tweets: ["114", "117"], winner: {id: "117", name: "Houston Astros", score: 6}},
        ],
    );
  });

  it("suckMeterReport tweets the suck meter rankings", async () => {
    const seeder = new Seeder(firestore);
    await seeder.seedTeams();
    await bot.suckMeterReport();
    expect(TwitterApi.mockTweet).toHaveBeenCalledTimes(3);
    expect(TwitterApi.mockTweet.mock.calls[0]).toEqual(
        [`Daily Suck Meter Report
1 #NATITUDE 113.3
2 #DrumTogether 105.4
3 #DetroitRoots 99.6
4 #ATOBTTR 91.4
5 #LetsGoBucs 87.3
6 #StraightUpTX 81.2
7 #TogetherRoyal 79.4
8 #MakeItMiami 78.5
9 #GoHalos 78.0
10 #ItsDifferentHere 76.8`,
        {},
        ],
    );
    expect(TwitterApi.mockTweet.mock.calls[1]).toEqual(
        [`Daily Suck Meter Report Pt. 2
11 #Rockies 75.9
12 #Dbacks 69.2
13 #SFGameUp 65.3
14 #DirtyWater 61.7
15 #ChangeTheGame 51.7
16 #RaysUp 48.2
17 #Birdland 47.4
18 #MNTwins 46.9
19 #ThisIsMyCrew 44.6
20 #NextLevel 42.1
21 #ForTheLand 38.9`,
        {"reply": {"in_reply_to_tweet_id": "test-tweet-id"}},
        ],
    );
    expect(TwitterApi.mockTweet.mock.calls[2]).toEqual(
        [`Daily Suck Meter Report Pt. 3
22 #TimeToShine 37.8
23 #SeaUsRise 36.7
24 #RingTheBell 28.9
25 #STLCards 28.6
26 #ForTheA 26.4
27 #RepBX 24.3
28 #LevelUp 10.8
29 #LGM 6.7
30 #AlwaysLA -7.3`,
        {"reply": {"in_reply_to_tweet_id": "test-tweet-id"}},
        ],
    );
  });

  it("_meter returns the correct numeric value", () => {
    expect(bot._meter({gamesBack: 10, winningPercentage: 0.5, lastTenPct: 0.3, sportRank: 12})).toEqual(54.84299999999999);
    expect(bot._meter({gamesBack: 5, winningPercentage: 0.6, lastTenPct: 0.3, sportRank: 8})).toEqual(32.885000000000005);
  });

  it("_getGameId receives a game object and returns the string id", () => {
    expect(bot._getGameId({gamePk: 100})).toEqual("100");
  });

  it("_getTeamsFromGame returns winner and loser objects", () => {
    expect(
        bot._getTeamsFromGame(
            {
              teams: {
                away: {isWinner: true, team: {name: "New York Yankees", id: 147}, score: 10},
                home: {isWinner: false, team: {name: "New York Mets", id: 121}, score: 3},
              },
            },
        ),
    ).toEqual(
        {
          winner: {name: "New York Yankees", id: "147", score: 10},
          loser: {name: "New York Mets", id: "121", score: 3},
        },
    );
  });

  [["Final", true], ["Game Over", false], ["In Progress", false]].forEach(([status, result]) => {
    it(`_isFinal returns ${result} if the game status is ${status}`, () => {
      expect(bot._isFinal({status: {detailedState: status}})).toEqual(result);
    });
  });

  it("_getDateToProcess returns the date from the response", async () => {
    expect(await bot._getDateToProcess()).toEqual("2022-08-04");
  });
});
