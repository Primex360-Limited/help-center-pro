import mongoose from "mongoose";
import { USER_STATUS } from "../../shared/constants/system.js";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        passwordHash: {
            type: String,
            required: true,
            select: false
        },
        firstName: {
            type: String,
            required: true,
            trim: true
        },
        lastName: {
            type: String,
            required: true,
            trim: true
        },
        status: {
            type: String,
            enum: Object.values(USER_STATUS),
            default: USER_STATUS.ACTIVE,
            index: true
        },
        emailVerified: {
            type: Boolean,
            default: false
        },
        emailVerifiedAt: {
            type: Date,
            default: null
        },
        mustChangePassword: {
            type: Boolean,
            default: false
        },
        phoneNumber: {
            type: String,
            trim: true
        },
        profileImage: {
            type: String
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        roleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Role",
            default: null,
            index: true
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        deniedPermissions: {
            type: [
                {
                    type: String,
                    trim: true,
                    lowercase: true
                }
            ],
            default: []
        },
        lastLoginAt: {
            type: Date,
        },
        isOnline: {
            type: Boolean,
            default: false,
            index: true
        },
        lastSeenAt: {
            type: Date,
            default: null,
            index: true
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform(_doc, ret) {
                delete ret.passwordHash;
                delete ret.__v;

                if (ret.mustChangePassword !== true) {
                    delete ret.mustChangePassword
                }

                if (!ret.invitedBy) {
                    delete ret.invitedBy
                }

                if (!ret.deniedPermissions?.length) {
                    delete ret.deniedPermissions
                }
                if (!ret.roleId) {
                    delete ret.roleId
                }

                return ret;
            },
        },
    }
);

const User = mongoose.model("User", userSchema);

export default User;
