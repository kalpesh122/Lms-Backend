import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({path:`${__dirname}/../../../config/api/config.env`});



const REDIS_URL = process.env.REDIS_URL || '';
const redis = new Redis(REDIS_URL,{
    tls:{
        rejectUnauthorized:false
    }
});

export { redis };

