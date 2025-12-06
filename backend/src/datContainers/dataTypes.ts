//I would recomend having a copy of these Types 
// In the front end as well for ease of use between 
//parsing and API calls

export interface Item {
    id:string
    content: string
    contentType:ContentType
    position:number[]
    size:number[]
}

export interface Board extends Item{
    owner:string
    parentId:string | undefined
    isRoot:boolean
    permissions:string[]
    items:Item[]
}

export interface UserPermission{
    permissionId: string
    boardId:string
    userId:string
    permission:Permision
    timestamp:string
}

export enum ContentType{
    TEXT = "text",
    HTML = "html",
    IMG = "img",
    CONTAINER = "container",
    LINE = "line",
    BOARD = "board"
}

export enum Permision{
    VIEW = "view",
    EDIT = "edit",
    OWNER = "owner"

}