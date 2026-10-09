import AuditLog from "../../database/model/auditLog.model.js";

export async function recordAuditLog({
    userId = null,
    action,
    entity = null,
    entityId = null,
    metadata = {}
}) {
    if(!action){
        return;
    }

    try {
        await AuditLog.create({
            userId,
            action,
            entity,
            entityId,
            metadata
        })
    } catch (error) {
        console.error("Failed to write audit log:", error.message)
    }
}