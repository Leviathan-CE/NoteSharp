

/**
 * Token used to pass data directly into firebaseAuth
 */
export interface SessionCreateAccountToken{
    email:string,
    password:string,
    role?:string
}

/**
 * Data Token used for id and basic info about a particular user signed into the system
 * token is optional and only used for API authentication, never stored in database
 */
export interface SessionToken{
    email:string,
    displayName:string,
    UID:string,
    role?:string,
    token?:string,
    isAdmin?:boolean
}
