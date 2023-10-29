import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({path:`${__dirname}/../../../config/api/config.env`});


console.log(process.env.REDIS_URL,"GRE");

const REDIS_URL = process.env.REDIS_URL || '';
const redis = new Redis(REDIS_URL);

export { redis };
