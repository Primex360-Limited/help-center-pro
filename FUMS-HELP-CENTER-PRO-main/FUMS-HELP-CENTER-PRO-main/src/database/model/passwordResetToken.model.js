import mongoose from "mongoose";

const passwordResetTokenSchema = new mongoose.Schema(
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

const PasswordResetToken = mongoose.model(
    "PasswordResetToken",
    passwordResetTokenSchema
);

export default PasswordResetToken;