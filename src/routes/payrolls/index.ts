import { FastifyPluginAsync } from "fastify";
import { PayrollRangeType, PayrollType, SchemaPayroll, SchemaPayrollFilter } from "./types";
import { Payroll } from "./interfaces";
import { v4 as uuidv4 } from "uuid";
import { getFileSignedURL, saveFileInBucket } from "../users";
const createError = require('http-errors');
import { FastifyInstance } from "fastify";

const payrolls: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{
    Body: PayrollType,
  }>('/', {
    schema: {
      body: SchemaPayroll,
    }
  }, async function (request, reply) {
    await fastify.checkRole(request, reply, ['user']);
    const payroll = request.body;
    let uid = await fastify.getIdFromToken(request, reply);
    const id = uuidv4();

    try{
      const newPayroll = {
        uid: uid,
        id: id,
        date: new Date(payroll.date),
        type: payroll.type,
      }

      await fastify.app().admin.firestore().doc(`payrolls/${id}`).set(newPayroll);
      const bucket = fastify.app().admin.storage().bucket();
      if (payroll.file) await saveFileInBucket(bucket, `payrolls/${uid}`, payroll.file, `${id}.pdf`)

      return reply.send(newPayroll);

    } catch(error: any) {
      return reply.send(createError(400, error.message));
    }
  });
  fastify.get<{
    Querystring: PayrollRangeType,
  }>('/', {
    schema: {
      querystring: SchemaPayrollFilter
    }
  }, async function (request, reply) {
    await fastify.checkRole(request, reply, ['admin', 'user', 'maintainer', 'human_resources']);
    let { lte, gte, uid } = request.query;

    try {
      let payrollQuery = fastify.app().admin.firestore().collection("payrolls");

      if (lte) {
        payrollQuery = payrollQuery.where('date', '<=', new Date(lte));
      }

      if (gte) {
        payrollQuery = payrollQuery.where('date', '>=', new Date(gte));
      }

      if(uid) {
        payrollQuery = payrollQuery.where('uid', '==', uid);
      }

      let payloadQuerySnapshot = await payrollQuery.get();

      const payrolls: Payroll[] = [];

      payloadQuerySnapshot.forEach((doc: any) => {
        const payroll = doc.data();
        payrolls.push(payroll);
      });
      reply.send(payrolls);
    } catch(error: any) {
      reply.send(createError(404, error.message))
    }
  });
  fastify.get<{
    Params: {
      id: String,
    }
    Querystring: PayrollRangeType
  }>('/:id', {
    schema: {
      querystring: SchemaPayrollFilter
    }
  }, async function (request, reply) {
    await fastify.checkRole(request, reply, ['admin', 'maintainer', 'human_resources', 'user']);
    const role = await fastify.getRoleFromToken(request, reply);
    try{
      let uid = await fastify.getIdFromToken(request, reply);
      if (role === 'admin' || role === "maintainer" || role === 'human_resources') {
        uid = request.query.uid;
      }
      
      const id = request.params.id;
      const payrollQuerySnapshot = await fastify.app().admin.firestore().collection('payrolls').doc(id).get();
      const bucket = fastify.app().admin.storage().bucket();
      let payroll: Payroll = payrollQuerySnapshot.data();

      payroll.file = await getFileSignedURL(bucket, `payrolls/${uid}/${id}.pdf`)

      reply.send(payroll)
    } catch (error: any) {
      reply.send(createError(404, error.message));
    }
  });
  fastify.delete<{
    Params: {
      id: string
    }
  }>('/:id', {}, async function (request, reply) {
    await fastify.checkRole(request, reply, ['user']);
    const role = await fastify.getRoleFromToken(request, reply);
    const uid = await fastify.getIdFromToken(request, reply);
    const id = request.params.id;

    try {
      if (role === 'user') {
        const payrollSnapshot = await fastify.app().admin.firestore().collection("payrolls").doc(id).get();
        const payroll = payrollSnapshot.data();
        if (payroll.uid !== uid) {
          reply.send(createError(403, "No se ha podido eliminar este recibo de nómina"));
        } else {
          await fastify.app().admin.firestore().collection("payrolls").doc(id).delete();
          await fastify.app().storage.bucket().deleteFiles({
            prefix: `payrolls/${uid}/${id}`,
          });
          reply.send();
        }
      }
    } catch (error: any) {
      reply.send(createError(500, error.message));
    }
  });
}

export async function deleteUserPayrolls(fastify: FastifyInstance, uid: string) {
  let batch = fastify.app().admin.firestore().batch();
  const payloadQuerySnapshot = await fastify.app().admin.firestore().collection("payrolls")
    .where("uid", "==", uid)
    .get();

  payloadQuerySnapshot.forEach((doc: any) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}

export async function deleteUserPayrollFiles(fastify: FastifyInstance, uid: string) {
  const bucket = fastify.app().admin.storage().bucket();
    
  try {
    let path = `payrolls/${uid}/`;
    bucket.deleteFiles({
      prefix: path,
    })
  } catch (error: any) {
    throw new Error("Ha ocurrido un error al eliminar los archivos asociados al usuario");
  }
}

export default payrolls;
