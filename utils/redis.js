import redis from 'redis';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (error) => {
      console.error('Error:', error);
    });
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    return new Promise((resolve) => {
      this.client.get(key, (error, value) => {
        resolve(value);
      });
    });
  }

  async set(key, value, duration) {
    this.client.setex(key, duration, value);
  }
}
const redisClient = new RedisClient();
export default redisClient;
