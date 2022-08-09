const twitter = jest.createMockFromModule("twitter-api-v2");

class MockTwitterApi {
  constructor({appKey, appSecret, accessToken, accessSecret}) {
    this.v2 = {tweet: MockTwitterApi.mockTweet};
  }
}

MockTwitterApi.mockTweet = jest.fn();

twitter.TwitterApi = MockTwitterApi;

module.exports = twitter;
