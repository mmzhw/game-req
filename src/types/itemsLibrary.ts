interface ItemsSingle {
    name: string
    value: string
}
interface ItemsSingleMenu {
    name: string
    value: string
    isPath: boolean
}
interface ItemsDjsSingle {
    name: string
    value: string
    type: string
}
interface ItemsGJQT {
    nameWord: string
    itemNum: string
    itemName: string
    itemId: any
    reqType: string
    filterName: string
    sendIntervalTime: number
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
