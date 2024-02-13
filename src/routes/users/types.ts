import {Static, Type} from '@sinclair/typebox';

export const SchemaUser = Type.Object({
    name: Type.String(),
    id: Type.Optional(Type.String()),
    firstLastName: Type.String(),
    socialSecurityNumber: Type.String(),
    secondLastName: Type.String(),
    roles: Type.Optional(Type.String()),
    vacationDays: Type.String(),
    initialAmount: Type.String(),
    phoneNumber: Type.String(), //
    address: Type.String(), //
    curp: Type.String(), //
    rfc: Type.String(), //
    email: Type.String({format: "email"}), //
    emergencyNumberOne: Type.String(), //
    emergencyNumberTwo: Type.String(), //
    hiringDate: Type.String(), //
    birthday: Type.String(),
    employeeId: Type.String(), //
    ine: Type.String(),
    birthCertificate: Type.String(),
    bachelorCertificate: Type.String(),
    addressCertificate: Type.String(),
    avatar: Type.String(),
    bank: Type.String(),
    bankAccount: Type.String(),
}, {
    additionalProperties: false
});


export type UserType = Static<typeof SchemaUser>;
