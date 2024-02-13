import { FastifyPluginAsync, FastifyInstance } from "fastify"

import {PaymentFilterType, PaymentType, SchemaPayment, SchemaPaymentFilter} from "./types";
const createError = require('http-errors');
import {v4 as uuidv4} from "uuid";
import {Payment} from "./interfaces";
import { getFileSignedURL, saveFileInBucket } from "../users";

const payments: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.post<{
        Body: PaymentType
    }>('/', {
        schema: {
            body: SchemaPayment
        }
    }, async function (request, reply ) {

        await fastify.checkRole(request, reply, ['admin', 'maintainer']);
        const payment = request.body;

        try {
            const id = uuidv4();
            const bucket = fastify.app().admin.storage().bucket();
            await saveFileInBucket(bucket, `payments`, payment.receipt, `${id}`);
            const newPayment = {
                amount: payment.amount,
                date: new Date(payment.date),
                uid: payment.uid,
                id: id,
            };
            await fastify.app().admin.firestore().doc(`payments/${id}`).set(newPayment);
            reply.send(newPayment);
        } catch (error: any) {
            reply.send(createError(400, error.message));
        }
    });

    fastify.delete<{
        Params: {
            id: string
        }
    }>('/:id', {}, async function (request, reply) {
        await fastify.checkRole(request, reply, ['admin', 'maintainer']);
        const id = request.params.id;

        try {
            await fastify.app().admin.firestore().collection("payments").doc(id).delete();
            await fastify.app().storage.bucket().deleteFiles({
                prefix: `payments/${id}`
            })
            reply.send();
        } catch (error: any) {
            reply.send(createError(500, error.message));
        }
    });


    fastify.get<{
        Params: {
            id: string
        }
    }>('/:id', {}, async function (request, reply) {
        await fastify.checkRole(request, reply, ['admin', 'maintainer']);
        const id = request.params.id;
        try {
            let paymentQuerySnapshot = await fastify.app().admin.firestore().collection("payments").doc(id).get();
            const payment: Payment = paymentQuerySnapshot.data();
            const bucket = fastify.app().admin.storage().bucket();
            payment.receipt = await getFileSignedURL(bucket, `payments/${id}`);
            reply.send(payment);
        } catch (error: any) {
            reply.send(createError(404, error.message));
        }
    });

    fastify.get<{
        Querystring: PaymentFilterType,
    }>('/',{
        schema: {
            querystring: SchemaPaymentFilter
        }
    }, async function(request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer']);
        const role = await fastify.getRoleFromToken(request, reply);

        let {lte, gte, uid} = request.query;

        try {
            let paymentQuery = fastify.app().admin.firestore().collection("payments");

            if (lte) {
                paymentQuery = paymentQuery.where('date', '<=', new Date(lte));
            }

            if (gte) {
                paymentQuery = paymentQuery.where('date', '>=', new Date(gte));
            }

           if (role === 'admin' || role === 'maintainer') {
               if (uid) {
                   paymentQuery = paymentQuery.where('uid', '==', uid);
               }
           } else {
              uid = await fastify.getIdFromToken(request, reply);
               paymentQuery = paymentQuery.where('uid', '==', uid);
           }

            let paymentsQuerySnapshot = await paymentQuery.get();
            const bucket = fastify.app().admin.storage().bucket();

            let payments : any[] = [];
            paymentsQuerySnapshot.forEach((doc: any) => {
                payments.push(doc.data())
            });

            const filePromises : any[] = [];

            payments.forEach(payment => {
                filePromises.push(bucket
                    .file(`payments/${payment.id}`).exists());
            });

            const filePromisesResponse = await Promise.all(filePromises);

            payments = payments.map(function (payment, index) {                
                payment.existReceipt = filePromisesResponse[index][0];
                return payment;
            });

            reply.send(payments);
        } catch (error: any) {
            reply.send(createError(404, error.message));
        }
    });

    fastify.put<{
        Body: PaymentType,
        Params: {
            id: string
        }
    }>('/:id', {
        schema: {
            body: SchemaPayment
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['admin', 'maintainer']);
        const payment = request.body;
        const id = request.params.id;
        try {
            await fastify.app().admin.firestore().collection("payments").doc(id).update({
                amount: payment.amount,
                date: new Date(payment.date),
            });

            if (payment.receipt !== "") {
                const bucket = fastify.app().admin.storage().bucket();
                await saveFileInBucket(bucket, `payments`, payment.receipt, `${id}`);
            }

            reply.send(payment);
        } catch (error: any) {
            reply.send(createError(500, error.message));
        }
    });
}

export default payments;

export async function savePayment(fastify: FastifyInstance, uid: string, payment: Payment) {
    const id = uuidv4();

    await fastify.app().admin.firestore().doc(`payments/${id}`).set({
        amount: payment.amount,
        date: new Date(payment.date),
        uid: uid,
        id: id,
    });
}

export async function deleteUserPayments(fastify: FastifyInstance, uid: string){
    let batch = fastify.app().admin.firestore().batch();
    const paymentQuerySnapshot = await fastify.app().admin.firestore().collection("payments")
        .where("uid", "==", uid)
        .get();

        paymentQuerySnapshot.forEach( (doc: any) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
}

export async function deleteUserPaymentsFiles(fastify: FastifyInstance, uid: string){
    const bucket = fastify.app().admin.storage().bucket();
    const paymentQuerySnapshot = await fastify.app().admin.firestore().collection("payments")
        .where("uid", "==", uid)
        .get();

        try {
            paymentQuerySnapshot.forEach( (doc: any) => {
                let path = "payments/" + doc.id;
                bucket.file(path).delete();
            });
        } catch (error: any) {
            throw new Error("Ha ocurrido al eliminar los archivos asociados al usuario");
        }
}