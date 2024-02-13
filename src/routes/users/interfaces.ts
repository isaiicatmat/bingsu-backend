export interface User {
    name: string,
    id: string,
    firstLastName: string,
    socialSecurityNumber: string,
    secondLastName: string,
    phoneNumber: string,
    vacationDays: string,
    initialAmount: string,
    roles: string
    address: string,
    curp: string,
    hiringDate: string,
    birthday: string,
    employeeId: string,
    rfc: string,
    email: string,
    emergencyNumberOne: string,
    bank: string,
    bankAccount: string,
}

export interface UserResponse {
    name: string,
    id: string,
    firstLastName: string,
    socialSecurityNumber: string,
    secondLastName: string,
    roles: string,
    hiringDate: {
        _seconds: string,
        nanoseconds: string
    },
    birthday: string,
    vacationDays: string,
    initialAmount: string,
    employeeId: string,
    phoneNumber: string,
    address: string,
    curp: string,
    rfc: string,
    email: string,
    emergencyNumberOne: string,
    birthCertificate: string,
    bachelorCertificate: string,
    addressCertificate: string,
    ine: string,
    avatar: string,
    bank: string,
    bankAccount: string,
}