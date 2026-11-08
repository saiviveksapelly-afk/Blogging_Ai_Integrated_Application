import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
    username : {
        type:String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true,
    },
    email:{
        type:String,
        required :true,
        unique:true,
        trim:true,
        lowercase:true,
    },
    passwordHash :{
        type:String ,
        required : true,
        select:false,

    },
    avatarURL :{
        type:String,
        default : '/avatars/default.png'
    },
},{
    timestamps:true
})
const BlogUser =
  mongoose.models.BlogUser ||
  mongoose.model("BlogUser", userSchema, "blogusers");

export default BlogUser;