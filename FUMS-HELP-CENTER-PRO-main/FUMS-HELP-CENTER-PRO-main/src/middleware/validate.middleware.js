import { AppError } from "../shared/errors/AppError.js";

const requestTargetMap = {
    body: "validatedBody",
    query: "validatedQuery",
    params: "validatedParams"
}

export const validate = (schema, target = "body") => (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
        return next(
            new AppError(
                result.error.issues.map((issue) => issue.message).join(", "),
                400,
                result.error.issues.map((issue)=>({
                    path: issue.path.join("."),
                    message: issue.message
                }))
            )
        );
    }

    req[requestTargetMap[target] || "validatedBody"] = result.data;
    next();
};