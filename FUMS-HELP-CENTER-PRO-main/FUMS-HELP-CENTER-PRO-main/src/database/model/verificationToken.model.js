import mongoose from "mongoose";

const verificationTokenSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        tokenHash: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        usedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

const VerificationToken = mongoose.model(
    "VerificationToken",
    verificationTokenSchema
);

export default VerificationToken;