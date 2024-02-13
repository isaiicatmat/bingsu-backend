export interface Expense {
    cardDateOut: string,
    cardDateIn: string,
    concept: string,
    amount: string
}

export interface ExpenseResponse {
    cardDateOut: string,
    cardDateIn: string,
    concept: string,
    amount: string,
    id: string,
    uid: string,
    folio: string,
    invoice: string,
    xml: string,
    tax: string,
    subtotal: string,
    uuid: string,
    rfc: string,
    company: string,
}