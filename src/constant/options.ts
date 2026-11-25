import _ from 'lodash'
import axios from 'axios'

interface BatchItem {
    item: ItemsTypeSingle
    number: any
}

const stringifyBatchItems = (items: BatchItem[]) => {
    return JSON.stringify(items.map(({ item, number }) => ({ id: item.value, num: Number(number) })))
}

export const GAME_OPTIONS: any = [
    {
        name: '这城有良田',
        value: 'zcylt',
        pageType: '2',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: 'mmzhw51',
            ORIGIN_NUMBER: '1',
            OPERATION: [
                {
                    NAME: '后台发送',
                    TYPE: 'POST',
                    URL: 'http://115.231.220.134:8081/gm/user/gmquery.php',
                    GETDATA: (item: ItemsTypeSingle, account: string, number: any) => ({
                        type: item.action,
                        checknum: 'ltzy.vip',
                        uid: account,
                        item: item.value,
                        num: number,
                        qu: '1'
                    })
                }
            ]
        }
    },
    {
        name: '打僵尸',
        value: 'djs',
        pageType: '3',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: '慕灵',
            ORIGIN_NUMBER: '1',
            OPERATION: [
                {
                    NAME: '后台发送',
                    TYPE: 'POST',
                    URL: 'http://kp.a5o.cn/gm/gmPay.php',
                    GETDATA: (item: ItemsTypeSingle, account: string, number: any) => ({
                        code: item.value + ' ' + number,
                        request_type: item.type,
                        name: account,
                        cde: 'rssls'
                    })
                }
            ]
        }
    },
    {
        name: 'x战娘',
        value: 'xzn',
        pageType: '4',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: 'ns00000009',
            ORIGIN_NUMBER: '1',
            OPERATION: [
                {
                    NAME: '后台发送',
                    TYPE: 'POST',
                    URL: 'http://111.119.248.34:82/manage/mail_one/',
                    GETDATA: (item: ItemsTypeSingle, account: string, number: any) => ({
                        title: 'GM',
                        text: 'GM',
                        server_select: '1',
                        accname: account,
                        reward1_1: item.type,
                        reward1_2: item.value,
                        reward1_3: number,
                        reward2_1: '0',
                        reward2_3: '',
                        reward3_1: '0',
                        reward3_3: ''
                    })
                }
            ]
        }
    },
    {
        name: '少女回战',
        value: 'snhz',
        pageType: '8',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: 'mmzhw51',
            ORIGIN_NUMBER: '1',
            OPERATION: [
                {
                    NAME: '后台发送',
                    TYPE: 'POST',
                    URL: 'http://111.170.152.157:81/gm/gmquery.php',
                    GETDATA: (item: ItemsTypeSingle, account: string, number: any) => ({
                        action: 'senditem',
                        qid: '1',
                        uid: account,
                        gmcode: 'ltzy.vip',
                        itemid: item.value,
                        itemnum: number
                    })
                },
                {
                    NAME: '清空邮箱',
                    TYPE: 'POST',
                    URL: 'http://111.170.152.157:81/gm/ltdelete.php',
                    GETDATA: (account: string) => ({
                        qid: '1',
                        uid: account,
                        gmcode: 'ltzy.vip'
                    })
                }
            ]
        }
    },
    {
        name: '快乐水世界',
        value: 'klssj',
        pageType: '12',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: 'mmzhw51',
            ORIGIN_NUMBER: '1',
            OPERATION: [
                {
                    NAME: '后台发送1',
                    TYPE: 'POST',
                    URL: 'http://111.170.152.157:90/gm/query.php',
                    GETDATA: (item: ItemsTypeSingle, account: string, number: any) => ({
                        action: item.action,
                        qid: '1',
                        uid: account,
                        pswd: 'ltzy',
                        chargetype: item.action === 'sendmoney' ? item.value : undefined,
                        chargenum: item.action === 'sendmoney' ? number : undefined,
                        items: item.action !== 'sendmoney' ? JSON.stringify([{ id: item.value, num: number }]) : undefined
                    })
                }
            ]
        }
    },
    {
        name: '生成33天',
        value: 'sc33t',
        pageType: '14',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: 'mmzhw52',
            ORIGIN_NUMBER: '1',
            OPERATION: [
                {
                    NAME: '后台发送',
                    TYPE: 'POST',
                    URL: 'http://111.170.152.149:8855/ht/query.php',
                    GETDATA: (item: ItemsTypeSingle, account: string, number: any) => ({
                        action: item.action,
                        qid: '1',
                        uid: account,
                        pswd: 'ltzy',
                        items: stringifyBatchItems([{ item, number }])
                    }),
                    MAX_ITEM_COUNT: 5,
                    GETDATA_BATCH: (items: BatchItem[], account: string) => ({
                        action: items[0].item.action,
                        qid: '1',
                        uid: account,
                        pswd: 'ltzy',
                        items: stringifyBatchItems(items)
                    })
                }
            ]
        }
    },
    {
        name: '镇邪人',
        value: 'zxr',
        pageType: '15',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: 'mmzhw51',
            ORIGIN_NUMBER: '1',
            OPERATION: [
                {
                    NAME: '后台发送',
                    TYPE: 'POST',
                    URL: 'http://115.231.8.162:8202/ht/gm/query.php',
                    GETDATA: (item: ItemsTypeSingle, account: string, number: any) => ({
                        action: item.action,
                        qid: '1001',
                        uid: account,
                        pswd: '',
                        items: stringifyBatchItems([{ item, number }])
                    }),
                    MAX_ITEM_COUNT: 10,
                    GETDATA_BATCH: (items: BatchItem[], account: string) => ({
                        action: items[0].item.action,
                        qid: '1001',
                        uid: account,
                        pswd: '',
                        items: stringifyBatchItems(items)
                    })
                },
                {
                    NAME: '清空背包',
                    TYPE: 'POST',
                    URL: 'http://115.231.8.162:8202/ht/gm/query.php',
                    GETDATA: (account: string) => ({
                        action: 'clear_bag',
                        qid: '1001',
                        uid: account,
                        pswd: '',
                        confirm: '1'
                    })
                }
            ]
        }
    },
    {
        name: '灵契不良人',
        value: 'xblr',
        pageType: '16',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: 'mmzhw52',
            ORIGIN_NUMBER: '1',
            OPERATION: [
                {
                    NAME: '后台发送',
                    TYPE: 'POST',
                    URL: 'http://115.231.8.159:9105/api.php',
                    SESSION: {
                        RESOLVE_URL: 'http://115.231.8.159:9105/resolve.php',
                        ACCOUNT_FIELD: 'account'
                    },
                    HEADERS: {
                        'X-Requested-With': 'XMLHttpRequest',
                        Origin: 'http://115.231.8.159:9105',
                        Referer: 'http://115.231.8.159:9105/gm.php'
                    },
                    GETDATA: (item: ItemsTypeSingle, account: string, number: any) => ({
                        action: 'send_items_batch',
                        mail_title: '凌天众游',
                        mail_content: '凌天众游-您有新的邮件，请查收！',
                        gm_pswd: '',
                        items: stringifyBatchItems([{ item, number }])
                    }),
                    MAX_ITEM_COUNT: 5,
                    GETDATA_BATCH: (items: BatchItem[], account: string) => ({
                        action: 'send_items_batch',
                        mail_title: '凌天众游',
                        mail_content: '凌天众游-您有新的邮件，请查收！',
                        gm_pswd: '',
                        items: stringifyBatchItems(items)
                    })
                }
            ]
        }
    }
]

export default async function getGameOptions(key: string) {
    const match = GAME_OPTIONS.find((item: any) => item.value === key)
    if (match) {
        const option = _.cloneDeep(match.options)
        option.ORIGIN_GOODS = (await axios.get(`items/${key}.txt`))?.data ?? []
        return option
    }
    return {}
}
