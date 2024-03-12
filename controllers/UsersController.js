import dbClient from '../utils/db';
import sha1 from 'sha1';
import {v4 as uuidv4} from 'uuid';

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
            _id: uuidv4(),
        };

        await dbClient.db.collection('users').insertOne(newUser);

        return res.status(201).json({ email: newUser.email, id: newUser._id });
    }
};

export default UsersController;
