import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const UsersController = {
  async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    const userExists = await dbClient.users.findOne({ email });
    if (userExists) return res.status(400).json({ error: 'Already exists' });

    const hashedPassword = sha1(password);

    const newUser = {
      email,
      password: hashedPassword,
    };
    try {
      const result = await dbClient.db.collection('users').insertOne(newUser);
      const { insertedId } = result;
      return res.status(201).json({ email: newUser.email, id: insertedId });
    } catch (error) {
      return res.status(500).json({ error: 'Error creating user' });
    }
  },

  async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    // console.log('User ID', typeof userId)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.users.findOne({ _id: userId });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ id: user._id, email: user.email });
  },
};

export default UsersController;
