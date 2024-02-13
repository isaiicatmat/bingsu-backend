import {FastifyPluginAsync} from "fastify";
import {PermissionFilterType, PermissionType, SchemaPermission, SchemaPermissionFilter} from "./types";
import {v4 as uuidv4} from "uuid";
import {getFileSignedURL, saveFileInBucket} from "../users";
import {Permission, PermissionResponse} from "./interfaces";
import { FastifyInstance } from "fastify";
import { updateAvailableDays } from "../vacations"
const createError = require('http-errors');


const permissions: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.post<{
        Body: PermissionType
    }>('/', {
        schema: {
            body: SchemaPermission
        }
    },async function (request, reply) {
        await fastify.checkRole(request, reply, ['user']);
        const permission = request.body;
        let uid = await fastify.getIdFromToken(request, reply);

        try {
            const id = uuidv4();

            await fastify.app().admin.firestore().doc(`permissions/${id}`).set({
                startDate: new Date(permission.startDate),
                endDate: new Date(permission.endDate),
                type: permission.type,
                description: permission.description,
                status: permission.status,
                uid: uid,
                id: id,
            });

            if (permission.type === "VACATION" && permission.request) {
                const bucket = fastify.app().admin.storage().bucket();
                await saveFileInBucket(bucket, `permissions`, permission.request, `${id}`);
            }
            else if (permission.type === "OCCASIONAL" && permission.request) {
                const bucket = fastify.app().admin.storage().bucket();
                await saveFileInBucket(bucket, `permissions/occasional`, permission.request, `${id}`);
            }

            reply.send({
                startDate: permission.startDate,
                endDate: permission.endDate,
                type: permission.type,
                status: permission.status,
                uid: uid,
                id: id,
            });
        } catch (error: any) {
            reply.send(createError(400, error.message))
        }
    });

    fastify.delete<{
        Params: {
            id: string,
        }
    }>('/:id', {}, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user']);
        const uid = await fastify.getIdFromToken(request, reply);
        const id = request.params.id;


        try {
            const permissionSnapshot = await fastify.app().admin.firestore().collection("permissions").doc(id).get();
            const permission = permissionSnapshot.data();

            if (permission.uid !== uid) {
                reply.send(createError(403, "No se ha podido eliminar este permiso"));
                return;
            }

            if (permission.status === 'ACCEPTED') {
                reply.send(createError(403, "No se puede eliminar un permiso ya aprobado"));
                return;
            }

            await fastify.app().admin.firestore().collection("permissions").doc(id).delete();

            if (permission.type === 'VACATION') {
                await fastify.app().storage.bucket().deleteFiles({
                    prefix: `permissions/${id}`,
                });
            }
            else if (permission.type === 'OCCASIONAL') {
                await fastify.app().storage.bucket().deleteFiles({
                    prefix: `permissions/occasional/${id}`,
                });
            }

            reply.send();
        } catch (error: any) {
            reply.send(createError(500, error.message));
        }
    });

    fastify.put<{
        Body: PermissionType,
        Params: {
            id: string
        }
    }>('/:id', {
        schema: {
            body: SchemaPermission
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer', 'human_resources']);
        const role = await fastify.getRoleFromToken(request, reply);
        const id = request.params.id;

        try {
            let permission = request.body;

            if (role == "admin" || role == "maintainer" || role == "human_resources") {
                await fastify.app().admin.firestore().collection("permissions").doc(id).update({
                    status: permission.status,
                });
                await updateAvailableDays(fastify, permission.availableDays, permission.vacationId)
            } else {
                await fastify.app().admin.firestore().collection("permissions").doc(id).update({
                    startDate: new Date(permission.startDate),
                    endDate: new Date(permission.endDate),
                    description: permission.description,
                    status: "PENDING"
                });
                if (permission.request) {
                    const bucket = fastify.app().admin.storage().bucket();
                    if (permission.type === "VACATION") {
                        await saveFileInBucket(bucket, `permissions`, permission.request, `${id}`);
                    }
                    else if (permission.type === "OCCASIONAL") {
                        await saveFileInBucket(bucket, `permissions/occasional`, permission.request, `${id}`);
                    }
                }
            }
            reply.send(permission);
        } catch (error: any) {
            reply.send(createError(500, error.message));
        }
    });

    fastify.get<{
        Params: {
            id: string,
        }
    }>('/:id', {}, async function (request, reply) {
        const id = request.params.id;
        const role = await fastify.getRoleFromToken(request, reply);
        const uid = await fastify.getIdFromToken(request, reply);

        try {
            let permissionQuerySnapshot = await fastify.app().admin.firestore().collection("permissions").doc(id).get();
            const permission: PermissionResponse = permissionQuerySnapshot.data();


            if (role === 'user' && permission.uid !== uid) {
                reply.send(createError(404, "No hemos encontrado ninguna transacción"));
            }

            if (permission.type === 'VACATION') {
                const bucket = fastify.app().admin.storage().bucket();
                permission.request = await getFileSignedURL(bucket, `permissions/${permission.id}`);
            }
            else if (permission.type === 'OCCASIONAL') {
                const bucket = fastify.app().admin.storage().bucket();
                permission.request = await getFileSignedURL(bucket, `permissions/occasional/${permission.id}`);
            }
            reply.send(permission);
        } catch (error: any) {
            reply.send(createError(404, error.message));
        }
    });


    fastify.get<{
        Querystring: PermissionFilterType
    }>('/', {
        schema: {
            querystring: SchemaPermissionFilter
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer', 'human_resources']);
        const role = await fastify.getRoleFromToken(request, reply);

        let {uid, lte, gte, type, status} = request.query;

        try {
            let permissionsQuery = fastify.app().admin.firestore().collection("permissions");
            
            if (gte) {
                permissionsQuery = permissionsQuery.where('startDate', '>=', new Date(gte));
            }

            if (type) {
                permissionsQuery = permissionsQuery.where('type', '==', type);
            }

            if (status) {
                permissionsQuery = permissionsQuery.where('status', '==', status);
            }

            if (role === 'admin' || role === "maintainer") {
                if (uid) {
                    permissionsQuery = permissionsQuery.where("uid", "==", uid);
                }
            } else if (role === 'user') {
                uid = await fastify.getIdFromToken(request, reply);
                permissionsQuery = permissionsQuery.where("uid", "==", uid);
            }

            const permissionsQuerySnapshot = await permissionsQuery.get();
            let permissions: Permission[] = [];

            permissionsQuerySnapshot.forEach((doc: any) => {
               const permission = doc.data();
               const permissionStartDate = new Date(permission.startDate._seconds * 1000);
               const permissionEndDate = new Date(permission.endDate._seconds * 1000);

               if (lte && gte) {
                const filterLasttDay = new Date(lte);
                const filterFirstDay = new Date(gte);
                const clientTimezoneOffset = new Date().getTimezoneOffset() * 60 * 1000;
                const fmtPermissionStartDate = new Date(permissionStartDate.getTime() + clientTimezoneOffset);
                const fmtPermissionEndDate = new Date(permissionEndDate.getTime() + clientTimezoneOffset);

                const fmtFirstDay = new Date(new Date(filterFirstDay.getFullYear(), filterFirstDay.getMonth(), 1).setUTCHours(0, 0, 0, 0));
                const ftmLastDay = new Date(new Date(filterLasttDay.getFullYear(), filterLasttDay.getMonth(), 0).setUTCHours(12, 59, 59, 0));
                
                if (fmtPermissionStartDate.getMonth() !== fmtPermissionEndDate.getMonth()
                    && fmtPermissionStartDate.getUTCMonth() === ftmLastDay.getUTCMonth() //Permission's start date is within filter's month
                    && fmtPermissionStartDate.getUTCMonth() === (fmtFirstDay.getUTCMonth())
                ) {
                    const permissionEndDateYear = fmtPermissionEndDate.getFullYear();
                    const lastDayFilterYear = filterLasttDay.getFullYear();
                    const yearDifference = permissionEndDateYear - lastDayFilterYear;
                    const monthDifference = fmtPermissionEndDate.getMonth() - filterLasttDay.getMonth();
                    const totalMonthDifference = (yearDifference * 12 + monthDifference) + 1;
                    const lastDayOfMonth = new Date(filterLasttDay.getFullYear(), filterLasttDay.getMonth() + totalMonthDifference, 0);
                    lastDayOfMonth.setUTCHours(12, 59, 59, 0);
                    if (fmtPermissionEndDate.getTime() <= lastDayOfMonth.getTime()) {
                        permissions.push(permission);
                    }
                } else {
                    const lastDayOfMonth = new Date(filterLasttDay.getFullYear(), filterLasttDay.getMonth(), 0);
                    lastDayOfMonth.setUTCHours(12, 59, 59, 0);
                    if (fmtPermissionEndDate.getTime() <= lastDayOfMonth.getTime()) {
                        permissions.push(permission);
                    }
                }
               }
                else {
                   permissions.push(permission);
               }

            });
            reply.send(permissions);
        } catch (error : any) {
            reply.send(createError(404, error.message));

        }

    });
}

export async function deleteUserPermissions(fastify: FastifyInstance, uid: string){
    let batch = fastify.app().admin.firestore().batch();
    const permissionQuerySnapshot = await fastify.app().admin.firestore().collection("permissions")
        .where("uid", "==", uid)
        .get();

        permissionQuerySnapshot.forEach( (doc: any) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}

export async function deleteUserPermissionFiles(fastify: FastifyInstance, uid: string){
    const bucket = fastify.app().admin.storage().bucket();
    const permissionsQuerySnapshot = await fastify.app().admin.firestore().collection("permissions")
        .where("uid", "==", uid).where("type", "==", "VACATION")
        .get();
        const permissionsOccasionalQuerySnapshot = await fastify.app().admin.firestore().collection("permissions")
        .where("uid", "==", uid).where("type", "==", "OCCASIONAL")
        .get();
        try {
            permissionsQuerySnapshot.forEach( (doc: any) => {
                let path = "permissions/" + doc.id;
                bucket.file(path).delete();
            });
            permissionsOccasionalQuerySnapshot.forEach( (doc: any) => {
                let path = "permissions/occasional/" + doc.id;
                bucket.file(path).delete();
            });

          } catch (error: any) {
            throw new Error("Ha ocurrido al eliminar los archivos asociados al usuario");
          }
}

export default permissions;
