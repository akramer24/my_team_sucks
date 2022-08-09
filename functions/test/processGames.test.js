const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const {TwitterApi} = require("twitter-api-v2");
const dummyGames = require("./dummyGamesData.json");
const dummyStandings = require("./dummyStandingsData.json");
const {StatsRoutes, Collections, Sports} = require("../enums");
const initializeFirebaseAdmin = require("../initializeFirebaseAdmin");
const {tweet, processGames} = require("../processGames");

// This sets the mock adapter on the default instance
const mock = new MockAdapter(axios);

// Mock any GET request to API endpoints
// arguments for reply are (status, data, headers)
mock.onGet(StatsRoutes.GAMES).reply(200, dummyGames);
mock.onGet(StatsRoutes.STANDINGS).reply(200, dummyStandings);

describe("processGames.js", () => {
  let firestore;

  beforeAll(() => {
    const admin = initializeFirebaseAdmin();
    firestore = admin.firestore();
  });

  beforeEach(jest.clearAllMocks);

  describe("tweet", () => {
    it("calls tweet with the passed data", async () => {
      await tweet("test");
      expect(TwitterApi.mockTweet).toHaveBeenCalledTimes(1);
      expect(TwitterApi.mockTweet).toHaveBeenCalledWith("test", {});
    });
  });

  describe("processGames", () => {
    it("processes the games", async () => {
      await processGames(firestore);
      // Dummy data includes 13 games, 10 of which are final
      // This results in 20 tweets
      expect(TwitterApi.mockTweet).toHaveBeenCalledTimes(20);
      const teamsSnap = await firestore
          .collection(Collections.SPORT)
          .doc(Sports.BASE)
          .collection(Collections.YEAR)
          .doc("2022")
          .collection(Collections.TEAMS)
          .get();
      const results = [];
      teamsSnap.forEach((doc) => {
        results.push(doc.data());
      });
      expect(results).toEqual(
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
    });
  });
});

