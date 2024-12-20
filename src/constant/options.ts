import WUPIN_ZCYLT from '@/constant/zcylt'
import WUPIN_DJS from '@/constant/djs'
import WUPIN_XZN from '@/constant/xzn'
import _ from 'lodash'

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
    }
}
export default function getGameOptions(key: string) {
    return _.cloneDeep(GAME_OPTIONS[key])
}
