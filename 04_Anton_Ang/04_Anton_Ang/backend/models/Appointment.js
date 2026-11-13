const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 patient:{type:mongoose.Schema.Types.ObjectId,ref:'Patient',required:true},
 dentist:{type:mongoose.Schema.Types.ObjectId,ref:'Dentist'},
 appointmentDate:{type:Date,required:true},reason:{type:String,required:true,trim:true},
 status:{type:String,enum:['scheduled','completed','cancelled'],default:'scheduled'},
 notes:{type:String,trim:true}
},{timestamps:true});
module.exports=mongoose.model('Appointment',schema);
