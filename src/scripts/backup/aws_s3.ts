import mongoose from 'mongoose';
import { S3, SQS } from 'aws-sdk';
import 'dotenv/config';

const MONGODB_URL: string = process.env.DB_URL || '';
const AWS_REGION = process.env.AWS_REGION || '';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const AWS_S3_API_VERSION = process.env.AWS_S3_API_VERSION || '2006-03-01';
const AWS_S3_SIGNATURE_VERSION = process.env.AWS_S3_SIGNATURE_VERSION || 'v4';

const AWS_SQS_QUEUE_URL = process.env.AWS_SQS_QUEUE_URL || '';

// AWS S3 Configuration
const s3 = new S3({
  apiVersion: AWS_S3_API_VERSION,
  region: AWS_REGION,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  signatureVersion: AWS_S3_SIGNATURE_VERSION,
});

const sqs = new SQS({
  region: AWS_REGION,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  signatureVersion: AWS_S3_SIGNATURE_VERSION,
});

//  MongoDB Connection using Mongoose
async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URL, {});
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

//  To fetch collections
async function fetchAllCollections() {
  try {
    const connection = mongoose.connection;
    const collections = await connection.db.listCollections().toArray();
    return collections.map(collection => collection.name);
  } catch (error) {
    console.error('Error fetching collections:', error);
    return [];
  }
}

// Fetch All Data for Each Collection
const fetchDataForCollection = async (collectionName: string) => {
  const Model = mongoose.model(
    collectionName,
    new mongoose.Schema({}, { strict: false })
  );
  return Model.find().lean();
};

// Create a Folder on AWS S3 for Each Collection
const createS3Folder = async (collectionName: string): Promise<string> => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();
  const currentYear = currentDate.getFullYear();

  const monthsWithDays = {
    1: 31,
    2: currentYear % 4 === 0 ? 29 : 28,
    3: 31,
    4: 30,
    5: 31,
    6: 30,
    7: 31,
    8: 31,
    9: 30,
    10: 31,
    11: 30,
    12: 31,
  };

  const getFormattedDate = (date: Date) => {
    return date
      .toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '-');
  };

  const createFolderIfNotExists = async (
    folderKey: string
  ): Promise<string> => {
    try {
      await s3
        .headObject({
          Bucket: 'backup-authapp',
          Key: folderKey,
        })
        .promise();
      console.log(`Folder '${folderKey}' already exists.`);
    } catch (err) {
      await s3
        .putObject({
          Bucket: 'backup-authapp',
          Key: folderKey,
          Body: '',
        })
        .promise();
      console.log(`Folder '${folderKey}' created.`);
    }
    return `${folderKey}`;
  };

  const yearFolderKey = `${collectionName}/${currentYear}/`;
  const monthFolderKey = `${yearFolderKey}${currentMonth}/`;
  const dayFolderKey = `${monthFolderKey}${currentDay}/`;

  await createFolderIfNotExists(yearFolderKey);
  await createFolderIfNotExists(monthFolderKey);
  await createFolderIfNotExists(dayFolderKey);

  return `${dayFolderKey}`;
};

// s3 Upload functionality
const uploadDataToS3 = async (
  collectionName: string,
  data: any[],
  s3Path: string
) => {
  const chunkSize = 2000;
  console.log(data.length);
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const time = currentDate.split('/');

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const chunkNumber = Math.ceil((i + 1) / chunkSize);
    const uploadKey = `${s3Path}chunk-${chunkNumber}.json`;

    const uploadParams = {
      Bucket: 'backup-authapp',
      Key: uploadKey,
      Body: JSON.stringify(chunk),
    };

    try {
      console.log(`Uploading chunk ${chunkNumber} to S3...`);
      const uploadedObject = await s3.upload(uploadParams).promise();
      console.log(
        `Chunk ${chunkNumber} uploaded successfully: ${uploadedObject.Location}`
      );
    } catch (error) {
      await handleChunkUploadFailure(collectionName, chunkNumber);
      console.error(`Error uploading chunk ${chunkNumber}:`, error);
    }
  }
};

// Handling Chunk Upload Failures and Send SQS Message

const handleChunkUploadFailure = async (
  collectionName: string,
  chunkNumber: number
) => {
  const message = {
    Collection: collectionName,
    ChunkNumber: chunkNumber,
    Timestamp: new Date().toISOString(),
  };

  await sqs
    .sendMessage({
      QueueUrl: AWS_SQS_QUEUE_URL,
      MessageBody: JSON.stringify(message),
    })
    .promise();
};

//

// Send SQS Message After Full Data Upload
const sendFullDataUploadMessage = async (
  collectionName: string,
  totalChunks: number,
  uploadedChunks: number
) => {
  const message = {
    Collection: collectionName,
    TotalChunks: totalChunks,
    UploadedChunks: uploadedChunks,
    Timestamp: new Date().toISOString(),
  };

  await sqs
    .sendMessage({
      QueueUrl: AWS_SQS_QUEUE_URL,
      MessageBody: JSON.stringify(message),
    })
    .promise();
};
//

// Main function to up the  backup process
(async () => {
  try {
    await connectToMongoDB();

    let collectionNames = await fetchAllCollections();
    console.log(collectionNames);

    for (const collectionName of collectionNames) {
      const data = await fetchDataForCollection(collectionName);

      let s3Path = await createS3Folder(collectionName);

      await uploadDataToS3(collectionName, data, s3Path);

      await sendFullDataUploadMessage(
        collectionName,
        Math.ceil(data.length / 2000),
        Math.ceil(data.length / 2000)
      );
    }
  } catch (error) {
    console.error('Backup process failed:', error);
  } finally {
    mongoose.disconnect();
  }
})();
