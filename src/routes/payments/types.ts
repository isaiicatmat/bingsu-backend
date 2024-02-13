import {Static, Type} from '@sinclair/typebox';

export const SchemaPayment = Type.Object({
    amount: Type.String(),
    date: Type.String(),
    uid: Type.Optional(Type.String()),
    id: Type.Optional(Type.String()),
    receipt: Type.String(),
}, {
    additionalProperties: false
});

export const SchemaPaymentFilter = Type.Object({
    gte: Type.Optional(Type.String()),
    lte: Type.Optional(Type.String()),
    uid: Type.Optional(Type.String())
});

export type PaymentType = Static<typeof SchemaPayment>;
export type PaymentFilterType = Static<typeof SchemaPaymentFilter>;
