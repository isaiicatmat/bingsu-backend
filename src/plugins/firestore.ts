import fp from 'fastify-plugin'
import {getAuth} from "firebase-admin/auth";

const admin = require("firebase-admin");

let credential = admin.credential.applicationDefault();

if (process.env.NODE_ENV === 'local') {
    const serviceAccount = require("../../bingsu-backend-firebase.json");
    credential = admin.credential.cert(serviceAccount);
}

admin.initializeApp({
    credential: credential,
    storageBucket: process.env.STORAGE_BUCKET
});

const auth = getAuth();

const storage = admin.storage();

async function deleteFile(fileName: string) {
    try {
        await storage.bucket().file(fileName).delete();
    } catch (error: any) {
        throw new Error(`Ha ocurrido al eliminar el archivo ${fileName}`);
    }
}

export interface FirestorePluginOptions {

}

export default fp<FirestorePluginOptions>( async (fastify, opts) => {
    fastify.decorate('app', function () {
        return {
            admin,
            auth,
            storage,
            deleteFile,
        };
    })
});

declare module 'fastify' {
    export interface FastifyInstance {
        app(): any;
    }
}
