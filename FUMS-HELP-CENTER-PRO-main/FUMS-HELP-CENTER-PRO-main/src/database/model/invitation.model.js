import mongoose from "mongoose";
import { INVITATION_STATUS } from "../../shared/constants/system.js";


const invitationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
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
    roleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
        required: true
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    status: {
        type: String,
        enum: Object.values(INVITATION_STATUS),
        default: INVITATION_STATUS.PENDING
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    acceptedAt: {
        type: Date,
        default: null
    },

},
    {
        timestamps: true,
        toJSON: {
            transform(_doc, ret){
                delete ret.tokenHash;
                delete ret.__v;
                return ret
            }
        }
    }
)

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;