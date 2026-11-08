import mongoose from 'mongoose';

export async function connectDB(){
    const uri = process.env.MONGODB_URI ; 
    if(!uri){
        throw new Error("MONGODB_URI is missing from the environment");
    }
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${mongoose.connection.host}`)
}