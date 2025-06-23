class ClientInfo {
    constructor() {
        const data = { ...window.Store.Conn.serialize(), wid: window.Store.User.getMeUser() };
        this._patch(data);
    }

    _patch(data) {
        this.pushname = data.pushname;
        this.wid = data.wid;
        this.me = data.wid;
        this.phone = data.phone;
        this.platform = data.platform;
    }


    async getBatteryStatus() {
        const { battery, plugged } = window.Store.Conn;
        return { battery, plugged };

    }
}

module.exports = ClientInfo;