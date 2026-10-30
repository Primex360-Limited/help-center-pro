import swaggerSpec from "./swagger.js";

const PUBLIC_TAGS = new Set(["Public Widget", "Health"]);

/**
 * Slim OpenAPI document for external integrators — only public widget + health.
 * Internal auth/tickets/workspace paths stay off this surface.
 */
export function buildPublicSwaggerSpec(fullSpec = swaggerSpec) {
    const paths = {};
    for (const [pathKey, methods] of Object.entries(fullSpec.paths || {})) {
        const filtered = {};
        for (const [method, operation] of Object.entries(methods || {})) {
            const tags = operation?.tags || [];
            if (tags.some((tag) => PUBLIC_TAGS.has(tag))) {
                filtered[method] = operation;
            }
        }
        if (Object.keys(filtered).length) {
            paths[pathKey] = filtered;
        }
    }

    return {
        ...fullSpec,
        info: {
            ...fullSpec.info,
            title: "Help Centre Pro — Public Integration API",
            description:
                "Public endpoints for external chat widgets and integrators. Authenticate with `X-HCP-API-Key` (pk_*) or `Authorization: Bearer` (sk_*).\n\nFull internal API docs are restricted — contact your workspace admin.\n\n**Integrator guide:** https://helpcentre-pro-web.onrender.com/docs/integration"
        },
        tags: (fullSpec.tags || []).filter((tag) => PUBLIC_TAGS.has(tag.name)),
        paths,
        components: {
            ...fullSpec.components,
            securitySchemes: {
                hcpApiKey: fullSpec.components?.securitySchemes?.hcpApiKey,
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "API key (sk_*)",
                    description: "Workspace secret API key"
                }
            }
        }
    };
}

export default buildPublicSwaggerSpec;
