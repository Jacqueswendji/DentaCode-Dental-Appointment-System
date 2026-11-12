const mongoose = require('mongoose');
const dentistSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  specialty: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'] }
}, { timestamps: true });
module.exports = mongoose.model('Dentist', dentistSchema);
