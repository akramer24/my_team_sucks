const Collections = Object.freeze({
  SPORT: "sport",
  YEAR: "year",
  TEAMS: "teams",
  HISTORY: "history",
  GAMES: "games",
});

const Sports = Object.freeze({
  BASE: "base",
});

const StatsRoutes = Object.freeze({
  GAMES: "http://statsapi.mlb.com/api/v1/schedule/games/?sportId=1",
  STANDINGS: "https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2022&standingsTypes=regularSeason&hydrate=team",
});

module.exports = {
  Collections,
  Sports,
  StatsRoutes,
};
