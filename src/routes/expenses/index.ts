import { FastifyPluginAsync } from "fastify"
import { SchemaExpense, ExpenseType, SchemaExpenseFilter, ExpenseFilterType} from "./types"
import { v4 as uuidv4 } from 'uuid';
import { Expense, ExpenseResponse } from "./interfaces";
import { getFileSignedURL, saveFileInBucket } from "../users";
import { FastifyInstance } from "fastify";

const createError = require('http-errors');

const expenses: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.post<{
        Body: ExpenseType
    }>('/', {
        schema: {
            body: SchemaExpense
        }
    },
    async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer']);
        const expense = request.body;
        let uid = await fastify.getIdFromToken(request, reply);

        try {
            const id = uuidv4();
            await fastify.app().admin.firestore().doc(`expenses/${id}`).set({
                concept: expense.concept,
                cardDateOut: new Date(expense.cardDateOut),
                cardDateIn: new Date(expense.cardDateIn),
                amount: expense.amount,
                uid: uid,
                id: id,
                folio: id,
                tax: expense.tax ? expense.tax : null,
                subtotal: expense.subtotal ? expense.subtotal : null,
                uuid: expense.uuid ? expense.uuid : null,
                rfc: expense.rfc ? expense.rfc : null,
                company: expense.company ? expense.company : null,
            });
            
            if (expense.xml || expense.invoice) {
                const bucket = fastify.app().admin.storage().bucket();
                expense.folio = id;
                if (expense.invoice) await saveFileInBucket(bucket, `expenses/${id}`, expense.invoice, `${expense.folio}.pdf`);
                if (expense.xml) await saveXML(bucket, `expenses/${id}`, expense.xml, `${expense.folio}.xml`);
            }

            reply.send({
                concept: expense.concept,
                cardDateOut: expense.cardDateOut,
                cardDateIn: expense.cardDateIn,
                amount: expense.amount,
                id,
                tax: expense.tax,
                subtotal: expense.subtotal,
                uuid: expense.uuid,
                rfc: expense.rfc,
                company: expense.company,

            });
        } catch (error: any) {
            reply.send(createError(400, error.message));
        }
    });

    fastify.put<{
        Body: ExpenseType
    }>('/:id', {
        schema: {
            body: SchemaExpense
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer']);
        const role = await fastify.getRoleFromToken(request, reply);
        const uid = await fastify.getIdFromToken(request, reply);

        try {
            let expense = request.body;
            const savedExpenseSnapshot = await fastify.app().admin.firestore().collection("expenses").doc(expense.id).get();
            const savedExpense = savedExpenseSnapshot.data();

            if (role === 'user') {
                if (savedExpense.uid !== uid) {
                    reply.send(createError(403, "No se ha podido editar este cargo."));
                }
            }

            await fastify.app().admin.firestore().collection("expenses").doc(expense.id).update({
                concept: expense.concept,
                cardDateOut: new Date(expense.cardDateOut),
                cardDateIn: new Date(expense.cardDateIn),
                amount: expense.amount,
                tax: expense.tax ? expense.tax : null,
                subtotal: expense.subtotal ? expense.subtotal : null,
                uuid: expense.uuid ? expense.uuid : null,
                rfc: expense.rfc ? expense.rfc : null,
                company: expense.company ? expense.company : null,
            });

            const bucket = fastify.app().admin.storage().bucket();
            if (expense.invoice !== "") {
                await fastify.app().storage.bucket().deleteFiles({
                    prefix: `expenses/${expense.id}/${expense.folio}.pdf`
                });
                await saveFileInBucket(bucket, `expenses/${expense.id}`, expense.invoice, `${expense.folio}.pdf`)
            }

            if (expense.xml !== "") {
                await fastify.app().storage.bucket().deleteFiles({
                    prefix: `expenses/${expense.id}/${expense.folio}.xml`
                });
                await saveXML(bucket, `expenses/${expense.id}`, expense.xml, `${expense.folio}.xml`);
            }
            reply.send(expense);
        } catch (error: any) {
            reply.send(createError(500, error.message));
        }
    });

    fastify.get<{
        Querystring: ExpenseFilterType,
    }>('/', {
        schema: {
            querystring: SchemaExpenseFilter
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['user', 'admin', 'maintainer']);
        const role = await fastify.getRoleFromToken(request, reply);
        let {lte, gte, uid} = request.query;

        try {
            let expensesQuery = fastify.app().admin.firestore().collection("expenses");

            if (lte) {
                expensesQuery = expensesQuery.where('cardDateOut', '<=', new Date(lte));
            }

            if (gte) {
                expensesQuery = expensesQuery.where('cardDateOut', '>=', new Date(gte));
            }

            if (role === 'admin') {
                if (uid) {
                    expensesQuery = expensesQuery.where("uid", "==", uid);
                }
            } 
            
            else if (role === 'user') {
                uid = await fastify.getIdFromToken(request, reply);
                expensesQuery = expensesQuery.where("uid", "==", uid);
            }
            
            const expensesQuerySnapshot = await expensesQuery.get();
            let expenses: Expense[] = [];
            expensesQuerySnapshot.forEach((doc: any) => {
                const expense = doc.data();
                expenses.push(expense);
            });

            reply.send(expenses)
        } catch(error: any) {
            reply.send(createError(404, error.message))
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
            let expensesQuerySnapshot = await fastify.app().admin.firestore().collection("expenses").doc(id).get();
            const expense: ExpenseResponse = expensesQuerySnapshot.data();
            if (role === 'user' && expense.uid !== uid) {
                reply.send(createError(404, "No hemos encontrado ningún cargo."));
            }
            const bucket = fastify.app().admin.storage().bucket();
            expense.invoice = await getFileSignedURL (bucket, `expenses/${id}/${expense.folio}.pdf`);
            expense.xml = await getFileSignedURL (bucket, `expenses/${id}/${expense.folio}.xml`);
            reply.send(expense);
        } catch(error: any) {
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
                const expenseSnapshot = await fastify.app().admin.firestore().collection("expenses").doc(id).get();
                const expense = expenseSnapshot.data();
                if (expense.uid !== uid) {
                    reply.send(createError(404, "No se ha podido eliminar este cargo."));
                }
            }
            await fastify.app().admin.firestore().collection("expenses").doc(id).delete();
            await fastify.app().storage.bucket().deleteFiles({
                prefix: `expenses/${id}`,
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


export async function deleteUserExpenses(fastify: FastifyInstance, uid: string){
    let batch = fastify.app().admin.firestore().batch();
    const expenseQuerySnapshot = await fastify.app().admin.firestore().collection("expenses")
        .where("uid", "==", uid)
        .get();

        expenseQuerySnapshot.forEach( (doc: any) => {
            batch.delete(doc.ref);
        });

    await batch.commit();
}

export async function deleteUserInvoices(bucket: any, fastify: FastifyInstance, uid: string){
    const expenseQuerySnapshot = await fastify.app().admin.firestore().collection("expenses")
        .where("uid", "==", uid)
        .get();

        try {
            expenseQuerySnapshot.forEach( (doc: any) => {
                let path =  "expenses/" + doc.id + "/";
                bucket.deleteFiles({ prefix: path});
            });

          } catch (error: any) {
            throw new Error("Ha ocurrido al eliminar los archivos asociados al usuario");
          }

}
export default expenses;

