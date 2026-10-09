import successResponse from "../../shared/utils/apiResponse.js";
import { acceptInvitation, createInvitation, previewInvitation } from "./invitation.service.js";

export async function createInvitationHandler(req, res) {
  const invitation = await createInvitation({
    ...req.validatedBody,
    invitedBy: req.user.sub,
  });

  return successResponse(res, "Invitation sent successfully", { invitation }, 201);
}

export async function previewInvitationHandler(req, res) {
  const result = await previewInvitation(req.validatedQuery.token);

  return successResponse(res, "Invitation fetched successfully", result);
}

export async function acceptInvitationHandler(req, res) {
  const invitation = await acceptInvitation(req.validatedBody);

  return successResponse(
    res,
    "Invitation accepted successfully. You can now log in with your temporary password.",
    invitation
  );
}