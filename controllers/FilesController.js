import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ObjectID } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

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
          name, type, userId: ObjectID(userId),
	  parentId: parentId === 0 ? parentId : ObjectID(parentId), isPublic,
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
}

export default FilesController;
