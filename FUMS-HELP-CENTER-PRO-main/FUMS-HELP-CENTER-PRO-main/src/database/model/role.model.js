import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        description: {
            type: String
        },
        permissions: {
            type: [
                {
                    type: String,
                    trim: true,
                    lowercase: true
                }
            ],
            default: []
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform(_doc, ret) {
                delete ret.__v;
                ret.permissions = [...new Set(ret.permissions || [])];
                return ret;
            }
        }
    }
)

const Role = mongoose.model("Role", roleSchema);
export default Role;