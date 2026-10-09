import express from "express";
import asyncHandler from "../../middleware/async.middleware.js";
import { healthCheck, liveCheck, readyCheck } from "./health.controller.js";

const healthRoutes = express.Router();

healthRoutes.get("/health", asyncHandler(healthCheck));
healthRoutes.get("/health/live", asyncHandler(liveCheck));
healthRoutes.get("/health/ready", asyncHandler(readyCheck));

export default healthRoutes;
