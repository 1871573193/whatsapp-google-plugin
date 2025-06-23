const { getHashWinObj } = require('../../../util/index');
function loadEvent() {
    window.Store.Msg.on('add', (msg) => {
        if (msg.isNewMsg) {
            if (msg.type === 'ciphertext') {
                msg.once('change:type', (_msg) => {
                    getHashWinObj().onAddMessageEvent(window.WWebJS.getMessageModel(_msg))
                })
                getHashWinObj().onAddMessageCiphertextEvent(window.WWebJS.getMessageModel(msg));
            } else {
                getHashWinObj().onAddMessageEvent(window.WWebJS.getMessageModel(msg))
            }
        }

    });

    window.Store.Msg.on('change', (msg) => {
        console.log('change', window.WWebJS.getMessageModel(msg));

    });
    if (window.compareWwebVersions(window.Debug.VERSION, '>=', '2.3000.1014111620')) {
        const module = window.Store.AddonReactionTable;
        const ogMethod = module.bulkUpsert;
        module.bulkUpsert = ((...args) => {
            window.onReaction(args[0].map(reaction => {
                const msgKey = reaction.id;
                const parentMsgKey = reaction.reactionParentKey;
                const timestamp = reaction.reactionTimestamp / 1000;
                const sender = reaction.author ?? reaction.from;
                const senderUserJid = sender._serialized;

                return { ...reaction, msgKey, parentMsgKey, senderUserJid, timestamp };
            }));

            return ogMethod(...args);
        }).bind(module);
    } else {
        const module = window.Store.createOrUpdateReactionsModule;
        const ogMethod = module.createOrUpdateReactions;
        module.createOrUpdateReactions = ((...args) => {
            window.onReaction(args[0].map(reaction => {
                const msgKey = window.Store.MsgKey.fromString(reaction.msgKey);
                const parentMsgKey = window.Store.MsgKey.fromString(reaction.parentMsgKey);
                const timestamp = reaction.timestamp / 1000;

                return { ...reaction, msgKey, parentMsgKey, timestamp };
            }));

            return ogMethod(...args);
        }).bind(module);
    }
}

exports.loadEvent = loadEvent;
