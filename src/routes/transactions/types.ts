import {Static, Type} from '@sinclair/typebox';

export const SchemaTransaction = Type.Object({
    concept: Type.String(),
    date: Type.String(),
    id: Type.Optional(Type.String()),
    category: Type.String(),
    amount: Type.String(),
    invoice: Type.String(),
    xml: Type.String(),
    folio: Type.Optional(Type.String()),
    tax: Type.Optional(Type.String()),
    subtotal: Type.Optional(Type.String()),
    uuid: Type.Optional(Type.String()),
    rfc: Type.Optional(Type.String()),
    company: Type.Optional(Type.String()),
}, {
    additionalProperties: false
});

export const SchemaTransactionFilter = Type.Object({
    gte: Type.Optional(Type.String()),
    lte: Type.Optional(Type.String()),
    uid: Type.Optional(Type.String()),
    category: Type.Optional(Type.String()),
    categories: Type.Optional(Type.Array(Type.String()))
});


export type TransactionType = Static<typeof SchemaTransaction>;
export type TransactionFilterType = Static<typeof SchemaTransactionFilter>;
