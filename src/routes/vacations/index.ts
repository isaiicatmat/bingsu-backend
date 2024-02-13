import {Vacation} from "./interfaces";
import {v4 as uuidv4} from "uuid";
import {FastifyInstance, FastifyPluginAsync} from "fastify";
import {SchemaVacationFilter, VacationFilterType} from "./types";
const createError = require('http-errors');

const vacations: FastifyPluginAsync = async(fastify, opts): Promise<void> => {
    fastify.get<{
        Querystring: VacationFilterType,
    }>('/', {
        schema: {
            querystring: SchemaVacationFilter
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer', 'human_resources']);
        const role = await fastify.getRoleFromToken(request, reply);
        let { uid, lte, gte, } = request.query;

        try {

            let vacationsQuery = fastify.app().admin.firestore().collection("vacations");

            if (lte) {
                vacationsQuery = vacationsQuery.where('date', '<=', new Date(lte));
            }

            if (gte) {
                vacationsQuery = vacationsQuery.where('date', '>=', new Date(gte));
            }

            if (role === 'admin' || role === 'maintainer' || role === 'human_resources') {
                if (uid) {
                    vacationsQuery = vacationsQuery.where("uid", "==", uid);
                }
            } else if (role === 'user') {
                uid = await fastify.getIdFromToken(request, reply);
                vacationsQuery = vacationsQuery.where("uid", "==", uid);
            }

            const vacationsQuerySnapshot = await vacationsQuery.get();
            let vacations: Vacation[] = [];

            vacationsQuerySnapshot.forEach((doc: any) => {
                const vacation = doc.data();
                vacations.push(vacation);
            });

            reply.send(vacations);
        } catch (error: any) {
            reply.send(createError(404, error.message));
        }
    });
}

export default vacations;

export async function saveVacation(fastify: FastifyInstance, uid: string, vacation: Vacation) {
    const id = uuidv4();

    await fastify.app().admin.firestore().doc(`vacations/${id}`).set({
        days: vacation.days,
        date: new Date(vacation.date),
        uid: uid,
        id: id,
    });
}

export async function deleteUserVacations(fastify: FastifyInstance, uid: string) {
    let batch = fastify.app().admin.firestore().batch();
    const vacationQuerySnapshot = await fastify.app().admin.firestore().collection("vacations")
        .where("uid", "==", uid)
        .get();

    vacationQuerySnapshot.forEach( (doc: any) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}

export async function updateVacationDays(fastify: FastifyInstance, days: string, id?: string, ) {
    if (id) {
        await fastify.app().admin.firestore().collection("vacations")
            .doc(id).update({
                days: days,
            });
    }
}

export async function updateAvailableDays(fastify: FastifyInstance, availableDays?: string, id?: string, ) {
    if (id) {
         await fastify.app().admin.firestore().collection("vacations")
            .doc(id).update({
                availableDays: availableDays,
            });
    } 
}

export async function getCurrentVacationDays(fastify: FastifyInstance, uid: string, hiringDate: Date) {
    return await getVacationDaysByYear(fastify, uid, hiringDate);
}

async function getVacationDaysByYear(fastify: FastifyInstance, uid: string, hiringDate: Date) {
    const currentDay = new Date();
    let startDate = new Date(hiringDate);
    let endDate = new Date(hiringDate);
    hiringDate.setFullYear(currentDay.getFullYear());

    startDate.setFullYear(currentDay.getFullYear() - 1);    
    endDate.setFullYear(currentDay.getFullYear());    

    if (currentDay > hiringDate) {
        startDate.setFullYear(currentDay.getFullYear());    
        endDate.setFullYear(currentDay.getFullYear() + 1);    
    }
    
    const vacationQuerySnapshot = await fastify.app().admin.firestore().collection("vacations")
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .where("uid", "==", uid)
        .get();

    let vacations: Vacation[] = [];

    vacationQuerySnapshot.forEach((doc: any) => {
        const vacation = doc.data();
        vacations.push(vacation);
    });

    return vacations.length > 0 ? vacations[0] : null;
}
