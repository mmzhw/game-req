
interface ItemsSingle {
    name: string
    value: string
}

interface ItemsGJQT {
    nameWord: string
    itemNum: string
    itemId: string
    reqType: string
    filterName: string
    mail: ItemsSingle[]
    charge: ItemsSingle[]
    charge2: ItemsSingle[]
    getReqFormData: any
    getReqParams: any
    realReqUrl: string
    realReqMethod: string
}

interface idDefaultValues {
    [key: string]: any
}
