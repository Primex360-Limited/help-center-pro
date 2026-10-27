import swaggerJSDoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Help Centre Pro API",
            version: "1.2.0",
            description:
                "Help Centre Pro multi-tenant customer support platform API — authentication, RBAC, invitations, tickets, workspace settings (API keys, webhooks, billing), email accounts, public widget integration, and service health.\n\n**Production app:** https://helpcentre-pro-web.onrender.com\n\n**Production API:** https://helpcentre-pro-admin.onrender.com\n\n**Integrator guide:** https://helpcentre-pro-web.onrender.com/docs/integration",
            contact: {
                name: "Help Centre Pro",
                url: "https://helpcentre-pro-web.onrender.com",
            },
        },
        tags: [
            { name: "Health", description: "Liveness, readiness, and dependency health" },
            { name: "Auth", description: "Login, logout, verification, and password flows" },
            { name: "Users", description: "User and agent management" },
            { name: "Roles", description: "RBAC roles and permissions" },
            { name: "Invitations", description: "Team invitations" },
            {
                name: "Admin",
                description:
                    "Provider super-admin platform — overview metrics, tenant provisioning, activate/deactivate/delete, CSV export"
            },
            {
                name: "Platform",
                description:
                    "Platform-wide content (How it works video) — Super Admin write, all tenants read"
            },
            { name: "Tickets", description: "Universal inbox ticketing" },
            { name: "Workspace", description: "Tenant workspace profile, VoIP, API keys, webhooks, billing" },
            { name: "Email", description: "Outbound/inbound mailbox accounts (Gmail, Outlook, custom IMAP/SMTP)" },
            {
                name: "Public Widget",
                description:
                    "External integrator endpoints — authenticate with X-HCP-API-Key (pk_*) or Authorization Bearer (sk_*)"
            },
        ],
        servers: [
            {
                url: "https://helpcentre-pro-admin.onrender.com/api/v1",
                description: "Production (Render)",
            },
            {
                url: "http://localhost:4008/api/v1",
                description: "Local development",
            },
            {
                url: "http://localhost:4008",
                description: "Local root (health probes)",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "accessToken"
                },
                refreshCookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "refreshToken"
                },
                hcpApiKey: {
                    type: "apiKey",
                    in: "header",
                    name: "X-HCP-API-Key",
                    description:
                        "Public or secret workspace API key (pk_test_ / pk_live_ / sk_test_ / sk_live_)",
                },
            },
            schemas: {
                ErrorResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: false,
                        },
                        message: {
                            type: "string",
                            example: "Operation failed",
                        },
                    },
                },

                SuccessMessageResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example: "Operation successful",
                        },
                        data: {
                            type: "object",
                            additionalProperties: true,
                            example: {},
                        },
                    },
                },

                HowtoContent: {
                    type: "object",
                    properties: {
                        title: { type: "string", example: "How it works" },
                        body: {
                            type: "string",
                            example: "Check out the new dashboard view. Pages now load faster.",
                        },
                        videoUrl: {
                            type: "string",
                            example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                        },
                        posterUrl: {
                            type: "string",
                            example: "/howto-video-poster.jpg",
                        },
                        whatsNewUrl: {
                            type: "string",
                            example: "https://helpcentrepro.com",
                        },
                    },
                },

                HowtoContentUpdate: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        body: { type: "string" },
                        videoUrl: {
                            type: "string",
                            description: "YouTube, Vimeo, or direct MP4 URL",
                        },
                        posterUrl: { type: "string" },
                        whatsNewUrl: { type: "string" },
                    },
                },

                RegisterRequest: {
                    type: "object",
                    required: ["email", "password", "firstName", "lastName"],
                    properties: {
                        email: {
                            type: "string",
                            example: "admin@example.com",
                        },
                        password: {
                            type: "string",
                            example: "password123",
                        },
                        firstName: {
                            type: "string",
                            example: "Matthew",
                        },
                        lastName: {
                            type: "string",
                            example: "Olanipekun",
                        },
                    },
                },

                LoginRequest: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: {
                            type: "string",
                            example: "test@test.com",
                        },
                        password: {
                            type: "string",
                            example: "test",
                        },
                    },
                },

                HealthServiceStatus: {
                    type: "object",
                    properties: {
                        name: { type: "string", example: "mongodb" },
                        status: {
                            type: "string",
                            enum: ["up", "down", "degraded", "skipped", "configured", "misconfigured"],
                        },
                        required: { type: "boolean" },
                        message: { type: "string" },
                    },
                },

                HealthReport: {
                    type: "object",
                    properties: {
                        status: {
                            type: "string",
                            enum: ["healthy", "unhealthy"],
                            example: "healthy",
                        },
                        service: { type: "string", example: "help-centre-pro-api" },
                        version: { type: "string", example: "1.0.0" },
                        environment: { type: "string", example: "development" },
                        uptimeSeconds: { type: "integer", example: 120 },
                        timestamp: { type: "string", format: "date-time" },
                        responseTimeMs: { type: "integer", example: 12 },
                        services: {
                            type: "object",
                            additionalProperties: {
                                $ref: "#/components/schemas/HealthServiceStatus",
                            },
                        },
                    },
                },

                UpdatePasswordRequest: {
                    type: "object",
                    required: ["currentPassword", "newPassword", "confirmPassword"],
                    properties: {
                        currentPassword: {
                            type: "string",
                            example: "temporaryPassword123",
                        },
                        newPassword: {
                            type: "string",
                            example: "MySecurePassword123",
                        },
                        confirmPassword: {
                            type: "string",
                            example: "MySecurePassword123",
                        },
                    },
                },

                ResetPasswordRequest: {
                    type: "object",
                    required: ["token", "password", "confirmPassword"],
                    properties: {
                        token: {
                            type: "string",
                            example: "password_reset_token",
                        },
                        password: {
                            type: "string",
                            example: "newpassword123",
                        },
                        confirmPassword: {
                            type: "string",
                            example: "newpassword123",
                        },
                    },
                },

                UpdateUserRequest: {
                    type: "object",
                    properties: {
                        firstName: {
                            type: "string",
                            example: "Updated",
                        },
                        lastName: {
                            type: "string",
                            example: "User",
                        },
                        phoneNumber: {
                            type: "string",
                            example: "08012345678",
                        },
                        profileImage: {
                            type: "string",
                            example: "https://example.com/avatar.jpg",
                        },
                        metadata: {
                            type: "object",
                            additionalProperties: true,
                            example: {
                                department: "Engineering",
                            },
                        },
                        roleId: {
                            type: "string",
                            nullable: true,
                            example: "680ab1234c56d7890ef67890",
                        },
                        status: {
                            type: "string",
                            enum: ["active", "inactive", "suspended"],
                            example: "inactive",
                        },
                        deniedPermissions: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            example: ["wallet.fund", "wallet.delete"],
                        },
                    },
                },

                CreateRoleRequest: {
                    type: "object",
                    required: ["name", "permissions"],
                    properties: {
                        name: {
                            type: "string",
                            example: "Account Officer",
                        },
                        description: {
                            type: "string",
                            example: "Account operations role",
                        },
                        permissions: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            example: [
                                "wallet.read",
                                "wallet.fund",
                                "wallet.update",
                                "wallet.delete"
                            ],
                        },
                    },
                },

                UpdateRoleRequest: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            example: "Financial Officer",
                        },
                        description: {
                            type: "string",
                            example: "Updated account operations role",
                        },
                        permissions: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            example: [
                                "wallet.read",
                                "wallet.update"
                            ],
                        },
                    },
                },

                CreateTicketRequest: {
                    type: "object",
                    description: "Create a ticket with one initial channel event. Provide only the nested object that matches the selected channel. An unassigned first customer CHAT is created as QUEUED so agents can pick it from the queue.",
                    required: ["title", "description"],
                    example: {
                        title: "Dashboard access issue",
                        description: "Customer cannot access the dashboard after resetting password.",
                        priority: "HIGH",
                        customerName: "Sarah Chen",
                        customerEmail: "sarah.chen@example.com",
                        channel: "CHAT",
                        chat: {
                            message: "Customer cannot access the dashboard after resetting password.",
                            senderType: "CUSTOMER"
                        }
                    },
                    properties: {
                        title: {
                            type: "string",
                            example: "Wallet funding issue"
                        },
                        description: {
                            type: "string",
                            example: "Customer wallet funding is failing on the mobile app."
                        },
                        priority: {
                            type: "string",
                            enum: ["LOW", "MEDIUM", "HIGH"],
                            example: "MEDIUM"
                        },
                        assignedToUserId: {
                            type: "string",
                            example: "680ab1234c56d7890ef67890"
                        },
                        customerName: {
                            type: "string",
                            example: "Sarah Chen"
                        },
                        customerEmail: {
                            type: "string",
                            example: "sarah.chen@example.com"
                        },
                        customerPhone: {
                            type: "string",
                            example: "+2348012345678"
                        },
                        customerIp: {
                            type: "string",
                            description: "Used mainly for first-time chat widget visitors when email/phone is not available.",
                            example: "102.165.124.192"
                        },
                        resolutionDueAt: {
                            type: "string",
                            format: "date-time",
                            description: "Optional SLA due date. If omitted, the API applies the default ticket resolution window.",
                            example: "2026-05-13T10:00:00.000Z"
                        },
                        channel: {
                            type: "string",
                            enum: ["CHAT", "EMAIL", "PHONE"],
                            example: "CHAT"
                        },
                        chat: {
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    example: "Customer cannot access the dashboard after resetting password."
                                },
                                senderType: {
                                    type: "string",
                                    enum: ["AGENT", "CUSTOMER"],
                                    example: "CUSTOMER"
                                }
                            }
                        },
                        email: {
                            type: "object",
                            properties: {
                                subject: {
                                    type: "string",
                                    example: "Unable to access dashboard"
                                },
                                body: {
                                    type: "string",
                                    example: "Customer reports that dashboard access fails after password reset."
                                },
                                fromEmail: {
                                    type: "string",
                                    example: "customer@example.com"
                                },
                                toEmail: {
                                    type: "string",
                                    example: "support@example.com"
                                },
                                senderType: {
                                    type: "string",
                                    enum: ["AGENT", "CUSTOMER"],
                                    example: "CUSTOMER"
                                }
                            }
                        },
                        call: {
                            type: "object",
                            properties: {
                                duration: {
                                    type: "integer",
                                    example: 180
                                },
                                recordingUrl: {
                                    type: "string",
                                    example: "https://example.com/call-recordings/123"
                                },
                                direction: {
                                    type: "string",
                                    enum: ["INBOUND", "OUTBOUND"],
                                    example: "INBOUND"
                                }
                            }
                        }
                    }
                },

                CreateTicketEventRequest: {
                    type: "object",
                    description: "Append one new event to an existing ticket thread. Provide only the nested object that matches the selected channel.",
                    required: ["channel"],
                    example: {
                        channel: "EMAIL",
                        email: {
                            subject: "Reset link reissued",
                            body: "We have re-issued the reset link. Please try again.",
                            fromEmail: "support@example.com",
                            toEmail: "sarah.chen@example.com"
                        }
                    },
                    properties: {
                        customerName: {
                            type: "string",
                            example: "Sarah Chen"
                        },
                        customerEmail: {
                            type: "string",
                            example: "sarah.chen@example.com"
                        },
                        customerPhone: {
                            type: "string",
                            example: "+2348012345678"
                        },
                        customerIp: {
                            type: "string",
                            example: "102.165.124.192"
                        },
                        channel: {
                            type: "string",
                            enum: ["CHAT", "EMAIL", "PHONE"],
                            example: "EMAIL"
                        },
                        chat: {
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    example: "Please clear cache and try again."
                                },
                                senderType: {
                                    type: "string",
                                    enum: ["AGENT", "CUSTOMER"],
                                    example: "AGENT"
                                }
                            }
                        },
                        email: {
                            type: "object",
                            properties: {
                                subject: {
                                    type: "string",
                                    example: "Reset link reissued"
                                },
                                body: {
                                    type: "string",
                                    example: "We have re-issued the reset link. Please try again."
                                },
                                fromEmail: {
                                    type: "string",
                                    example: "support@example.com"
                                },
                                toEmail: {
                                    type: "string",
                                    example: "sarah.chen@example.com"
                                },
                                senderType: {
                                    type: "string",
                                    enum: ["AGENT", "CUSTOMER"],
                                    example: "AGENT"
                                }
                            }
                        },
                        call: {
                            type: "object",
                            properties: {
                                duration: {
                                    type: "integer",
                                    example: 120
                                },
                                recordingUrl: {
                                    type: "string",
                                    example: "https://example.com/call-recordings/123"
                                },
                                direction: {
                                    type: "string",
                                    enum: ["INBOUND", "OUTBOUND"],
                                    example: "OUTBOUND"
                                }
                            }
                        }
                    }
                },

                ResendInboundEmailWebhookRequest: {
                    type: "object",
                    description: "Payload sent by Resend for email.received events. In production, configure RESEND_WEBHOOK_SECRET so the backend verifies Svix headers.",
                    required: ["type", "data"],
                    example: {
                        type: "email.received",
                        created_at: "2026-02-22T23:41:12.126Z",
                        data: {
                            email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
                            created_at: "2026-02-22T23:41:11.894719+00:00",
                            from: "Matthew Olanipekun <mhartos60@yahoo.com>",
                            to: ["support@example.com"],
                            message_id: "<example+123>",
                            subject: "Dashboard access issue"
                        }
                    },
                    properties: {
                        type: {
                            type: "string",
                            example: "email.received"
                        },
                        created_at: {
                            type: "string",
                            format: "date-time"
                        },
                        data: {
                            type: "object",
                            additionalProperties: true
                        }
                    }
                },

                EmailReplyRequest: {
                    type: "object",
                    required: ["body"],
                    properties: {
                        toEmail: {
                            type: "string",
                            description: "Optional. Defaults to the ticket customer email.",
                            example: "mhartos60@yahoo.com"
                        },
                        subject: {
                            type: "string",
                            description: "Optional. Defaults to Re: [ticketId] ticket title.",
                            example: "Re: [TCKT-20260524-ABC123] Dashboard access issue"
                        },
                        body: {
                            type: "string",
                            example: "Hello Matthew, we are checking this issue and will update you shortly."
                        },
                        html: {
                            type: "string",
                            example: "<p>Hello Matthew, we are checking this issue and will update you shortly.</p>"
                        },
                        inReplyTo: {
                            type: "string",
                            example: "<customer-message-id@example.com>"
                        },
                        references: {
                            type: "string",
                            example: "<customer-message-id@example.com>"
                        }
                    }
                },

                UpdateTicketStatusRequest: {
                    type: "object",
                    required: ["status"],
                    properties: {
                        status: {
                            type: "string",
                            enum: ["QUEUED", "OPEN", "PENDING", "WAITING_FOR_REPLY", "RESOLVED", "CLOSED"],
                            example: "WAITING_FOR_REPLY"
                        }
                    }
                },

                AssignTicketRequest: {
                    type: "object",
                    required: ["assignedToUserId"],
                    properties: {
                        assignedToUserId: {
                            type: "string",
                            example: "680ab1234c56d7890ef67890"
                        },
                        transferReason: {
                            type: "string",
                            description: "Optional note for manual assignment. Use TransferTicketRequest when transfer reason is required.",
                            example: "Assigning to the wallet support specialist."
                        }
                    }
                },

                TransferTicketRequest: {
                    type: "object",
                    required: ["assignedToUserId", "transferReason"],
                    properties: {
                        assignedToUserId: {
                            type: "string",
                            example: "680ab1234c56d7890ef67890"
                        },
                        transferReason: {
                            type: "string",
                            example: "Customer needs wallet specialist support and I cannot resolve the issue from my queue."
                        }
                    }
                },

                CreateTicketMessageRequest: {
                    type: "object",
                    required: ["content"],
                    properties: {
                        content: {
                            type: "string",
                            example: "We are currently investigating this ticket."
                        }
                    }
                },

                CreateInvitationRequest: {
                    type: "object",
                    required: ["email", "roleId"],
                    properties: {
                        email: {
                            type: "string",
                            format: "email",
                            example: "agent@company.com",
                            description: "Invitee email address"
                        },
                        roleId: {
                            type: "string",
                            format: "uuid",
                            example: "3f1a2b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b",
                            description: "Workspace role id (Tenant Admin or Tenant Agent)"
                        },
                        firstName: {
                            type: "string",
                            example: "Jane",
                            description: "Optional. Derived from the email local-part when omitted."
                        },
                        lastName: {
                            type: "string",
                            example: "Doe",
                            description: "Optional. Defaults to User when omitted."
                        },
                        tenantId: {
                            type: "string",
                            format: "uuid",
                            description:
                                "Workspace the agent joins. Optional for tenant admins (their own workspace is used); required for provider super admins.",
                            example: "1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f"
                        }
                    }
                },

                AcceptInvitationRequest: {
                    type: "object",
                    required: ["token"],
                    properties: {
                        token: {
                            type: "string",
                            example: "invitation_token_here",
                        },
                    },
                },

                RoleSummary: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            example: "680ab1234c56d7890ef67890",
                        },
                        name: {
                            type: "string",
                            example: "Super Admin",
                        },
                        description: {
                            type: "string",
                            example: "Platform super administrator",
                        },
                        permissions: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            example: ["manage_users", "manage_roles"],
                        },
                    },
                },

                Role: {
                    type: "object",
                    properties: {
                        _id: {
                            type: "string",
                            example: "680ab1234c56d7890ef67890",
                        },
                        name: {
                            type: "string",
                            example: "Account Officer",
                        },
                        description: {
                            type: "string",
                            example: "Account operations role",
                        },
                        permissions: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            example: ["wallet.read", "wallet.fund", "wallet.update"],
                        },
                        createdAt: {
                            type: "string",
                            format: "date-time",
                        },
                        updatedAt: {
                            type: "string",
                            format: "date-time",
                        },
                    },
                },

                PaginationMeta: {
                    type: "object",
                    properties: {
                        page: {
                            type: "integer",
                            example: 1
                        },
                        limit: {
                            type: "integer",
                            example: 20
                        },
                        total: {
                            type: "integer",
                            example: 1
                        },
                        totalPages: {
                            type: "integer",
                            example: 1
                        }
                    }
                },

                TicketUserReference: {
                    type: "object",
                    nullable: true,
                    properties: {
                        userId: {
                            type: "string",
                            example: "680ab1234c56d7890ef67890"
                        },
                        name: {
                            type: "string",
                            example: "Jane Doe"
                        },
                        email: {
                            type: "string",
                            example: "jane.doe@example.com"
                        }
                    }
                },

                OnlineAgent: {
                    type: "object",
                    properties: {
                        userId: {
                            type: "string",
                            example: "680ab1234c56d7890ef67890"
                        },
                        name: {
                            type: "string",
                            example: "Jane Doe"
                        },
                        email: {
                            type: "string",
                            example: "jane.doe@example.com"
                        },
                        role: {
                            type: "string",
                            example: "Support Agent"
                        },
                        isOnline: {
                            type: "boolean",
                            example: true
                        },
                        lastSeenAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true
                        }
                    }
                },

                TicketCustomerReference: {
                    type: "object",
                    nullable: true,
                    properties: {
                        customerId: {
                            type: "string",
                            example: "sarah.chen@example.com"
                        },
                        name: {
                            type: "string",
                            example: "Sarah Chen"
                        },
                        email: {
                            type: "string",
                            example: "sarah.chen@example.com"
                        },
                        phone: {
                            type: "string",
                            example: "+2348012345678"
                        },
                        ip: {
                            type: "string",
                            example: "102.165.124.192"
                        }
                    }
                },

                TicketMessage: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            example: "1f0bb464-3d9d-4e10-8b45-466efbe32b52"
                        },
                        ticketId: {
                            type: "string",
                            example: "TKT-20260420-A1B2C3"
                        },
                        sender: {
                            $ref: "#/components/schemas/TicketUserReference"
                        },
                        type: {
                            type: "string",
                            enum: ["message", "internal_note"],
                            example: "message"
                        },
                        content: {
                            type: "string",
                            example: "We are currently investigating this ticket."
                        },
                        createdAt: {
                            type: "string",
                            format: "date-time"
                        }
                    }
                },

                TicketCallLog: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            example: "6d4e1a3a-9b23-4b1e-9fd4-11f462c403c2"
                        },
                        eventType: {
                            type: "string",
                            enum: ["CALL_INITIATED", "CALL_RECEIVED", "CALL_PICKED", "CALL_HANGUP"],
                            example: "CALL_PICKED"
                        },
                        actor: {
                            type: "string",
                            enum: ["AGENT", "CUSTOMER", "SYSTEM"],
                            example: "AGENT"
                        },
                        direction: {
                            type: "string",
                            enum: ["INBOUND", "OUTBOUND"],
                            nullable: true,
                            example: "INBOUND"
                        },
                        timestamp: {
                            type: "string",
                            format: "date-time"
                        }
                    }
                },

                TicketThreadActor: {
                    type: "object",
                    additionalProperties: true,
                    example: {
                        type: "CUSTOMER",
                        customerId: "sarah.chen@example.com",
                        name: "Sarah Chen"
                    }
                },

                TicketThreadItem: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            example: "e69eb6d6-5c89-4ee4-b388-c0e92816c1f6"
                        },
                        type: {
                            type: "string",
                            enum: ["EMAIL", "CHAT", "CALL", "LOG"],
                            example: "CHAT"
                        },
                        channel: {
                            type: "string",
                            enum: ["EMAIL", "CHAT", "PHONE"],
                            example: "CHAT"
                        },
                        createdAt: {
                            type: "string",
                            format: "date-time"
                        },
                        actor: {
                            $ref: "#/components/schemas/TicketThreadActor"
                        },
                        content: {
                            oneOf: [
                                {
                                    type: "string",
                                    example: "We are currently investigating this issue."
                                },
                                {
                                    type: "object",
                                    properties: {
                                        subject: {
                                            type: "string"
                                        },
                                        body: {
                                            type: "string"
                                        },
                                        fromEmail: {
                                            type: "string"
                                        },
                                        toEmail: {
                                            type: "string"
                                        }
                                    }
                                },
                                {
                                    type: "object",
                                    properties: {
                                        duration: {
                                            type: "integer"
                                        },
                                        recordingUrl: {
                                            type: "string",
                                            nullable: true
                                        },
                                        logs: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/TicketCallLog"
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                },

                Ticket: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            example: "1f0bb464-3d9d-4e10-8b45-466efbe32b52"
                        },
                        ticketId: {
                            type: "string",
                            example: "TKT-20260420-A1B2C3"
                        },
                        title: {
                            type: "string",
                            example: "Wallet funding issue"
                        },
                        description: {
                            type: "string",
                            example: "Customer wallet funding is failing on the mobile app."
                        },
                        status: {
                            type: "string",
                            enum: ["QUEUED", "OPEN", "PENDING", "WAITING_FOR_REPLY", "RESOLVED", "CLOSED"],
                            example: "QUEUED"
                        },
                        priority: {
                            type: "string",
                            enum: ["LOW", "MEDIUM", "HIGH"],
                            example: "MEDIUM"
                        },
                        assignedTo: {
                            $ref: "#/components/schemas/TicketUserReference"
                        },
                        createdBy: {
                            $ref: "#/components/schemas/TicketUserReference"
                        },
                        updatedBy: {
                            $ref: "#/components/schemas/TicketUserReference"
                        },
                        customer: {
                            $ref: "#/components/schemas/TicketCustomerReference"
                        },
                        queuedAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true
                        },
                        pickedAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true
                        },
                        resolutionDueAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true
                        },
                        waitingForCustomerAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true
                        },
                        lastCustomerResponseAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true
                        },
                        lastAgentResponseAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true
                        },
                        messages: {
                            type: "array",
                            items: {
                                $ref: "#/components/schemas/TicketMessage"
                            }
                        },
                        createdAt: {
                            type: "string",
                            format: "date-time"
                        },
                        updatedAt: {
                            type: "string",
                            format: "date-time"
                        }
                    }
                },

                User: {
                    type: "object",
                    properties: {
                        _id: {
                            type: "string",
                        },
                        email: {
                            type: "string",
                        },
                        firstName: {
                            type: "string",
                        },
                        lastName: {
                            type: "string",
                        },
                        status: {
                            type: "string",
                            example: "active",
                        },
                        emailVerified: {
                            type: "boolean",
                        },
                        emailVerifiedAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                        },
                        mustChangePassword: {
                            type: "boolean",
                        },
                        invitedBy: {
                            type: "string",
                            nullable: true,
                        },
                        roleId: {
                            type: "string",
                            nullable: true,
                        },
                        role: {
                            $ref: "#/components/schemas/RoleSummary",
                        },
                        deniedPermissions: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                        },
                        allowedPermissions: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                        },
                        phoneNumber: {
                            type: "string",
                        },
                        profileImage: {
                            type: "string",
                        },
                        metadata: {
                            type: "object",
                            additionalProperties: true,
                        },
                        createdAt: {
                            type: "string",
                            format: "date-time",
                        },
                        updatedAt: {
                            type: "string",
                            format: "date-time",
                        },
                    },
                },

                InvitationRecord: {
                    type: "object",
                    properties: {
                        _id: {
                            type: "string",
                        },
                        userId: {
                            type: "string",
                        },
                        email: {
                            type: "string",
                        },
                        firstName: {
                            type: "string",
                        },
                        lastName: {
                            type: "string",
                        },
                        roleId: {
                            type: "string",
                        },
                        invitedBy: {
                            type: "string",
                        },
                        status: {
                            type: "string",
                            example: "pending",
                        },
                        expiresAt: {
                            type: "string",
                            format: "date-time",
                        },
                        acceptedAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                        },
                        createdAt: {
                            type: "string",
                            format: "date-time",
                        },
                        updatedAt: {
                            type: "string",
                            format: "date-time",
                        },
                    },
                },

                InvitationPreview: {
                    type: "object",
                    properties: {
                        email: {
                            type: "string",
                        },
                        firstName: {
                            type: "string",
                        },
                        lastName: {
                            type: "string",
                        },
                        expiresAt: {
                            type: "string",
                            format: "date-time",
                        },
                        invitationStatus: {
                            type: "string",
                            example: "pending",
                        },
                        role: {
                            $ref: "#/components/schemas/RoleSummary",
                        },
                        user: {
                            type: "object",
                            nullable: true,
                            properties: {
                                id: {
                                    type: "string",
                                },
                                roleId: {
                                    type: "string",
                                    nullable: true,
                                },
                                emailVerified: {
                                    type: "boolean",
                                },
                                status: {
                                    type: "string",
                                },
                                mustChangePassword: {
                                    type: "boolean",
                                },
                            },
                        },
                    },
                },

                UserResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                        },
                        data: {
                            type: "object",
                            properties: {
                                user: {
                                    $ref: "#/components/schemas/User",
                                },
                            },
                        },
                    },
                },

                UserListResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example: "Users fetched successfully",
                        },
                        data: {
                            type: "object",
                            properties: {
                                users: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/User",
                                    },
                                },
                            },
                        },
                    },
                },

                AuthResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example: "Login successful",
                        },
                        data: {
                            type: "object",
                            properties: {
                                user: {
                                    $ref: "#/components/schemas/User",
                                },
                                accessToken: {
                                    type: "string",
                                },
                                refreshToken: {
                                    type: "string",
                                },
                            },
                        },
                    },
                },

                RefreshTokenResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example: "Token refreshed successfully",
                        },
                        data: {
                            type: "object",
                            properties: {
                                accessToken: {
                                    type: "string",
                                },
                                refreshToken: {
                                    type: "string",
                                },
                            },
                        },
                    },
                },

                RoleResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example: "Role created successfully",
                        },
                        data: {
                            type: "object",
                            properties: {
                                role: {
                                    $ref: "#/components/schemas/Role",
                                },
                            },
                        },
                    },
                },

                RoleListResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example: "Role fetched successfully",
                        },
                        data: {
                            type: "object",
                            properties: {
                                roles: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/Role",
                                    },
                                },
                            },
                        },
                    },
                },

                TicketResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string",
                            example: "Ticket fetched successfully"
                        },
                        data: {
                            type: "object",
                            properties: {
                                ticket: {
                                    $ref: "#/components/schemas/Ticket"
                                }
                            }
                        }
                    }
                },

                TicketListResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string",
                            example: "Tickets fetched successfully"
                        },
                        data: {
                            type: "object",
                            properties: {
                                tickets: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/Ticket"
                                    }
                                }
                            }
                        },
                        meta: {
                            $ref: "#/components/schemas/PaginationMeta"
                        }
                    }
                },

                OnlineAgentsResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string",
                            example: "Online assignable agents fetched successfully"
                        },
                        data: {
                            type: "object",
                            properties: {
                                agents: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/OnlineAgent"
                                    }
                                }
                            }
                        }
                    }
                },

                TicketMessageResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string",
                            example: "Message sent successfully"
                        },
                        data: {
                            type: "object",
                            properties: {
                                message: {
                                    $ref: "#/components/schemas/TicketMessage"
                                },
                                note: {
                                    $ref: "#/components/schemas/TicketMessage"
                                }
                            }
                        }
                    }
                },

                TicketMessageListResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string",
                            example: "Messages fetched successfully"
                        },
                        data: {
                            type: "object",
                            properties: {
                                messages: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/TicketMessage"
                                    }
                                },
                                notes: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/TicketMessage"
                                    }
                                }
                            }
                        },
                        meta: {
                            $ref: "#/components/schemas/PaginationMeta"
                        }
                    }
                },

                TicketThreadResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string",
                            example: "Ticket thread fetched successfully"
                        },
                        data: {
                            type: "object",
                            properties: {
                                thread: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/TicketThreadItem"
                                    }
                                }
                            }
                        }
                    }
                },

                TicketThreadItemResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string",
                            example: "Ticket event added successfully"
                        },
                        data: {
                            type: "object",
                            properties: {
                                event: {
                                    $ref: "#/components/schemas/TicketThreadItem"
                                }
                            }
                        }
                    }
                },

                InboundEmailWebhookResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string",
                            example: "Inbound email processed successfully"
                        },
                        data: {
                            type: "object",
                            additionalProperties: true,
                            properties: {
                                created: {
                                    type: "boolean",
                                    example: true
                                },
                                duplicate: {
                                    type: "boolean",
                                    example: false
                                },
                                ticket: {
                                    $ref: "#/components/schemas/Ticket"
                                },
                                event: {
                                    $ref: "#/components/schemas/TicketThreadItem"
                                }
                            }
                        }
                    }
                },

                EmailReplyResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string",
                            example: "Email reply sent successfully"
                        },
                        data: {
                            type: "object",
                            properties: {
                                email: {
                                    type: "object",
                                    additionalProperties: true
                                },
                                event: {
                                    $ref: "#/components/schemas/TicketThreadItem"
                                }
                            }
                        }
                    }
                },

                InvitationResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example: "Invitation sent successfully",
                        },
                        data: {
                            type: "object",
                            properties: {
                                invitation: {
                                    $ref: "#/components/schemas/InvitationRecord",
                                },
                            },
                        },
                    },
                },

                InvitationPreviewResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example: "Invitation fetched successfully",
                        },
                        data: {
                            $ref: "#/components/schemas/InvitationPreview",
                        },
                    },
                },

                InvitationActivationResponse: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true,
                        },
                        message: {
                            type: "string",
                            example:
                                "Invitation accepted successfully. You can now log in with your temporary password.",
                        },
                        data: {
                            $ref: "#/components/schemas/InvitationPreview",
                        },
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
        paths: {
            "/health": {
                get: {
                    tags: ["Health"],
                    summary: "Full dependency health check",
                    security: [],
                    responses: {
                        200: {
                            description: "All required services are healthy",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean", example: true },
                                            message: { type: "string" },
                                            data: { $ref: "#/components/schemas/HealthReport" },
                                        },
                                    },
                                },
                            },
                        },
                        503: {
                            description: "One or more required services are unhealthy",
                        },
                    },
                },
            },
            "/health/live": {
                get: {
                    tags: ["Health"],
                    summary: "Liveness probe",
                    security: [],
                    responses: {
                        200: { description: "Process is alive" },
                    },
                },
            },
            "/health/ready": {
                get: {
                    tags: ["Health"],
                    summary: "Readiness probe",
                    security: [],
                    responses: {
                        200: { description: "Ready to accept traffic" },
                        503: { description: "Not ready" },
                    },
                },
            },
        },
    },
    apis: ["src/modules/**/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
