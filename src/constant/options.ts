import WUPIN_ZCYLT from '@/constant/zcylt'
import WUPIN_DJS from '@/constant/djs'
import WUPIN_XZN from '@/constant/xzn'
import WUPIN_MJDX from '@/constant/mjdx'
import WUPIN_WL from '@/constant/wl'
import WUPIN_SGM from '@/constant/sgm'
import _ from 'lodash'
import WUPIN_SNHZ from '@/constant/snhz'

const GAME_OPTIONS: any = {
    zcylt: {
        ORIGIN_GOODS: WUPIN_ZCYLT,
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
    },
    djs: {
        ORIGIN_GOODS: WUPIN_DJS,
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
    },
    xzn: {
        ORIGIN_GOODS: WUPIN_XZN,
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
    },
    mjdx: {
        ORIGIN_GOODS: WUPIN_MJDX,
        ORIGIN_ACCOUNT: '清路尘,倚香雪',
        ORIGIN_NUMBER: '1',
        ORIGIN_REQ_URL: 'http://202.140.143.190:88/user/gmquery.php',
        ORIGIN_REQ_METHOD: 'post',
        ORIGIN_REQ_FORM_DATA: (item: ItemsTypeSingle, account: string, number: string | number) => ({
            type: item.type,
            uid: account,
            qu: '10001',
            checknum: '123456',
            item: item.value,
            charge: item.value,
            num: number
        })
    },
    wl: {
        ORIGIN_GOODS: WUPIN_WL,
        ORIGIN_ACCOUNT: '闻人若萱,浩星昊文,车非芙雪,西宫少主',
        ORIGIN_NUMBER: '1',
        ORIGIN_REQ_URL: 'http://183.131.85.198:86/gm/user/query.php',
        ORIGIN_REQ_METHOD: 'post',
        ORIGIN_REQ_FORM_DATA: (item: ItemsTypeSingle, account: string, number: string | number) => ({
            type: item.type,
            uid: account,
            item: item.value,
            num: number,
            qu: '1',
            pwd: '112233',
            title: 'GM邮件',
            content: '亲爱的玩家，请查收您的邮件!'
        })
    },
    sgm: {
        ORIGIN_GOODS: WUPIN_SGM,
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
    },
    snhz: {
        ORIGIN_GOODS: WUPIN_SNHZ,
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
}
export default function getGameOptions(key: string) {
    return _.cloneDeep(GAME_OPTIONS[key])
}
