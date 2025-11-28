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
            ORIGIN_REQ_URL: 'http://111.119.248.34:8081/gm_lt/user/gmquery.php',
            ORIGIN_REQ_METHOD: 'post',
            ORIGIN_REQ_FORM_DATA: (item: ItemsTypeSingle, account: string, number: string | number) => ({
                type: 'mail',
                checknum: '123456',
                uid: account,
                item: item.value,
                num: number,
                qu: '1'
            })
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
            ORIGIN_REQ_URL: 'http://kp.a5o.cn/gm/gmPay.php',
            ORIGIN_REQ_METHOD: 'post',
            ORIGIN_REQ_FORM_DATA: (item: ItemsTypeSingle, account: string, number: string | number) => ({
                code: item.value + ' ' + number,
                request_type: item.type,
                name: account,
                cde: 'rssls'
            })
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
            ORIGIN_REQ_URL: 'http://111.119.248.34:82/manage/mail_one/',
            ORIGIN_REQ_METHOD: 'post',
            ORIGIN_REQ_FORM_DATA: (item: ItemsTypeSingle, account: string, number: string | number) => ({
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
    },
    {
        name: '三国猫',
        value: 'sgm',
        pageType: '7',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: 'mmzhw51',
            ORIGIN_NUMBER: '1',
            ORIGIN_REQ_URL: 'http://115.231.220.33:81/gm/user/gmquery.php',
            ORIGIN_REQ_METHOD: 'post',
            ORIGIN_REQ_FORM_DATA: (item: ItemsTypeSingle, account: string, number: string | number) => ({
                type: 'mail',
                checknum: 'ltzy.vip',
                uid: account,
                item: item.value,
                num: number,
                qu: '2'
            })
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
            ORIGIN_REQ_URL: 'http://111.170.152.157:81/gm/gmquery.php',
            ORIGIN_REQ_METHOD: 'post',
            ORIGIN_REQ_FORM_DATA: (item: ItemsTypeSingle, account: string, number: string | number) => ({
                action: 'senditem',
                qid: '1',
                uid: account,
                gmcode: 'ltzy.vip',
                itemid: item.value,
                itemnum: number
            })
        }
    },
    {
        name: '炼仙传说',
        value: 'lxcs',
        pageType: '9',
        options: {
            ORIGIN_GOODS: [],
            ORIGIN_ACCOUNT: 'mmzhw51',
            ORIGIN_NUMBER: '1',
            ORIGIN_REQ_URL: 'http://115.231.220.245:88/gm/gmquery.php',
            ORIGIN_REQ_METHOD: 'post',
            ORIGIN_REQ_FORM_DATA: (item: ItemsTypeSingle, account: string, number: string | number) => ({
                action: 'senditem',
                qid: '1',
                uid: account,
                gmcode: 'ltzy.vip',
                itemid: item.value,
                itemnum: number
            }),
            ORIGIN_REQ_DEL_FORM_DATA: (item: ItemsTypeSingle, account: string, number: string | number) => ({
                action: 'senddelitem',
                qid: '1',
                uid: account,
                gmcode: 'ltzy.vip',
                itemid: item.value,
                itemnum: number
            }),
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
