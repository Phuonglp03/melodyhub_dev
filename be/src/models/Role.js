import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    permission: { type: String },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

const Role = mongoose.model('Role', roleSchema);
export default Role;




