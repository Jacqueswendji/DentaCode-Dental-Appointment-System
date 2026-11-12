const mongoose = require('mongoose');
const Dentist = require('../models/Dentist');
const Appointment = require('../models/Appointment');
const fields = ['firstName', 'lastName', 'specialty', 'email'];
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isId = id => mongoose.isValidObjectId(id);

function handleError(res, error) {
  if (error.code === 11000) return res.status(409).json({ message: 'Dentist email already exists' });
  if (['ValidationError', 'CastError'].includes(error.name))
    return res.status(400).json({ message: 'Invalid dentist data', details: error.message });
  console.error('Dentist API error:', error);
  return res.status(500).json({ message: 'Dentist request failed' });
}
function pickFields(body) {
  return Object.fromEntries(fields.filter(key => has(body, key)).map(key => [key, body[key]]));
}
function validBody(body, requireAll = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  if (!keys.length || keys.some(key => !fields.includes(key))) return false;
  if (requireAll && fields.some(key => !has(body, key))) return false;
  return keys.every(key => typeof body[key] === 'string' && body[key].trim().length > 0);
}
exports.list = async (req, res) => {
  try { return res.json(await Dentist.find().sort({ lastName: 1, firstName: 1 })); }
  catch (error) { return handleError(res, error); }
};
exports.get = async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
  try {
    const item = await Dentist.findById(req.params.id);
    return item ? res.json(item) : res.status(404).json({ message: 'Dentist not found' });
  } catch (error) { return handleError(res, error); }
};
exports.create = async (req, res) => {
  if (!validBody(req.body, true)) return res.status(400).json({ message: 'All four dentist fields must be nonempty strings' });
  try { return res.status(201).json(await Dentist.create(pickFields(req.body))); }
  catch (error) { return handleError(res, error); }
};
exports.update = async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
  if (!validBody(req.body)) return res.status(400).json({ message: 'Invalid update fields' });
  try {
    const item = await Dentist.findByIdAndUpdate(req.params.id, { $set: pickFields(req.body) }, { new: true, runValidators: true });
    return item ? res.json(item) : res.status(404).json({ message: 'Dentist not found' });
  } catch (error) { return handleError(res, error); }
};
exports.remove = async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
  try {
    const existing = await Dentist.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Dentist not found' });
    if (await Appointment.exists({ dentist: req.params.id }))
      return res.status(409).json({ message: 'Dentist has appointments; remove or reassign them first' });
    const item = await Dentist.findByIdAndDelete(req.params.id);
    return item ? res.json({ message: 'Dentist deleted successfully', id: item.id }) : res.status(404).json({ message: 'Dentist not found' });
  } catch (error) { return handleError(res, error); }
};
