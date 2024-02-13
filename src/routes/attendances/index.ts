import { FastifyPluginAsync } from "fastify";
import {
  SchemaAttendance,
  AttendanceType,
  AttendanceRangeType,
  SchemaAttendanceRange,
  AttendancesType,
  SchemaAttendances
} from "./types";
const createError = require('http-errors');
import { v4 as uuidv4 } from "uuid";
import { Attendance } from "./interfaces";
import { FastifyInstance } from "fastify";

const attendances: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{
    Body: AttendanceType
  }>('/', {
    schema: {
      body: SchemaAttendance,
    }
  }, async function (request, reply) {
    await fastify.checkRole(request, reply, ['user']);
    const attendance = request.body;
    let uid = await fastify.getIdFromToken(request, reply);
    const id = uuidv4();
    const today = new Date();

    try {
      let queryAttendancesSnapshot = await fastify.app().admin.firestore()
        .collection("attendances")
        .where("date", ">=", new Date(today.getFullYear(), today.getMonth(), today.getDate()))
        .where("date", "<=", new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
        .where("uid", "==", uid)
        .get();

      if (queryAttendancesSnapshot.docs.length !== 0) {
        return reply.send(createError(404, "Se ha registrado una asistencia previamente"));
      }

      const newAttendance = {
        out: attendance.out ? new Date() : null,
        in: attendance.in ? new Date() : null,
        uid: uid,
        date: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 6),
        summary: attendance.summary ?? "",
        id: id
      }

      await fastify.app().admin.firestore().doc(`attendances/${id}`).set(newAttendance);

      return reply.send(newAttendance);
    } catch (error: any) {
      return reply.send(createError(400, error.message));
    }
  });

  fastify.post<{
    Body: AttendancesType
  }>('/create_or_update_many', {
    schema: {
      body: SchemaAttendances
    }
  }, async function (request, reply) {
    await fastify.checkRole(request, reply, ['user']);
    const { attendances } = request.body;
    let uid = await fastify.getIdFromToken(request, reply);
    try {
      let batch = fastify.app().admin.firestore().batch();
      let startDate = new Date(attendances[0].date!);
      let endDate = new Date(attendances[0].date!);
      if (attendances.length > 1) {
        endDate = new Date(attendances[attendances.length - 1].date!);
        endDate.setDate(endDate.getDate() + 1);
      }

      let response = await fastify.app().admin.firestore().collection("attendances")
        .where("uid", "==", uid)
        .where("date", "<=", endDate).where("date", ">=", startDate).get();

      if (response.docs.length > 0) {
        for (let i = 0; i < response.docs.length; i++) {
          batch.delete(fastify.app().admin.firestore().collection("attendances").doc(response.docs[i].id));
        }
      }

      attendances.forEach(attendance => {
        const id = uuidv4();
        let attendanceRef = fastify.app().admin.firestore().collection("attendances").doc(id);
        batch.set(attendanceRef, {
          id: id,
          uid: uid,
          in: new Date(attendance.in!),
          out: new Date(attendance.out!),
          date: new Date(attendance.date!),
          summary: attendance.summary
        });
      });

      await batch.commit();

      return true;
    } catch (error: any) {
      reply.send(createError(400, error.message));
    }
  });

  fastify.get<{
    Params: {
      id: String
    }
  }>('/:id', {}, async function (request, reply) {
    await fastify.checkRole(request, reply, ['admin', 'user', 'maintainer', 'human_resources']);
    const id = request.params.id;
    try {
      let attendanceQuerySnapshot = await fastify.app().admin.firestore().collection("attendances").doc(id).get();
      const attendance: Attendance = attendanceQuerySnapshot.data();
      reply.send(attendance);
    } catch (error: any) {
      reply.send(createError(404, error.message));
    }
  });

  fastify.get<{
    Querystring: AttendanceRangeType,
  }>('/', {
    schema: {
      querystring: SchemaAttendanceRange
    }
  }, async function (request, reply) {
    await fastify.checkRole(request, reply, ['admin', 'user', 'maintainer', 'human_resources']);
    let { lte, gte, uid } = request.query;
    const fmtLte = lte.split('-');

    try {
      let attendanceQuery = fastify.app().admin.firestore().collection("attendances");

      if (lte) {
        attendanceQuery = attendanceQuery.where('date', '<=', new Date(new Date(
          +fmtLte[0],
          +fmtLte[1] - 1,
          +fmtLte[2]).setUTCHours(23, 59, 59)));
      }

      if (gte) {
        attendanceQuery = attendanceQuery.where('date', '>=', new Date(gte));
      }

      if (uid) {
        attendanceQuery = attendanceQuery.where('uid', '==', uid);
      }

      let attendanceQuerySnapshot = await attendanceQuery.get();

      const attendances: Attendance[] = [];
      attendanceQuerySnapshot.forEach((doc: any) => {
        const attendance = doc.data();
        attendances.push(attendance);
      });
      reply.send(attendances);
    } catch (error: any) {
      reply.send(createError(404, error.message))
    }
  });
  fastify.put<{
    Body: AttendanceType,
    Params: {
      id: string,
    }
  }>('/:id', {
    schema: {
      body: SchemaAttendance
    }
  }, async function (request, reply) {
    await fastify.checkRole(request, reply, ['admin', 'user', 'maintainer', 'human_resources']);
    const attendance = request.body;
    const id = request.params.id;

    try {
      await fastify.app().admin.firestore()
        .collection("attendances").doc(id)
        .update({
          out: new Date(),
          summary: attendance.summary,
        });

      reply.send(attendance);
    } catch (error: any) {
      reply.send(createError(500, error.message));
    }
  })
}

export async function deleteUserAttendances(fastify: FastifyInstance, uid: string) {
  let batch = fastify.app().admin.firestore().batch();
  const attendanceQuerySnapshot = await fastify.app().admin.firestore().collection("attendances")
    .where("uid", "==", uid)
    .get();

  attendanceQuerySnapshot.forEach((doc: any) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}

export default attendances;
