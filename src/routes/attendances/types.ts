import { Static, Type } from "@sinclair/typebox";

export const SchemaAttendance = Type.Object({
  id: Type.Optional(Type.String()),
  uid: Type.Optional(Type.String()),
  in: Type.Optional(Type.String()),
  out: Type.Optional(Type.String()),
  date: Type.Optional(Type.String()),
  summary: Type.String(),
});

export const SchemaAttendances = Type.Object(
  {
    attendances: Type.Array(SchemaAttendance)
  }
);

export const SchemaAttendanceRange = Type.Object({
  gte: Type.String(),
  lte: Type.String(),
  uid: Type.Optional(Type.String())
})

export type AttendanceType = Static<typeof SchemaAttendance>;
export type AttendancesType = Static<typeof SchemaAttendances>;
export type AttendanceRangeType = Static<typeof SchemaAttendanceRange>
