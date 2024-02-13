import { FastifyPluginAsync } from "fastify"
import {SchemaTransaction, SchemaTransactionFilter, TransactionFilterType, TransactionType} from "./types";
import {getFileSignedURL, saveFileInBucket} from '../users';
import {Transaction, TransactionResponse} from "./interfaces";
const createError = require('http-errors');
import { v4 as uuidv4 } from 'uuid';
import { FastifyInstance } from "fastify";

const transactions: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.post<{
        Body: TransactionType
    }>('/', {
        schema: {
            body: SchemaTransaction
        }
    },async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer']);
        const transaction = request.body;
        let uid = await fastify.getIdFromToken(request, reply);

        try {
            const id = uuidv4();
            await fastify.app().admin.firestore().doc(`transactions/${id}`).set({
                concept: transaction.concept,
                folio: id,
                date: new Date(transaction.date),
                category: transaction.category,
                amount: transaction.amount,
                uid: uid,
                id: id,
                tax: transaction.tax ? transaction.tax : null,
                subtotal: transaction.subtotal ? transaction.subtotal : null,
                uuid: transaction.uuid ? transaction.uuid : null,
                rfc: transaction.rfc ? transaction.rfc : null,
                company: transaction.company ? transaction.company : null,
            });

            if (transaction.xml || transaction.invoice) {
                const bucket = fastify.app().admin.storage().bucket();
                transaction.folio = id;
                if (transaction.invoice) await saveFileInBucket(bucket, `invoices/${id}`, transaction.invoice, `${transaction.folio}.pdf`);
                if (transaction.xml) await saveXML(bucket, `invoices/${id}`, transaction.xml, `${transaction.folio}.xml`);
            }

            reply.send({
                concept: transaction.concept,
                date: transaction.date,
                category: transaction.category,
                amount: transaction.amount,
                id,
                tax: transaction.tax,
                subtotal: transaction.subtotal,
                uuid: transaction.uuid,
                rfc: transaction.rfc,
                company: transaction.company,
            });
        } catch (error: any) {
            reply.send(createError(400, error.message));
        }
    });

    fastify.put<{
        Body: TransactionType
    }>('/:id', {
        schema: {
            body: SchemaTransaction
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer']);
        const role = await fastify.getRoleFromToken(request, reply);
        const uid = await fastify.getIdFromToken(request, reply);

        try {
            let transaction = request.body;
            const savedTransactionSnapshot = await fastify.app().admin.firestore().collection("transactions").doc(transaction.id).get();
            const savedTransaction = savedTransactionSnapshot.data();

            if (role === 'user') {
                if (savedTransaction.uid !== uid) {
                    reply.send(createError(403, "No se ha podido editar esta transacción"));
                }
            }

            await fastify.app().admin.firestore().collection("transactions").doc(transaction.id).update({
                concept: transaction.concept,
                date: new Date(transaction.date),
                category: transaction.category,
                amount: transaction.amount,
                tax: transaction.tax ? transaction.tax : null,
                subtotal: transaction.subtotal ? transaction.subtotal : null,
                uuid: transaction.uuid ? transaction.uuid : null,
                rfc: transaction.rfc ? transaction.rfc : null,
                company: transaction.company ? transaction.company : null,
            });
            
            const bucket = fastify.app().admin.storage().bucket();
            
            if (transaction.invoice !== "") {
                await fastify.app().storage.bucket().deleteFiles({
                    prefix: `invoices/${transaction.folio}.pdf`,
                });

                await saveFileInBucket(bucket, `invoices/${transaction.id}`, transaction.invoice, `${transaction.folio}.pdf`);
            }

            if (transaction.xml !== "") {
                await fastify.app().storage.bucket().deleteFiles({
                    prefix: `invoices/${transaction.folio}.xml`,
                });
                await saveXML(bucket, `invoices/${transaction.id}`, transaction.xml, `${transaction.folio}.xml`);
            }
            reply.send(transaction);
         } catch (error: any) {
            reply.send(createError(500, error.message));
        }
    });

    fastify.get<{
        Querystring: TransactionFilterType,
    }>('/', {
        schema: {
            querystring: SchemaTransactionFilter
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer']);
        const role = await fastify.getRoleFromToken(request, reply);
        let {lte, gte, uid, category, categories} = request.query;

        try {
            let transactionsQuery = fastify.app().admin.firestore().collection("transactions");

            if (lte) {
                transactionsQuery = transactionsQuery.where('date', '<=', new Date(lte));
            }

            if (gte) {
                transactionsQuery = transactionsQuery.where('date', '>=', new Date(gte));
            }

            if (category) {
                transactionsQuery = transactionsQuery.where('category', '==', category);
            }

            if (categories && categories.length > 0) {
                transactionsQuery = transactionsQuery.where('category', "array-contains-any", categories);
            }

            if (role === 'admin' || role === "maintainer") {
                if (uid) {
                    transactionsQuery = transactionsQuery.where("uid", "==", uid);
                }
            } else if (role === 'user') {
                uid = await fastify.getIdFromToken(request, reply);
                transactionsQuery = transactionsQuery.where("uid", "==", uid);
            }

            const transactionsQuerySnapshot = await transactionsQuery.get();
            let transactions: Transaction[] = [];
            transactionsQuerySnapshot.forEach((doc: any) => {
                const transaction = doc.data();
                transactions.push(transaction);
            });
            reply.send(transactions);
        } catch (error: any) {
            reply.send(createError(404, error.message));
        }
    });

    fastify.get<{
        Params: {
            id: string
        }
    }>('/:id', {}, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer']);
        const role = await fastify.getRoleFromToken(request, reply);
        const uid = await fastify.getIdFromToken(request, reply);
        const id = request.params.id;

        try {
            let transactionsQuerySnapshot = await fastify.app().admin.firestore().collection("transactions").doc(id).get();
            const transaction: TransactionResponse = transactionsQuerySnapshot.data();
            if (role === 'user' && transaction.uid !== uid) {
                reply.send(createError(404, "No hemos encontrado ninguna transacción"));
            }
            const bucket = fastify.app().admin.storage().bucket();
            transaction.invoice = await getFileSignedURL(bucket, `invoices/${id}/${transaction.folio}.pdf`);
            transaction.xml = await getFileSignedURL(bucket, `invoices/${id}/${transaction.folio}.xml`);
            reply.send(transaction);
        } catch (error: any) {
            reply.send(createError(404, error.message));
        }
    });

    fastify.delete<{
        Params: {
            id: string
        }
    }>('/:id', {}, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer']);
        const role = await fastify.getRoleFromToken(request, reply);
        const uid = await fastify.getIdFromToken(request, reply);
        const id = request.params.id;

        try {
            if (role === 'user') {
                const transactionSnapshot = await fastify.app().admin.firestore().collection("transactions").doc(id).get();
                const transaction = transactionSnapshot.data();
                if (transaction.uid !== uid) {
                    reply.send(createError(403, "No se ha podido eliminar esta transacción"));
                }
            }
            await fastify.app().admin.firestore().collection("transactions").doc(id).delete();
            await fastify.app().storage.bucket().deleteFiles({
                prefix: `invoices/${id}`,
            });
            reply.send();
        } catch (error: any) {
            reply.send(createError(500, error.message));
        }
    });
};


