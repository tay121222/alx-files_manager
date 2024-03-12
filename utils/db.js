import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const uri = `mongodb://${host}:${port}/${database}`;

    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
      if (err) {
        console.error('MongoDB Connection Error:', err);
      } else {
        this.client = client;
        this.db = this.client.db();
        this.users = this.db.collection('users');
      }
    });
  }

  isAlive() {
    return !!this.client;
  }

  async nbUsers() {
    return this.isAlive() ? this.client.db().collection('users').countDocuments() : 0;
  }

  async nbFiles() {
    return this.isAlive() ? this.client.db().collection('files').countDocuments() : 0;
  }
}

const dbClient = new DBClient();
export default dbClient;
