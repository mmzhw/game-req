import gujianqitan from '@/constant/gujianqitan'
import gulong from '@/constant/gulong'
import menghuanjianghu from '@/constant/menghuanjianghu'
import jianxiaqingyuan from '@/constant/jianxiaqingyuan'

// const zzz = []
//
// for(let i=1;i<cz.options.length;i++){
//     zzz.push({name:cz.options[i].text,value:cz.options[i].value})
// }
//
// JSON.stringify(zzz)

const getPublicInitData = (type: string, options: { nameWord: string }) => {
    const { nameWord } = options
    const ids = window.localStorage.getItem(type + 'itemId')
    return {
        nameWord: window.localStorage.getItem(type + 'nameWord') || nameWord,
        itemNum: window.localStorage.getItem(type + 'itemNumber') || '',
        itemName: window.localStorage.getItem(type + 'itemName') || '',
        itemId: ids ? JSON.parse(ids) : [],
        reqType: window.localStorage.getItem(type + 'reqType') || 'mail',
        filterName: window.localStorage.getItem(type + 'filterName') || '',
        sendIntervalTime: Number(window.localStorage.getItem(type + 'IntervalTime')) || 1000,
        realReqMethod: 'post'
    }
}

const glqxz: ItemsGJQT = {
    ...getPublicInitData('glqxz', { nameWord: '桃花碧柔' }),
    mail: gulong.WUPIN,
    charge: gulong.CHARG_WUPIN,
    charge2: gulong.CHARG_2_WUPIN,
    getReqFormData: (type: string, nameWord: string, itemNum: string, id: string) => {
        const params: any = {
            charge: {
                type: 'charge',
                username: nameWord,
                qu: 2,
                rechargeId: 10,
                number: Number(itemNum),
                rechargezId: '',
                znumber: 1,
                mailnum: 1
            },
            charge2: {
                type: 'charge2',
                username: nameWord,
                qu: 2,
                rechargeId: 10,
                znumber: Number(itemNum),
                rechargezId: Number(id),
                mailnum: 1
            },
            mail: {
                type: 'mail',
                username: nameWord,
                mailid: Number(id),
                mailnum: Number(itemNum),
                qu: 2,
                charge: 3
            }
        }
        return params[type]
    },
    getReqParams: (type: string, nameWord: string, itemNum: string, id: string) => {
        return { act: 'send', sid: 1001 }
    },
    realReqUrl: 'http://106.74.21.2:81/jkgm/user/playerapi.php'
}

const gjqt: ItemsGJQT = {
    ...getPublicInitData('gjqt', { nameWord: '31505037001' }),
    mail: gujianqitan.WUPIN,
    charge: gujianqitan.CHARG_WUPIN,
    charge2: [],
    getReqFormData: (type: string, nameWord: string, itemNum: string, id: string) => {
        const params: any = {
            charge: {
                action: 'charge',
                qid: 1,
                uid: nameWord,
                chargeid: Number(id)
            },
            mail: {
                action: 'senditem',
                qid: 1,
                uid: nameWord,
                itemid: Number(id),
                itemnum: Number(itemNum)
            }
        }
        return params[type]
    },
    getReqParams: (type: string, nameWord: string, itemNum: string, id: string) => {
        return null
    },
    realReqUrl: 'http://61.171.55.117:8090/ht/gm/query.php'
}

const mhjh: ItemsGJQT = {
    ...getPublicInitData('mhjh', { nameWord: '梦儿' }),
    mail: menghuanjianghu.WUPIN,
    charge: menghuanjianghu.CHARG_WUPIN,
    charge2: [],
    getReqFormData: (type: string, nameWord: string, itemNum: string, id: string) => {
        const params: any = {
            charge: {
                type: 'charge',
                uid: nameWord,
                cz: Number(id),
                game_id: 1177
            },
            mail: {
                type: 'mail',
                uid: nameWord,
                item: id,
                num: Number(itemNum),
                game_id: 1177
            }
        }
        return params[type]
    },
    getReqParams: (type: string, nameWord: string, itemNum: string, id: string) => {
        return null
    },
    realReqUrl: 'http://api.zsl168.com:88/web/mhjh/user/playerapi.php'
}

const jxqy: ItemsGJQT = {
    ...getPublicInitData('jxqy', { nameWord: '1057245' }),
    mail: jianxiaqingyuan.WUPIN,
    charge: [
        { name: '元宝', value: 'charge' },
        { name: '黎饰', value: 'pay2' },
        { name: 'vip经验', value: 'VipExp' }
    ],
    charge2: [],
    getReqFormData: (type: string, nameWord: string, itemNum: string, id: string) => {
        const params: any = {
            mail: {
                type: 'mail',
                uid: nameWord,
                item: id,
                num: itemNum,
                game_id: 833
            },
            charge: {
                type: id,
                uid: nameWord,
                chargenum: itemNum,
                game_id: 833
            }
        }
        return params[type]
    },
    getReqParams: (type: string, nameWord: string, itemNum: string, id: string) => {
        return null
    },
    realReqUrl: 'http://api.zsl168.com:88/web/jxqy/user/playerapi.php'
}
const defaultValues: any = { glqxz: glqxz, gjqt: gjqt, mhjh: mhjh, jxqy: jxqy }

export default defaultValues
