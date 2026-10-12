import prisma from "../../database/prisma/client.js";
import successResponse from "../../shared/utils/apiResponse.js";
import { AppError } from "../../shared/errors/AppError.js";
import { acceptInvitation, createInvitation, previewInvitation } from "./invitation.service.js";

async function resolveInviteTenantId(req) {
  const explicit =
    req.validatedBody.tenantId ?? req.tenantId ?? req.user?.tenant_id ?? null;

  if (explicit) {
    return explicit;
  }

  // Provider super-admins inviting from the Agents screen without a body
  // tenantId fall back to the seeded demo workspace.
  const demo = await prisma.tenant.findFirst({
    where: { slug: "demo" },
    select: { id: true }
  });

  return demo?.id ?? null;
}

export async function createInvitationHandler(req, res) {
  const tenantId = await resolveInviteTenantId(req);

  if (!tenantId) {
    throw new AppError(
      "A workspace is required to invite a user. Provision a tenant first.",
      400
    );
  }

  const invitation = await createInvitation({
    ...req.validatedBody,
    tenantId,
    invitedBy: req.user.sub
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
