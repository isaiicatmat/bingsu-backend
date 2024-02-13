import {Static, Type} from "@sinclair/typebox";

export const SchemaVacationFilter = Type.Object({
    uid: Type.Optional(Type.String()),
    lte: Type.Optional(Type.String()),
    gte: Type.Optional(Type.String()),
});

export type VacationFilterType = Static<typeof SchemaVacationFilter>;
