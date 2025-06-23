const { ExposeAuthStore } = require('./util/Injected/AuthStore/AuthStore');
const { ExposeStore } = require('./util/Injected/Store');
const { ExposeLegacyAuthStore } = require('./util/Injected/AuthStore/LegacyAuthStore');
const { ExposeLegacyStore } = require('./util/Injected/LegacyStore');
const {LoadUtils} = require('./util/Injected/Utils');
const { loadOk, getWWebVersion ,loadStore} = require('../util/index');
const moduleRaid = require('@pedroslopez/moduleraid/moduleraid');
const { loadEvent } = require('./util/Event');


function init() {
    
    return new Promise(async (resolve, reject) => {
        await loadOk()
        const version = getWWebVersion();
        const isCometOrAbove = parseInt(version.split('.')?.[1]) >= 3000;

        if (isCometOrAbove) {
            ExposeAuthStore()
            
            ExposeStore()
        } else {
            
            ExposeLegacyAuthStore(moduleRaid)
            await new Promise(r => setTimeout(r, 2000));
            ExposeLegacyStore()
        }
        LoadUtils()
        
        
        loadEvent()
        resolve()
    })
}
exports.init = init;





