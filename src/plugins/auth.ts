import fp from "fastify-plugin";
import {getAuth} from "firebase-admin/auth";
import {FirestorePluginOptions} from "./firestore";
const createError = require('http-errors');
import jwt_decode from "jwt-decode";


interface IToken {
    user_id: string,
    role: string
}

export default fp<FirestorePluginOptions>( async (fastify, opts) => {
    fastify.decorate('checkRole', async function (request: any, reply: any, role: string) {
        const token = request.headers['authorization'];
        if (token) {
            const parsedToken = token.slice(7);
            const claims = await getAuth().verifyIdToken(parsedToken);
           

            if (!role.includes(claims.role)) {
                reply.send(createError(401, "No estás autorizado para realizar esta acción"));
            }
        } else {
            reply.send(createError(401, "Se requiere un token para realizar esta acción"));
        }
    });

    fastify.decorate('getIdFromToken', async function (request: any, reply: any, role: string) {
        const token = request.headers['authorization'];
        if (token) {
            const parsedToken = token.slice(7);
            const decodedToken: IToken = jwt_decode(parsedToken);
            return decodedToken.user_id;
        } else {
            reply.send(createError(401, "Se requiere un token para obtener el id del usuario"));
        }
    })

    fastify.decorate('getRoleFromToken', async function (request: any, reply: any, role: string) {
        const token = request.headers['authorization'];
        if (token) {
            const parsedToken = token.slice(7);
            const claims = await getAuth().verifyIdToken(parsedToken);
            return claims.role;
        } else {
            reply.send(createError(401, "Se requiere un token para obtener el rol"));
        }
    })
});

declare module 'fastify' {
    export interface FastifyInstance {
        checkRole(request: any, reply: any, role: string[]): any;
        getIdFromToken(request: any, reply: any): any;
        getRoleFromToken(request: any, reply: any): any;
    }
}
