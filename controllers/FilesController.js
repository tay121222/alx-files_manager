import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ObjectID } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const mime = require('mime-types');

class FilesController {
  static async postUpload(req, res) {
    try {
      const {
        name, type, data, parentId = 0, isPublic = false,
      } = req.body;
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userId = await redisClient.get(`auth_${token}`);
      console.log('UserID', userId);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }
      if (!type || !['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if ((type === 'file' || type === 'image') && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      if (parentId !== 0) {
        const parentFile = await dbClient.files.findOne({ _id: ObjectID(parentId) });
        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      let fileDocument;
      if (type === 'folder') {
        fileDocument = await dbClient.files.insertOne({
          name,
          type,
          userId: ObjectID(userId),
          parentId: parentId === 0 ? parentId : ObjectID(parentId),
          isPublic,
        });
      } else {
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        const filePath = `${folderPath}/${uuidv4()}`;
        const fileContent = Buffer.from(data, 'base64');
        fs.writeFileSync(filePath, fileContent);

        fileDocument = await dbClient.files.insertOne({
          name,
          type,
          userId: ObjectID(userId),
          parentId: parentId === 0 ? parentId : ObjectID(parentId),
          isPublic,
          localPath: filePath,
        });
      }
      const fileId = fileDocument.ops[0]._id;
      return res.status(201).json({
        id: fileId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });

      // return res.status(201).json(simpleResponse);
    } catch (error) {
      console.error('Error uploading file:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getShow(req, res) {
    try {
      const { id } = req.params;
      const token = req.headers['x-token'];

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const file = await dbClient.files.findOne({ _id: ObjectID(id), userId: ObjectID(userId) },
        {
          projection: {
            _id: 1, userId: 1, name: 1, type: 1, isPublic: 1, parentId: 1,
          },
        });
      if (!file) {
        console.log('Check', file);
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json(file);
    } catch (error) {
      console.error('Error fetching file:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getIndex(req, res) {
    try {
      const token = req.headers['x-token'];

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const parentId = req.query.parentId || '0';
      const page = parseInt(req.query.page || '0', 10);
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectID(userId) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      let aggreData = [
        { $match: { userId: ObjectID(userId) } },
        { $match: { parentId: parentId === '0' ? '0' : ObjectID(parentId) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ];
      if (parentId === '0') {
        aggreData = [
          { $match: { userId: ObjectID(userId) } },
          { $skip: page * 20 }, { $limit: 20 }];
      }

      const files = await dbClient.db
        .collection('files')
        .aggregate(aggreData).toArray();

      const filesArray = files.map((item) => ({
        id: item._id,
        userId: item.userId,
        name: item.name,
        type: item.type,
        isPublic: item.isPublic,
        parentId: item.parentId,
      }));

      return res.json(filesArray);
    } catch (error) {
      console.error('Error fetching files:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async putPublish(req, res) {
    try {
      const id = req.params.id || '';
      const token = req.headers['x-token'];

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const file = await dbClient.db.collection('files').findOne({
        _id: ObjectID(id),
        userId: ObjectID(userId),
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      await dbClient.db.collection('files').updateOne(
        { _id: ObjectID(id) },
        { $set: { isPublic: true } },
      );

      return res.status(200).json({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: true,
        parentId: file.parentId,
      });
    } catch (error) {
      console.error('Error publishing file:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async putUnpublish(req, res) {
    try {
      const { id } = req.params;
      const token = req.headers['x-token'];

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const file = await dbClient.db.collection('files').findOne({
        _id: ObjectID(id),
        userId: ObjectID(userId),
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      await dbClient.db.collection('files').updateOne(
        { _id: ObjectID(id) },
        { $set: { isPublic: false } },
      );

      return res.status(200).json({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: false,
        parentId: file.parentId,
      });
    } catch (error) {
      console.error('Error unpublishing file:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getFile(request, response) {
    try {
      const fileId = request.params.id || '';
      const size = request.query.size || 0;

      const file = await dbClient.db.collection('files').findOne({ _id: ObjectID(fileId) });
      if (!file) return response.status(404).send({ error: 'Not found' });

      const {
        isPublic, userId, type, localPath, name,
      } = file;

      const token = request.headers['x-token'];
      const userIdFromToken = token ? await redisClient.get(`auth_${token}`) : null;

      if ((!isPublic && !userIdFromToken)
       || (userIdFromToken && userId.toString() !== userIdFromToken && !isPublic)) {
        return response.status(404).send({ error: 'Not found' });
      }

      if (type === 'folder') {
        return response.status(400).send({ error: "A folder doesn't have content" });
      }

      const path = size === 0 ? localPath : `${localPath}_${size}`;

      if (!fs.existsSync(path)) {
        return response.status(404).send({ error: 'Not found' });
      }

      const mimeType = mime.lookup(name);
      const fileData = fs.readFileSync(path);

      response.setHeader('Content-Type', mimeType);
      return response.status(200).send(fileData);
    } catch (error) {
      console.error('Error fetching file:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }
}
export default FilesController;
