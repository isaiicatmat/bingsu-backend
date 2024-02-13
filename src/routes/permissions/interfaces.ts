export interface Permission {
    type: string,
    startDate: string,
    endDate: string,
    status: string,
    availableDays: string,
    vacationId: string,
}

export interface PermissionResponse {
    type: string,
    startDate: string,
    endDate: string,
    request: string,
    description: string,
    uid: string,
    id: string,
}
