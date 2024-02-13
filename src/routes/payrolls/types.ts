import { Static, Type } from "@sinclair/typebox";

export const SchemaPayroll = Type.Object({
  id: Type.Optional(Type.String()),
  uid: Type.Optional(Type.String()),
  type: Type.Optional(Type.String()),
  date: Type.String(),
  file: Type.String(),
});

export const SchemaPayrollFilter = Type.Object({
  lte: Type.Optional(Type.String()),
  gte: Type.Optional(Type.String()),
  uid: Type.Optional(Type.String()),
})

export type PayrollType = Static<typeof SchemaPayroll>;
export type PayrollRangeType = Static<typeof SchemaPayrollFilter>;