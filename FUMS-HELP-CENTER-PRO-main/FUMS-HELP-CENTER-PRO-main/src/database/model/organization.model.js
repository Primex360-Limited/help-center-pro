import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
        metadata: {
            type: Object,
            default: {}
        }
    },
    { timestamps: true }
)

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;