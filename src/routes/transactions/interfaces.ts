export interface Transaction {
    concept: string,
    date: string,
    category: string,
    amount: string
}

export interface TransactionResponse {
    concept: string,
    folio: string,
    date: string,
    uid: string,
    id: string,
    category: string,
    amount: string,
    xml: string,
    invoice: string,
    tax: string,
    subtotal: string,
    uuid: string,
    rfc: string,
    company: string,
}