export async function saveXML(bucket: any, userId: string, base64EncodeFile: string, fileName: string) {
    const file = bucket.file(`${userId}/${fileName}`);
    const contents = Buffer.from(base64EncodeFile.replace(/^data:\w+\/\w+;base64,/, ""), 'base64');

    await file.save(contents, {
        public: true,
        resumable: false,
        metadata: {
            contentType: 'application/xml'
        }, validation: false,
    });
}


export async function deleteUserTransactions(fastify: FastifyInstance, uid: string){
    let batch = fastify.app().admin.firestore().batch();
    const transactionQuerySnapshot = await fastify.app().admin.firestore().collection("transactions")
        .where("uid", "==", uid)
        .get();

        transactionQuerySnapshot.forEach( (doc: any) => {
        batch.delete(doc.ref);
        });

    await batch.commit();
}

export async function deleteUserInvoices(bucket: any, fastify: FastifyInstance, uid: string){
    const transactionQuerySnapshot = await fastify.app().admin.firestore().collection("transactions")
        .where("uid", "==", uid)
        .get();

        try {
            transactionQuerySnapshot.forEach( (doc: any) => {
                let path =  "invoices/" + doc.id + "/";
                bucket.deleteFiles({ prefix: path});
            });

          } catch (error: any) {
            throw new Error("Ha ocurrido al eliminar los archivos asociados al usuario");
          }

}
export default transactions;

