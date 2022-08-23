const twitter = jest.createMockFromModule("twitter-api-v2");

class MockTwitterApi {
  constructor({appKey, appSecret, accessToken, accessSecret}) {
    this.v2 = {tweet: MockTwitterApi.mockTweet};
    this.v1 = {uploadMedia: MockTwitterApi.mockUploadMedia};
  }
}

MockTwitterApi.mockTweet = jest.fn(() => ({data: {id: "test-tweet-id"}}));
MockTwitterApi.mockUploadMedia = jest.fn(() => "test-media-id");

twitter.TwitterApi = MockTwitterApi;

module.exports = twitter;
