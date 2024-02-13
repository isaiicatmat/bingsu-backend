import {Static, Type} from '@sinclair/typebox';

export const SchemaExpense = Type.Object({
    cardDateOut: Type.String(),
    cardDateIn: Type.String(),
    concept: Type.String(),
    id: Type.Optional(Type.String()),
    amount: Type.String(),
    invoice: Type.String(),
    xml: Type.String(),
    folio: Type.Optional(Type.String()),
    tax: Type.Optional(Type.String()),
    subtotal: Type.Optional(Type.String()),
    uuid: Type.Optional(Type.String()),
    rfc: Type.Optional(Type.String()),
    company: Type.Optional(Type.String()),
});

export const SchemaExpenseFilter = Type.Object({
    gte: Type.Optional(Type.String()),
    lte: Type.Optional(Type.String()),
    uid: Type.Optional(Type.String())
});

export type ExpenseType = Static<typeof SchemaExpense>;
export type ExpenseFilterType = Static<typeof SchemaExpenseFilter>;