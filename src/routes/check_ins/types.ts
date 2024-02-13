import { Static, Type } from "@sinclair/typebox";

export const SchemaCheckIn = Type.Object({
    date: Type.String(),
    uid: Type.String(),
    id: Type.Optional(Type.String())
});

export const SchemaCheckInRange = Type.Object({
    gte: Type.Optional(Type.String()),
    lte: Type.Optional(Type.String()),
    uid: Type.Optional(Type.String())
})

export type CheckInType = Static<typeof SchemaCheckIn>;
export type CheckInRangeType = Static<typeof SchemaCheckInRange>;