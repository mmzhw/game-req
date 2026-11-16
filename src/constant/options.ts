import _ from 'lodash'
import axios from 'axios'

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
                        items: JSON.stringify([{ id: item.value, num: Number(number) }])
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
                        items: JSON.stringify([{ id: item.value, num: Number(number) }])
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
        option.ORIGIN_GOODS = (await axios.get(`items/${key}.text`))?.data ?? []
        return option
    }
    return {}
}
