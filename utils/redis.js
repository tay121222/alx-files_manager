import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.getAsync = promisify(this.client.get).bind(this.client);
    this.client.setexAsync = promisify(this.client.setex).bind(this.client);
    this.client.on('error', (error) => {
      console.error('Error:', error);
    });
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    return this.client.getAsync(key);
  }

  async set(key, value, duration) {
    return this.client.setexAsync(key, duration, value);
  }

  async del(key) {
    this.client.del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
