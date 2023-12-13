import { v2 as cloudinary } from 'cloudinary';
import http from 'http';
import connectDB from './utils/db';
import { initSocketServer } from './socketServer';
import { app } from './app';
import dotenv from 'dotenv';
const server = http.createServer(app);

dotenv.config({ path: `${__dirname}/../../config/api/config.env` });

// variables
const dbUrl: string = process.env.DB_URL || '';
const Port: string = process.env.PORT || '8000';

// cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_SECRET_KEY,
});

initSocketServer(server);

// create server
server.listen(Port, () => {
  console.log(`Server is connected with port ${Port}`);
  connectDB(dbUrl);
});
