import gujianqitan from "@/constant/gujianqitan";
import gulong from "@/constant/gulong";

const glqxz: ItemsGJQT = {
    nameWord: window.localStorage.getItem("glqxznameWord") || "桃花碧柔",
    itemNum: window.localStorage.getItem("glqxzitemNumber") || "",
    itemId: window.localStorage.getItem("glqxzitemId") || "",
    reqType: window.localStorage.getItem("glqxzreqType") || "mail",
    mail: gulong.WUPIN,
    charge: gulong.CHARG_WUPIN,
    charge2: gulong.CHARG_2_WUPIN,
    getReqFormData: (type: string, nameWord: string, itemNum: string, id: string) => {
        const params: any = {
            charge: {
                type: "charge",
                username: nameWord,
                qu: 2,
                rechargeId: 10,
                number: Number(itemNum),
                rechargezId: "",
                znumber: 1,
                mailnum: 1
            },
            charge2: {
                type: "charge2",
                username: nameWord,
                qu: 2,
                rechargeId: 10,
                znumber: Number(itemNum),
                rechargezId: Number(id),
                mailnum: 1
            },
            mail: {
                type: "mail",
                username: nameWord,
                mailid: Number(id),
                mailnum: Number(itemNum),
                qu: 2,
                charge: 3
            }
        };
        return params[type];
    },
    getReqParams: (type: string, nameWord: string, itemNum: string, id: string) => {
        return { act: "send", sid: 1001 };
    },
    realReqUrl: "http://106.74.21.2:81/jkgm/user/playerapi.php",
    realReqMethod: "post"
};

const gjqt: ItemsGJQT = {
    nameWord: window.localStorage.getItem("gjqtnameWord") || "31505037001",
    itemNum: window.localStorage.getItem("gjqtitemNumber") || "",
    itemId: window.localStorage.getItem("gjqtitemId") || "",
    reqType: window.localStorage.getItem("gjqtreqType") || "mail",
    mail: gujianqitan.WUPIN,
    charge: gujianqitan.CHARG_WUPIN,
    charge2: [],
    getReqFormData: (type: string, nameWord: string, itemNum: string, id: string) => {
        const params: any = {
            charge: {
                action: "charge",
                qid: 1,
                uid: nameWord,
                chargeid: Number(id)
            },
            mail: {
                action: "senditem",
                qid: 1,
                uid: nameWord,
                itemid: Number(id),
                itemnum: Number(itemNum)
            }
        };
        return params[type];
    },
    getReqParams: (type: string, nameWord: string, itemNum: string, id: string) => {
        return null;
    },
    realReqUrl: "http://61.171.55.117:8090/ht/gm/query.php",
    realReqMethod: "post"
};

const defaultValues:any = { glqxz, gjqt };

export default defaultValues;
