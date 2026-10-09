import mongoose from "mongoose";

const organizationMemberSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        roleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Role",
            required: true
        },
        status: {
            type: String,
            enum: ["invited", "active", "removed"],
            default: "invited"
        }
    },
    { timestamps: true }
)

organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

const OrganizationMember = mongoose.model("OrganizationMember", organizationMemberSchema);

export default OrganizationMember;