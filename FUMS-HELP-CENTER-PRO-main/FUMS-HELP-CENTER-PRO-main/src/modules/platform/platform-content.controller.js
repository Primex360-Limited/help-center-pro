import successResponse from "../../shared/utils/apiResponse.js";
import {
    getAnnouncement,
    getHowtoContent,
    updateAnnouncement,
    updateHowtoContent
} from "./platform-content.service.js";

export async function getHowtoHandler(_req, res) {
    const howto = await getHowtoContent();
    return successResponse(res, "How it works content", { howto });
}

export async function updateHowtoHandler(req, res) {
    const howto = await updateHowtoContent(req.body || {}, req.user?.id || null);
    return successResponse(res, "How it works video updated", { howto });
}

export async function getAnnouncementHandler(_req, res) {
    const announcement = await getAnnouncement();
    return successResponse(res, "Platform announcement", { announcement });
}

export async function updateAnnouncementHandler(req, res) {
    const announcement = await updateAnnouncement(req.body || {}, req.user?.id || null);
    return successResponse(
        res,
        announcement.status === "published"
            ? "Announcement published to every workspace"
            : "Announcement saved as draft",
        { announcement }
    );
}

