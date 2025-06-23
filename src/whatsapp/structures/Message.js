const MessageMedia = require('./MessageMedia');
const Location = require('./Location');
const Order = require('./Order');
const Payment = require('./Payment');
const Reaction = require('./Reaction');
const Contact = require('./Contact');
const { MessageTypes } = require('../util/Constants');


class Message extends Object {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        this._data = data;
        this.mediaKey = data.mediaKey;
        this.id = data.id;
        this.ack = data.ack;
        this.hasMedia = Boolean(data.directPath);
        this.body = this.hasMedia ? data.caption || '' : data.body || data.pollName || '';
        this.type = data.type;
        this.timestamp = data.t;
        this.from = (typeof (data.from) === 'object' && data.from !== null) ? data.from._serialized : data.from;
        this.to = (typeof (data.to) === 'object' && data.to !== null) ? data.to._serialized : data.to;
        this.author = (typeof (data.author) === 'object' && data.author !== null) ? data.author._serialized : data.author;
        this.deviceType = typeof data.id.id === 'string' && data.id.id.length > 21 ? 'android' : typeof data.id.id === 'string' && data.id.id.substring(0, 2) === '3A' ? 'ios' : 'web';
        this.isForwarded = data.isForwarded;
        this.forwardingScore = data.forwardingScore || 0;
        this.isStatus = data.isStatusV3 || data.id.remote === 'status@broadcast';
        this.isStarred = data.star;
        this.broadcast = data.broadcast;
        this.fromMe = data.id.fromMe;
        this.hasQuotedMsg = data.quotedMsg ? true : false;
        this.hasReaction = data.hasReaction ? true : false;
        this.duration = data.duration ? data.duration : undefined;
        this.location = (() => {
            if (data.type !== MessageTypes.LOCATION) {
                return undefined;
            }
            let description;
            if (data.loc && typeof data.loc === 'string') {
                let splitted = data.loc.split('\n');
                description = {
                    name: splitted[0],
                    address: splitted[1],
                    url: data.clientUrl
                };
            }
            return new Location(data.lat, data.lng, description);
        })();
        this.vCards = data.type === MessageTypes.CONTACT_CARD_MULTI ? data.vcardList.map((c) => c.vcard) : data.type === MessageTypes.CONTACT_CARD ? [data.body] : [];
        this.inviteV4 = data.type === MessageTypes.GROUP_INVITE ? {
            inviteCode: data.inviteCode,
            inviteCodeExp: data.inviteCodeExp,
            groupId: data.inviteGrp,
            groupName: data.inviteGrpName,
            fromId: typeof data.from === 'object' && '_serialized' in data.from ? data.from._serialized : data.from,
            toId: typeof data.to === 'object' && '_serialized' in data.to ? data.to._serialized : data.to
        } : undefined;
        this.mentionedIds = data.mentionedJidList || [];
        this.groupMentions = data.groupMentions || [];
        this.orderId = data.orderId ? data.orderId : undefined;
        this.token = data.token ? data.token : undefined;
        this.isGif = Boolean(data.isGif);
        this.isEphemeral = data.isEphemeral;
        if (data.title) {
            this.title = data.title;
        }
        if (data.description) {
            this.description = data.description;
        }
        if (data.businessOwnerJid) {
            this.businessOwnerJid = data.businessOwnerJid;
        }
        if (data.productId) {
            this.productId = data.productId;
        }
        if (data.latestEditSenderTimestampMs) {
            this.latestEditSenderTimestampMs = data.latestEditSenderTimestampMs;
        }
        if (data.latestEditMsgKey) {
            this.latestEditMsgKey = data.latestEditMsgKey;
        }
        this.links = data.links;
        if (data.dynamicReplyButtons) {
            this.dynamicReplyButtons = data.dynamicReplyButtons;
        }
        if (data.selectedButtonId) {
            this.selectedButtonId = data.selectedButtonId;
        }
        if (data.listResponse && data.listResponse.singleSelectReply.selectedRowId) {
            this.selectedRowId = data.listResponse.singleSelectReply.selectedRowId;
        }
        if (this.type === MessageTypes.POLL_CREATION) {
            this.pollName = data.pollName;
            this.pollOptions = data.pollOptions;
            this.allowMultipleAnswers = Boolean(!data.pollSelectableOptionsCount);
            this.pollInvalidated = data.pollInvalidated;
            this.isSentCagPollCreation = data.isSentCagPollCreation;
            this.messageSecret = Object.keys(data.messageSecret).map((key) => data.messageSecret[key]);
        }
        return super._patch(data);
    }

    _getChatId() {
        return this.fromMe ? this.to : this.from;
    }

    async reload() {
        const msg = window.Store.Msg.get(this.id._serialized) || (await window.Store.Msg.getMessagesById([this.id._serialized]))?.messages?.[0];
        if (!msg) return null;
        return window.WWebJS.getMessageModel(msg);
        if (!newData) return null;
        this._patch(newData);
        return this;
    }

    get rawData() {
        return this._data;
    }

    getChat() {
        return this.client.getChatById(this._getChatId());
    }

    getContact() {
        return this.client.getContactById(this.author || this.from);
    }

    async getMentions() {
        return await Promise.all(this.mentionedIds.map(async m => await this.client.getContactById(m)));
    }

    async getGroupMentions() {
        return await Promise.all(this.groupMentions.map(async (m) => await this.client.getChatById(m.groupJid._serialized)));
    }

    async getQuotedMessage() {
        if (!this.hasQuotedMsg) return undefined;
        const quotedMsg = await this.client.pupPage.evaluate(async (msgId) => {
            const msg = window.Store.Msg.get(msgId) || (await window.Store.Msg.getMessagesById([msgId]))?.messages?.[0];
            const quotedMsg = window.Store.QuotedMsg.getQuotedMsgObj(msg);
            return window.WWebJS.getMessageModel(quotedMsg);
        }, this.id._serialized);
        return new Message(this.client, quotedMsg);
    }

    async reply(content, chatId, options = {}) {
        if (!chatId) {
            chatId = this._getChatId();
        }
        options = {
            ...options,
            quotedMessageId: this.id._serialized
        };
        return this.client.sendMessage(chatId, content, options);
    }

    async react(reaction) {
        await this.client.pupPage.evaluate(async (messageId, reaction) => {
            if (!messageId) return null;
            const msg = window.Store.Msg.get(messageId) || (await window.Store.Msg.getMessagesById([messageId]))?.messages?.[0];
            if (!msg) return null;
            await window.Store.sendReactionToMsg(msg, reaction);
        }, this.id._serialized, reaction);
    }

    async acceptGroupV4Invite() {
        return await this.client.acceptGroupV4Invite(this.inviteV4);
    }

    async forward(chat) {
        const chatId = typeof chat === 'string' ? chat : chat.id._serialized;
        await this.client.pupPage.evaluate(async (msgId, chatId) => {
            return window.WWebJS.forwardMessage(chatId, msgId);
        }, this.id._serialized, chatId);
    }

    async downloadMedia() {
        if (!this.hasMedia) {
            return undefined;
        }
        const result = await this.client.pupPage.evaluate(async (msgId) => {
            const msg = window.Store.Msg.get(msgId) || (await window.Store.Msg.getMessagesById([msgId]))?.messages?.[0];
            if (!msg || !msg.mediaData) {
                return null;
            }
            if (msg.mediaData.mediaStage != 'RESOLVED') {
                await msg.downloadMedia({
                    downloadEvenIfExpensive: true,
                    rmrReason: 1
                });
            }
            if (msg.mediaData.mediaStage.includes('ERROR') || msg.mediaData.mediaStage === 'FETCHING') {
                return undefined;
            }
            try {
                const decryptedMedia = await window.Store.DownloadManager.downloadAndMaybeDecrypt({
                    directPath: msg.directPath,
                    encFilehash: msg.encFilehash,
                    filehash: msg.filehash,
                    mediaKey: msg.mediaKey,
                    mediaKeyTimestamp: msg.mediaKeyTimestamp,
                    type: msg.type,
                    signal: (new AbortController).signal
                });
                const data = await window.WWebJS.arrayBufferToBase64Async(decryptedMedia);
                return {
                    data,
                    mimetype: msg.mimetype,
                    filename: msg.filename,
                    filesize: msg.size
                };
            } catch (e) {
                if (e.status && e.status === 404) return undefined;
                throw e;
            }
        }, this.id._serialized);
        if (!result) return undefined;
        return new MessageMedia(result.mimetype, result.data, result.filename, result.filesize);
    }

    async delete(everyone, clearMedia = true) {
        await this.client.pupPage.evaluate(async (msgId, everyone, clearMedia) => {
            const msg = window.Store.Msg.get(msgId) || (await window.Store.Msg.getMessagesById([msgId]))?.messages?.[0];
            const chat = window.Store.Chat.get(msg.id.remote) || (await window.Store.Chat.find(msg.id.remote));
            const canRevoke = window.Store.MsgActionChecks.canSenderRevokeMsg(msg) || window.Store.MsgActionChecks.canAdminRevokeMsg(msg);
            if (everyone && canRevoke) {
                return window.compareWwebVersions(window.Debug.VERSION, '>=', '2.3000.0')
                    ? window.Store.Cmd.sendRevokeMsgs(chat, { list: [msg], type: 'message' }, { clearMedia: clearMedia })
                    : window.Store.Cmd.sendRevokeMsgs(chat, [msg], { clearMedia: true, type: msg.id.fromMe ? 'Sender' : 'Admin' });
            }
            return window.compareWwebVersions(window.Debug.VERSION, '>=', '2.3000.0')
                ? window.Store.Cmd.sendDeleteMsgs(chat, { list: [msg], type: 'message' }, clearMedia)
                : window.Store.Cmd.sendDeleteMsgs(chat, [msg], clearMedia);
        }, this.id._serialized, everyone, clearMedia);
    }

    async star() {
        await this.client.pupPage.evaluate(async (msgId) => {
            const msg = window.Store.Msg.get(msgId) || (await window.Store.Msg.getMessagesById([msgId]))?.messages?.[0];
            if (window.Store.MsgActionChecks.canStarMsg(msg)) {
                let chat = await window.Store.Chat.find(msg.id.remote);
                return window.Store.Cmd.sendStarMsgs(chat, [msg], false);
            }
        }, this.id._serialized);
    }

    async unstar() {
        await this.client.pupPage.evaluate(async (msgId) => {
            const msg = window.Store.Msg.get(msgId) || (await window.Store.Msg.getMessagesById([msgId]))?.messages?.[0];
            if (window.Store.MsgActionChecks.canStarMsg(msg)) {
                let chat = await window.Store.Chat.find(msg.id.remote);
                return window.Store.Cmd.sendUnstarMsgs(chat, [msg], false);
            }
        }, this.id._serialized);
    }

    async pin(duration) {
        return await this.client.pupPage.evaluate(async (msgId, duration) => {
            return await window.WWebJS.pinUnpinMsgAction(msgId, 1, duration);
        }, this.id._serialized, duration);
    }

    async unpin() {
        return await this.client.pupPage.evaluate(async (msgId) => {
            return await window.WWebJS.pinUnpinMsgAction(msgId, 2);
        }, this.id._serialized);
    }

    async getInfo() {
        const info = await this.client.pupPage.evaluate(async (msgId) => {
            const msg = window.Store.Msg.get(msgId) || (await window.Store.Msg.getMessagesById([msgId]))?.messages?.[0];
            if (!msg || !msg.id.fromMe) return null;
            return new Promise((resolve) => {
                setTimeout(async () => {
                    resolve(await window.Store.getMsgInfo(msg.id));
                }, (Date.now() - msg.t * 1000 < 1250) && Math.floor(Math.random() * (1200 - 1100 + 1)) + 1100 || 0);
            });
        }, this.id._serialized);
        return info;
    }

    async getOrder() {
        if (this.type === MessageTypes.ORDER) {
            const result = await this.client.pupPage.evaluate((orderId, token, chatId) => {
                return window.WWebJS.getOrderDetail(orderId, token, chatId);
            }, this.orderId, this.token, this._getChatId());
            if (!result) return undefined;
            return new Order(this.client, result);
        }
        return undefined;
    }

    async getPayment() {
        if (this.type === MessageTypes.PAYMENT) {
            const msg = await this.client.pupPage.evaluate(async (msgId) => {
                const msg = window.Store.Msg.get(msgId) || (await window.Store.Msg.getMessagesById([msgId]))?.messages?.[0];
                if (!msg) return null;
                return msg.serialize();
            }, this.id._serialized);
            return new Payment(this.client, msg);
        }
        return undefined;
    }

    async getReactions() {
        if (!this.hasReaction) {
            return undefined;
        }
        const reactions = await this.client.pupPage.evaluate(async (msgId) => {
            const msgReactions = await window.Store.Reactions.find(msgId);
            if (!msgReactions || !msgReactions.reactions.length) return null;
            return msgReactions.reactions.serialize();
        }, this.id._serialized);
        if (!reactions) {
            return undefined;
        }
        return reactions.map(reaction => {
            reaction.senders = reaction.senders.map(sender => {
                sender.timestamp = Math.round(sender.timestamp / 1000);
                return new Reaction(this.client, sender);
            });
            return reaction;
        });
    }

    async edit(content, options = {}) {
        if (options.mentions) {
            !Array.isArray(options.mentions) && (options.mentions = [options.mentions]);
            if (options.mentions.some((possiblyContact) => possiblyContact instanceof Contact)) {
                console.warn('Mentions with an array of Contact are now deprecated. See more at https://github.com/pedroslopez/whatsapp-web.js/pull/2166.');
                options.mentions = options.mentions.map((a) => a.id._serialized);
            }
        }
        options.groupMentions && !Array.isArray(options.groupMentions) && (options.groupMentions = [options.groupMentions]);
        let internalOptions = {
            linkPreview: options.linkPreview === false ? undefined : true,
            mentionedJidList: options.mentions || [],
            groupMentions: options.groupMentions,
            extraOptions: options.extra
        };
        if (!this.fromMe) {
            return null;
        }
        const messageEdit = await this.client.pupPage.evaluate(async (msgId, message, options) => {
            const msg = window.Store.Msg.get(msgId) || (await window.Store.Msg.getMessagesById([msgId]))?.messages?.[0];
            if (!msg) return null;
            let canEdit = window.Store.MsgActionChecks.canEditText(msg) || window.Store.MsgActionChecks.canEditCaption(msg);
            if (canEdit) {
                const msgEdit = await window.WWebJS.editMessage(msg, message, options);
                return msgEdit.serialize();
            }
            return null;
        }, this.id._serialized, content, internalOptions);
        if (messageEdit) {
            return new Message(this.client, messageEdit);
        }
        return null;
    }
}

module.exports = Message;
