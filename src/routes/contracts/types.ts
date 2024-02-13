import {Static, Type} from '@sinclair/typebox';

export const SchemaContract = Type.Object({
    amount: Type.String(),
    startDate: Type.String(),
    endDate: Type.String(),
    indeterminate: Type.Boolean(),
    client: Type.String(),
    id: Type.Optional(Type.String())
}, {
    additionalProperties: false
});

export const SchemaContractFilter = Type.Object({
    gte: Type.Optional(Type.String()),
    lte: Type.Optional(Type.String()),
});

export type ContractType = Static<typeof SchemaContract>;
export type ContractFilterType = Static<typeof SchemaContractFilter>;
