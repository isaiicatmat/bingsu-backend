import { FastifyPluginAsync } from "fastify";
import { CheckInType, SchemaCheckIn, CheckInRangeType, SchemaCheckInRange} from "./types";
const createError = require('http-errors');
import {v4 as uuidv4} from "uuid";
import{CheckIn} from "./interfaces";
import { FastifyInstance } from "fastify";

const check_ins: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.post<{
        Body: CheckInType
    }>('/', {
            schema: {
                body: SchemaCheckIn,
            }
    }, async function (request, reply) {
            await fastify.checkRole(request, reply, ['user']);
            const checkIn = request.body;
            let uid = checkIn.uid ? checkIn.uid : await fastify.getIdFromToken(request, reply);
            let today = new Date();
            let yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            today.setHours(23, 59, 59, 0);
            yesterday.setHours(23, 59, 59, 0);

        try {

            let queryCheckInsSnapshot =  await fastify.app().admin.firestore().collection("checkins").where("date", ">=", yesterday).where("date", "<=", today).where("uid", "==", uid).get();
            if(queryCheckInsSnapshot.docs.length != 0) {
                reply.send(createError(404, "Se registro previamente"));
            } else {
                const id = uuidv4();

                await fastify.app().admin.firestore().doc(`checkins/${id}`).set({
                    date: new Date(checkIn.date),
                    uid: uid,
                    id: id
                });
                reply.send({
                    date: checkIn.date,
                    id
                });
            }
        } catch (error: any) {
            reply.send(createError(400, error.message));
        }
    });
    fastify.get<{
        Querystring: CheckInRangeType,
    }>('/',{
        schema: {
            querystring: SchemaCheckInRange
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['admin', 'user', 'maintainer']);
        let {lte, gte, uid} = request.query;
        try {
            let checkInQuery = fastify.app().admin.firestore().collection("checkins");

            if (lte) {
                checkInQuery = checkInQuery.where('date', '<=', new Date(lte));
            }

            if (gte) {
                checkInQuery = checkInQuery.where('date', '>=', new Date(gte));
            }

            if(uid != null) {
                checkInQuery = checkInQuery.where('uid', '==', uid);
            }

            let checkInQuerySnapshot = await checkInQuery.get();

            const check_Ins: CheckIn[] = [];
            checkInQuerySnapshot.forEach((doc: any) => {
                const checkIn = doc.data();
                check_Ins.push(checkIn);
            });
            reply.send(check_Ins);
        } catch (error: any) {
            reply.send(createError(404, error.message))
        }
    });

}
export async function deleteUserCheckIns(fastify: FastifyInstance, uid: string){
    let batch = fastify.app().admin.firestore().batch();
    const checkInQuerySnapshot = await fastify.app().admin.firestore().collection("checkins")
        .where("uid", "==", uid)
        .get();

    checkInQuerySnapshot.forEach( (doc: any) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}

export default check_ins;
