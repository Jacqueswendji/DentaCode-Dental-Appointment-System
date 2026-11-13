const mongoose=require('mongoose');
const Appointment=require('../models/Appointment');
const Patient=require('../models/Patient');
const Dentist=require('../models/Dentist');
const crud=require('./crudFactory');
module.exports=crud(Appointment,['patient','dentist','appointmentDate','reason','status','notes'],{
 title:'Appointment',populate:[{path:'patient',select:'firstName lastName email'},{path:'dentist',select:'firstName lastName specialty'}],
 validate:async body=>{
  if('patient' in body){if(!mongoose.isValidObjectId(body.patient))return {message:'Invalid patient ID'};if(!await Patient.exists({_id:body.patient}))return {status:404,message:'Patient not found'};}
  if('dentist' in body && body.dentist!=null){if(!mongoose.isValidObjectId(body.dentist))return {message:'Invalid dentist ID'};if(!await Dentist.exists({_id:body.dentist}))return {status:404,message:'Dentist not found'};}
  return null;
 }
});
