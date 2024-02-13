import {FastifyPluginAsync} from "fastify";
import {ContractFilterType, ContractType, SchemaContract, SchemaContractFilter} from "./types";
import {Contract} from "./interfaces";
import {v4 as uuidv4} from "uuid";
const createError = require('http-errors');


const contracts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.post<{
        Body: ContractType
    }>('/', {
        schema: {
            body: SchemaContract
        }
    }, async function (request, reply ) {
        await fastify.checkRole(request, reply, ['admin', 'maintainer']);
        const contract = request.body;

        try {
            const id = uuidv4();
            await fastify.app().admin.firestore().collection('contracts').doc(id).set({
                amount: contract.amount,
                startDate: contract.indeterminate ? "" : new Date(contract.startDate),
                endDate: contract.indeterminate ? "" : new Date(contract.endDate),
                indeterminate: contract.indeterminate,
                client: contract.client,
                id
            });
            reply.send({
                amount: contract.amount,
                startDate:  contract.startDate,
                endDate:  contract.endDate,
                indeterminate:  contract.indeterminate,
                client:  contract.client,
                id
            });
        } catch (error: any) {
            reply.send(createError(400, error.message));
        }
    });

    fastify.get<{
        Querystring: ContractFilterType,
    }>('/',{
        schema: {
            querystring: SchemaContractFilter
        }
    }, async function(request, reply) {
        await fastify.checkRole(request, reply, ['admin', 'maintainer']);
        const {lte, gte} = request.query;
        let contracts: Contract[] = [];

        try {

            if (lte && gte) {
                let contractDatesGteQuery = fastify.app().admin.firestore()
                    .collection('contracts')
                    .where("startDate", ">=", new Date(gte));

                let contractIndeterminateQuery = fastify.app().admin.firestore()
                    .collection('contracts')
                    .where("indeterminate", "==", true);

                let contractDatesGteQuerySnapshot = await contractDatesGteQuery.get();
                let contractIndeterminateQuerySnapshot = await contractIndeterminateQuery.get();

                let contractDatesGte : Contract[] = [];

                contractDatesGteQuerySnapshot.forEach((doc: any) => {
                    contractDatesGte.push(doc.data());
                });

                contracts = contractDatesGte.filter((contract: any) => {
                    return new Date(contract.endDate._seconds * 1000) < new Date(lte);
                });

                contractIndeterminateQuerySnapshot.forEach((doc: any) => {
                    const contract = doc.data();
                    contracts.push(contract);
                });
            } else {
                let contractsQuery = fastify.app().admin.firestore()
                    .collection('contracts');

                let contractsQuerySnapshot = await contractsQuery.get();

                contractsQuerySnapshot.forEach((doc: any) => {
                    const contract = doc.data();
                    contracts.push(contract);
                });
            }
            reply.send(contracts);
        } catch (error: any) {
            reply.send(createError(404, error.message));
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
            let contractQuerySnapshot = await fastify.app().admin.firestore().collection("contracts").doc(id).get();
            const contract: Contract = contractQuerySnapshot.data();
            reply.send(contract);
        } catch (error: any) {
            reply.send(createError(404, error.message));
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
            await fastify.app().admin.firestore().collection("contracts").doc(id).delete();
            reply.send();
        } catch (error: any) {
            reply.send(createError(500, error.message));
        }
    });

    fastify.put<{
        Body: ContractType,
        Params: {
            id: string
        }
    }>('/:id', {
        schema: {
            body: SchemaContract
        }
    }, async function (request, reply) {
        await fastify.checkRole(request, reply, ['admin', 'maintainer']);
        const contract = request.body;
        const id = request.params.id;
        try {
            await fastify.app().admin.firestore().collection("contracts").doc(id).update({
                amount: contract.amount,
                startDate: new Date(contract.startDate),
                endDate: new Date(contract.endDate),
                indeterminate: contract.indeterminate,
                client: contract.client,
            });
            reply.send(contract);
        } catch (error: any) {
            reply.send(createError(500, error.message));
        }

    });
}

export default contracts;
