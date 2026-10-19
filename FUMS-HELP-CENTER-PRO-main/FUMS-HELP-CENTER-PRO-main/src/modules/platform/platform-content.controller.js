import successResponse from "../../shared/utils/apiResponse.js";
import { getHowtoContent, updateHowtoContent } from "./platform-content.service.js";

export async function getHowtoHandler(_req, res) {
    const howto = await getHowtoContent();
    return successResponse(res, "How it works content", { howto });
}

export async function updateHowtoHandler(req, res) {
    const howto = await updateHowtoContent(req.body || {}, req.user?.id || null);
    return successResponse(res, "How it works video updated", { howto });
}
