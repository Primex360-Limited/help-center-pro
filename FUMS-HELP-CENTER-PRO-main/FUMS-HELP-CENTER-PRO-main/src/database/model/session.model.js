import mongoose, { mongo } from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        deviceInfo: {
            type: String
        },
        ipAddress: {
            type: String
        },
        refreshTokenHash: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        },
        isRevoked: {
            type: Boolean,
            default: false
        }
    }, 
    { timestamps: true }
)

const Session = mongoose.model("Session", sessionSchema);

export default Session;