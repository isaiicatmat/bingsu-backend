import {Static, Type} from "@sinclair/typebox";

export const SchemaPermission = Type.Object({
        type: Type.String(),
        startDate: Type.String(),
        endDate: Type.String(),
        uid: Type.Optional(Type.String()),
        request: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        status: Type.String(),
        id: Type.Optional(Type.String()),
        availableDays: Type.Optional(Type.String()),
        vacationId: Type.Optional(Type.String()),
    },
    {
        additionalProperties: false
    });

export const SchemaPermissionFilter = Type.Object({
    uid: Type.Optional(Type.String()),
    gte: Type.Optional(Type.String()),
    lte: Type.Optional(Type.String()),
    type: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
});



export type PermissionType = Static<typeof SchemaPermission>;
export type PermissionFilterType = Static<typeof SchemaPermissionFilter>;
