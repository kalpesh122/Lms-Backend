import mongoose from 'mongoose';

const connectDB = async (dbUrl: string) => {
  try {
    await mongoose.connect(dbUrl).then((data: any) => {
      console.log(`Database connected with ${data.connection.host}`);
    });
  } catch (error: any) {
    console.log(error.message);
    setTimeout(connectDB, 6000);
  }
};

export default connectDB;
