import express from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: Record<string, any>;
    }
  }
}
declare module 'node-cron';
declare module 'nodemailer';
